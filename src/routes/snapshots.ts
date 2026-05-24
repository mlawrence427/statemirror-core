import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import type { Config } from '../config.js';
import { getPool, withTransaction } from '../db/client.js';
import { createReadAuthHook, createWriteAuthHook } from '../lib/auth.js';
import {
  hashPayload,
  hashString,
  computeChainHash,
  toBase64,
  buffersEqual,
} from '../lib/hash.js';
import { canonicalize } from '../lib/canonicalize.js';
import type {
  SnapshotInput,
  SnapshotRecord,
  SnapshotResponse,
  SnapshotFullResponse,
} from '../types/index.js';

export async function snapshotRoutes(fastify: FastifyInstance, config: Config) {
  const readAuth = createReadAuthHook(config);
  const writeAuth = createWriteAuthHook(config);

  // POST /v1/snapshots - Create a new snapshot
  fastify.post<{
    Body: SnapshotInput;
    Reply: SnapshotResponse | { error: string; message: string };
  }>(
    '/v1/snapshots',
    {
      preHandler: writeAuth,
    },
    async (request, reply) => {
      // Validate idempotency key
      const idempotencyKey = request.headers['idempotency-key'];
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Idempotency-Key header is required',
        });
      }

      const body = request.body;

      const raw: any = body as any;
      const usedDeprecatedFields: string[] = [];
      const evidence_ref = typeof raw.evidence_ref === 'string' ? raw.evidence_ref : (typeof raw.decision_ref === 'string' ? (usedDeprecatedFields.push('decision_ref'), raw.decision_ref) : undefined);
      const evidence_type = typeof raw.evidence_type === 'string' ? raw.evidence_type : (typeof raw.decision_type === 'string' ? (usedDeprecatedFields.push('decision_type'), raw.decision_type) : undefined);

      // Validate required fields
      if (!evidence_ref) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'evidence_ref is required (string). For backwards compatibility, decision_ref is accepted but deprecated.',
        });
      }
      if (!evidence_type) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'evidence_type is required (string). For backwards compatibility, decision_type is accepted but deprecated.',
        });
      }
      if (!body.captured_at || typeof body.captured_at !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'captured_at is required and must be an ISO timestamp string',
        });
      }
      if (!body.state_payload || typeof body.state_payload !== 'object') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'state_payload is required and must be an object',
        });
      }

      // Validate captured_at is valid ISO timestamp
      const capturedAt = new Date(body.captured_at);
      if (isNaN(capturedAt.getTime())) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'captured_at must be a valid ISO timestamp',
        });
      }

      // Check payload size
      const payloadJson = canonicalize(body.state_payload);
      const payloadBytes = Buffer.byteLength(payloadJson, 'utf8');
      if (payloadBytes > config.maxPayloadBytes) {
        return reply.status(413).send({
          error: 'Payload Too Large',
          message: `state_payload exceeds maximum size of ${config.maxPayloadBytes} bytes`,
        });
      }

      // Compute hashes
      const keyHash = hashString(idempotencyKey);
      const payloadHash = hashPayload(body.state_payload);
      const requestHash = payloadHash; // Same as payload hash for conflict detection

      const pool = getPool();

      // Check for existing idempotency key
      const existingKey = await pool.query(
        `SELECT snapshot_id, request_hash FROM idempotency_keys WHERE key_hash = $1`,
        [keyHash]
      );

      if (existingKey.rows.length > 0) {
        const existing = existingKey.rows[0];
        // Check if request hash matches
        if (!buffersEqual(existing.request_hash, requestHash)) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Idempotency key already used with different payload',
          });
        }

        // Return existing snapshot
        const snapshot = await pool.query(
          `SELECT snapshot_id, sequence_num, received_at, payload_hash, chain_hash
           FROM snapshots WHERE snapshot_id = $1`,
          [existing.snapshot_id]
        );

        if (snapshot.rows.length === 0) {
          // This shouldn't happen, but handle gracefully
          return reply.status(500).send({
            error: 'Internal Server Error',
            message: 'Idempotency record exists but snapshot not found',
          });
        }

        const row = snapshot.rows[0];
        return reply.status(200).send({
          component: config.component,
          version: config.version,
          warnings: [],
          snapshot_id: row.snapshot_id,
          sequence_num: parseInt(row.sequence_num, 10),
          received_at: row.received_at.toISOString(),
          payload_hash: toBase64(row.payload_hash),
          chain_hash: toBase64(row.chain_hash),
        });
      }

      // Create new snapshot with transaction
      try {
        const result = await withTransaction(async (client) => {
          // Lock for sequence assignment
          await client.query('SELECT pg_advisory_xact_lock(1)');

          // Get previous chain hash and next sequence number
          const prevResult = await client.query(
            `SELECT sequence_num, chain_hash FROM snapshots 
             ORDER BY sequence_num DESC LIMIT 1`
          );

          let sequenceNum: bigint;
          let prevChainHash: Buffer | null = null;

          if (prevResult.rows.length === 0) {
            sequenceNum = 1n;
          } else {
            sequenceNum = BigInt(prevResult.rows[0].sequence_num) + 1n;
            prevChainHash = prevResult.rows[0].chain_hash;
          }

          // Compute chain hash
          const chainHash = computeChainHash(sequenceNum, payloadHash, prevChainHash);

          // Insert snapshot
          const snapshotId = randomUUID();
          const receivedAt = new Date();

          await client.query(
            `INSERT INTO snapshots (
              snapshot_id, sequence_num, evidence_ref, evidence_type,
              captured_at, received_at, state_payload, payload_bytes,
              payload_hash, prev_chain_hash, chain_hash,
              source_system, source_version, correlation_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              snapshotId,
              sequenceNum.toString(),
              evidence_ref,
              evidence_type,
              capturedAt,
              receivedAt,
              body.state_payload,
              payloadBytes,
              payloadHash,
              prevChainHash,
              chainHash,
              body.source_system || null,
              body.source_version || null,
              body.correlation_id || null,
            ]
          );

          // Insert idempotency key
          await client.query(
            `INSERT INTO idempotency_keys (key_hash, snapshot_id, request_hash, expires_at)
             VALUES ($1, $2, $3, now() + interval '24 hours')`,
            [keyHash, snapshotId, requestHash]
          );

          return {
            snapshot_id: snapshotId,
            sequence_num: Number(sequenceNum),
            received_at: receivedAt.toISOString(),
            payload_hash: toBase64(payloadHash),
            chain_hash: toBase64(chainHash),
          };
        });

        return reply.status(201).send(result);
      } catch (error: unknown) {
        fastify.log.error(error, 'Failed to create snapshot');
        
        // Check for unique constraint violations
        if (error instanceof Error && error.message.includes('unique')) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Snapshot creation conflict, please retry',
          });
        }

        return reply.status(503).send({
          error: 'Service Unavailable',
          message: 'Database operation failed, please retry',
        });
      }
    }
  );

  // GET /v1/snapshots/:snapshot_id - Get snapshot by ID
  fastify.get<{
    Params: { snapshot_id: string };
    Reply: SnapshotFullResponse | { error: string; message: string };
  }>(
    '/v1/snapshots/:snapshot_id',
    {
      preHandler: readAuth,
    },
    async (request, reply) => {
      const { snapshot_id } = request.params;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(snapshot_id)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid snapshot_id format',
        });
      }

      const pool = getPool();
      const result = await pool.query(
        `SELECT * FROM snapshots WHERE snapshot_id = $1`,
        [snapshot_id]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Snapshot not found',
        });
      }

      const row = result.rows[0] as SnapshotRecord;

      // Verify payload integrity
      const recomputedPayloadHash = hashPayload(row.state_payload);
      const payloadValid = buffersEqual(recomputedPayloadHash, row.payload_hash);

      // Verify chain link (only immediate predecessor)
      let chainValid = true;
      const sequenceNum = BigInt(row.sequence_num);

      if (sequenceNum === 1n) {
        // First record: prev_chain_hash should be null
        chainValid = row.prev_chain_hash === null;
      } else {
        // Get previous record
        const prevResult = await pool.query(
          `SELECT chain_hash FROM snapshots WHERE sequence_num = $1`,
          [(sequenceNum - 1n).toString()]
        );

        if (prevResult.rows.length === 0) {
          chainValid = false; // Gap in sequence
        } else if (row.prev_chain_hash === null) {
          chainValid = false;
        } else {
          chainValid = buffersEqual(prevResult.rows[0].chain_hash, row.prev_chain_hash);
        }
      }

      // Also verify the chain hash itself
      if (chainValid) {
        const expectedChainHash = computeChainHash(
          sequenceNum,
          row.payload_hash,
          row.prev_chain_hash
        );
        chainValid = buffersEqual(expectedChainHash, row.chain_hash);
      }

      return reply.send({
        component: config.component,
        version: config.version,
        warnings: [],
        snapshot_id: row.snapshot_id,
        sequence_num: parseInt(row.sequence_num, 10),
        evidence_ref: row.evidence_ref,
        evidence_type: row.evidence_type,
        captured_at: row.captured_at.toISOString(),
        received_at: row.received_at.toISOString(),
        state_payload: row.state_payload,
        payload_hash: toBase64(row.payload_hash),
        chain_hash: toBase64(row.chain_hash),
        source_system: row.source_system,
        source_version: row.source_version,
        correlation_id: row.correlation_id,
        integrity: {
          payload_valid: payloadValid,
          chain_valid: chainValid,
        },
      });
    }
  );

  // GET /v1/snapshots?evidence_ref=... - Get snapshots by decision ref
  // GET /v1/snapshots?evidence_type=...&captured_after=...&captured_before=...&limit=...
  fastify.get<{
    Querystring: {
      evidence_ref?: string;
      evidence_type?: string;
      /** @deprecated use evidence_ref */
      decision_ref?: string;
      /** @deprecated use evidence_type */
      decision_type?: string;
      captured_after?: string;
      captured_before?: string;
      limit?: string;
    };
    Reply:
      | { component: 'StateMirror'; version: string; snapshots: SnapshotFullResponse[]; count: number }
      | { error: string; message: string };
  }>(
    '/v1/snapshots',
    {
      preHandler: readAuth,
    },
    async (request, reply) => {
      const rawQuery: any = request.query as any;

      const evidence_ref =
        typeof rawQuery.evidence_ref === 'string'
          ? rawQuery.evidence_ref
          : typeof rawQuery.decision_ref === 'string'
            ? rawQuery.decision_ref
            : undefined;

      const evidence_type =
        typeof rawQuery.evidence_type === 'string'
          ? rawQuery.evidence_type
          : typeof rawQuery.decision_type === 'string'
            ? rawQuery.decision_type
            : undefined;

      const captured_after = rawQuery.captured_after as string | undefined;
      const captured_before = rawQuery.captured_before as string | undefined;
      const limit = rawQuery.limit as string | undefined;

      const pool = getPool();


      if (evidence_ref) {
        // Query by exact evidence_ref
        const result = await pool.query(
          `SELECT * FROM snapshots WHERE evidence_ref = $1 ORDER BY sequence_num DESC`,
          [evidence_ref]
        );

        if (result.rows.length > 100) {
          return reply.status(400).send({
            error: 'Bad Request',
            message:
              'Too many snapshots for this evidence_ref (>100). Use a more specific reference.',
          });
        }

        const snapshots = await Promise.all(
          result.rows.map((row) => formatSnapshotWithIntegrity(row, pool))
        );

        return reply.send({
          component: config.component,
          version: config.version,
          snapshots,
          count: snapshots.length,
        });
      }

      if (evidence_type) {
        // Query by evidence_type with time window
        if (!captured_after || !captured_before) {
          return reply.status(400).send({
            error: 'Bad Request',
            message:
              'captured_after and captured_before are required when querying by evidence_type',
          });
        }

        const afterDate = new Date(captured_after);
        const beforeDate = new Date(captured_before);

        if (isNaN(afterDate.getTime()) || isNaN(beforeDate.getTime())) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'captured_after and captured_before must be valid ISO timestamps',
          });
        }

        // Check 24h window limit
        const windowMs = beforeDate.getTime() - afterDate.getTime();
        if (windowMs > 24 * 60 * 60 * 1000) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Time window cannot exceed 24 hours',
          });
        }

        if (windowMs < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'captured_after must be before captured_before',
          });
        }

        const limitNum = Math.min(parseInt(limit || '100', 10), 100);
        if (isNaN(limitNum) || limitNum < 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'limit must be a positive integer <= 100',
          });
        }

        const result = await pool.query(
          `SELECT * FROM snapshots 
           WHERE evidence_type = $1 
             AND captured_at >= $2 
             AND captured_at < $3
           ORDER BY captured_at DESC
           LIMIT $4`,
          [evidence_type, afterDate, beforeDate, limitNum]
        );

        const snapshots = await Promise.all(
          result.rows.map((row) => formatSnapshotWithIntegrity(row, pool))
        );

        return reply.send({
          component: config.component,
          version: config.version,
          snapshots,
          count: snapshots.length,
        });
      }

      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Either evidence_ref or evidence_type query parameter is required',
      });
    }
  );
}

async function formatSnapshotWithIntegrity(
  row: SnapshotRecord,
  pool: ReturnType<typeof getPool>
): Promise<SnapshotFullResponse> {
  // Verify payload integrity
  const recomputedPayloadHash = hashPayload(row.state_payload);
  const payloadValid = buffersEqual(recomputedPayloadHash, row.payload_hash);

  // Verify chain link (simplified - just check structure)
  let chainValid = true;
  const sequenceNum = BigInt(row.sequence_num);

  if (sequenceNum === 1n) {
    chainValid = row.prev_chain_hash === null;
  } else {
    const prevResult = await pool.query(
      `SELECT chain_hash FROM snapshots WHERE sequence_num = $1`,
      [(sequenceNum - 1n).toString()]
    );

    if (prevResult.rows.length === 0) {
      chainValid = false;
    } else if (row.prev_chain_hash === null) {
      chainValid = false;
    } else {
      chainValid = buffersEqual(prevResult.rows[0].chain_hash, row.prev_chain_hash);
    }
  }

  if (chainValid) {
    const expectedChainHash = computeChainHash(
      sequenceNum,
      row.payload_hash,
      row.prev_chain_hash
    );
    chainValid = buffersEqual(expectedChainHash, row.chain_hash);
  }

  return {
    snapshot_id: row.snapshot_id,
    sequence_num: parseInt(row.sequence_num, 10),
    evidence_ref: row.evidence_ref,
    evidence_type: row.evidence_type,
    captured_at: row.captured_at.toISOString(),
    received_at: row.received_at.toISOString(),
    state_payload: row.state_payload,
    payload_hash: toBase64(row.payload_hash),
    chain_hash: toBase64(row.chain_hash),
    source_system: row.source_system,
    source_version: row.source_version,
    correlation_id: row.correlation_id,
    integrity: {
      payload_valid: payloadValid,
      chain_valid: chainValid,
    },
  };
}
