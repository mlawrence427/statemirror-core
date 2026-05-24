import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { getPool } from '../db/client.js';
import { createReadAuthHook } from '../lib/auth.js';
import { computeChainHash, toBase64, buffersEqual, hashPayload } from '../lib/hash.js';
import type { IntegrityVerifyInput, IntegrityVerifyResponse } from '../types/index.js';

export async function integrityRoutes(fastify: FastifyInstance, config: Config) {
  const readAuth = createReadAuthHook(config);

  fastify.post<{
    Body: IntegrityVerifyInput;
    Reply: IntegrityVerifyResponse | { error: string; message: string };
  }>(
    '/v1/integrity/verify',
    {
      preHandler: readAuth,
    },
    async (request, reply) => {
      const { from_sequence, to_sequence } = request.body;

      // Validate input
      if (
        typeof from_sequence !== 'number' ||
        typeof to_sequence !== 'number' ||
        !Number.isInteger(from_sequence) ||
        !Number.isInteger(to_sequence)
      ) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'from_sequence and to_sequence must be integers',
        });
      }

      if (from_sequence < 1) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'from_sequence must be >= 1',
        });
      }

      if (to_sequence < from_sequence) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'to_sequence must be >= from_sequence',
        });
      }

      const startTime = Date.now();
      const pool = getPool();

      // Fetch all records in range
      const result = await pool.query(
        `SELECT sequence_num, state_payload, payload_hash, prev_chain_hash, chain_hash
         FROM snapshots
         WHERE sequence_num >= $1 AND sequence_num <= $2
         ORDER BY sequence_num ASC`,
        [from_sequence, to_sequence]
      );

      if (result.rows.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No snapshots found in the specified range',
        });
      }

      // If from_sequence > 1, we need the predecessor for chain verification
      let predecessorChainHash: Buffer | null = null;
      if (from_sequence > 1) {
        const predResult = await pool.query(
          `SELECT chain_hash FROM snapshots WHERE sequence_num = $1`,
          [from_sequence - 1]
        );
        if (predResult.rows.length > 0) {
          predecessorChainHash = predResult.rows[0].chain_hash;
        }
      }

      let checkedCount = 0;
      let expectedPrevHash = predecessorChainHash;

      for (const row of result.rows) {
        const sequenceNum = BigInt(row.sequence_num);
        checkedCount++;

        // Verify payload hash
        const recomputedPayloadHash = hashPayload(row.state_payload);
        if (!buffersEqual(recomputedPayloadHash, row.payload_hash)) {
          return reply.send({
            component: config.component,
            version: config.version,
            valid: false,
            checked_count: checkedCount,
            first_sequence: from_sequence,
            last_sequence: parseInt(row.sequence_num, 10),
            elapsed_ms: Date.now() - startTime,
            break_at_sequence: parseInt(row.sequence_num, 10),
            expected_prev_hash: 'payload_hash_mismatch',
            actual_prev_hash: toBase64(row.payload_hash),
          });
        }

        // Verify prev_chain_hash link
        if (sequenceNum === 1n) {
          if (row.prev_chain_hash !== null) {
            return reply.send({
            component: config.component,
            version: config.version,
              valid: false,
              checked_count: checkedCount,
              first_sequence: from_sequence,
              last_sequence: 1,
              elapsed_ms: Date.now() - startTime,
              break_at_sequence: 1,
              expected_prev_hash: 'null',
              actual_prev_hash: toBase64(row.prev_chain_hash),
            });
          }
        } else {
          // For records after the first in our range
          if (expectedPrevHash !== null) {
            if (row.prev_chain_hash === null) {
              return reply.send({
            component: config.component,
            version: config.version,
                valid: false,
                checked_count: checkedCount,
                first_sequence: from_sequence,
                last_sequence: parseInt(row.sequence_num, 10),
                elapsed_ms: Date.now() - startTime,
                break_at_sequence: parseInt(row.sequence_num, 10),
                expected_prev_hash: toBase64(expectedPrevHash),
                actual_prev_hash: 'null',
              });
            }

            if (!buffersEqual(row.prev_chain_hash, expectedPrevHash)) {
              return reply.send({
            component: config.component,
            version: config.version,
                valid: false,
                checked_count: checkedCount,
                first_sequence: from_sequence,
                last_sequence: parseInt(row.sequence_num, 10),
                elapsed_ms: Date.now() - startTime,
                break_at_sequence: parseInt(row.sequence_num, 10),
                expected_prev_hash: toBase64(expectedPrevHash),
                actual_prev_hash: toBase64(row.prev_chain_hash),
              });
            }
          }
        }

        // Verify chain_hash computation
        const expectedChainHash = computeChainHash(
          sequenceNum,
          row.payload_hash,
          row.prev_chain_hash
        );

        if (!buffersEqual(expectedChainHash, row.chain_hash)) {
          return reply.send({
            component: config.component,
            version: config.version,
            valid: false,
            checked_count: checkedCount,
            first_sequence: from_sequence,
            last_sequence: parseInt(row.sequence_num, 10),
            elapsed_ms: Date.now() - startTime,
            break_at_sequence: parseInt(row.sequence_num, 10),
            expected_prev_hash: toBase64(expectedChainHash),
            actual_prev_hash: toBase64(row.chain_hash),
          });
        }

        // Update expected prev hash for next iteration
        expectedPrevHash = row.chain_hash;
      }

      // Check for gaps in sequence
      const expectedCount = to_sequence - from_sequence + 1;
      if (result.rows.length < expectedCount) {
        // Find the gap
        let expectedSeq = from_sequence;
        for (const row of result.rows) {
          const actualSeq = parseInt(row.sequence_num, 10);
          if (actualSeq !== expectedSeq) {
            return reply.send({
            component: config.component,
            version: config.version,
              valid: false,
              checked_count: checkedCount,
              first_sequence: from_sequence,
              last_sequence: actualSeq,
              elapsed_ms: Date.now() - startTime,
              break_at_sequence: expectedSeq,
              expected_prev_hash: `sequence_gap_at_${expectedSeq}`,
              actual_prev_hash: `found_${actualSeq}`,
            });
          }
          expectedSeq++;
        }
      }

      return reply.send({
            component: config.component,
            version: config.version,
        valid: true,
        checked_count: checkedCount,
        first_sequence: parseInt(result.rows[0].sequence_num, 10),
        last_sequence: parseInt(result.rows[result.rows.length - 1].sequence_num, 10),
        elapsed_ms: Date.now() - startTime,
      });
    }
  );
}
