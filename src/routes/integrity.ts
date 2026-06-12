import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { getPool } from '../db/client.js';
import { createReadAuthHook } from '../lib/auth.js';
import { verifySnapshotChain } from '../lib/verification.js';
import type { IntegrityVerifyInput, IntegrityVerifyResponse } from '../types/index.js';

export async function integrityRoutes(fastify: FastifyInstance, config: Config) {
  const readAuth = createReadAuthHook(config);

  fastify.post<{
    Body: IntegrityVerifyInput;
    Reply: IntegrityVerifyResponse | { error: string; message: string; failure_code?: string };
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
          failure_code: 'VERIFY_RANGE_INVALID',
        });
      }

      if (from_sequence < 1) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'from_sequence must be >= 1',
          failure_code: 'VERIFY_RANGE_INVALID',
        });
      }

      if (to_sequence < from_sequence) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'to_sequence must be >= from_sequence',
          failure_code: 'VERIFY_RANGE_INVALID',
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
          failure_code: 'SNAPSHOT_NOT_FOUND',
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
        } else {
          const verification = verifySnapshotChain(result.rows, {
            from_sequence,
            to_sequence,
          });

          return reply.send({
            component: config.component,
            version: config.version,
            valid: verification.valid,
            checked_count: verification.checked_count,
            first_sequence: verification.first_sequence ?? from_sequence,
            last_sequence: verification.last_sequence ?? to_sequence,
            elapsed_ms: Date.now() - startTime,
            failure_code: verification.failure_code,
            message: verification.message,
            break_at_sequence: verification.break_at_sequence,
            expected: verification.expected,
            actual: verification.actual,
            expected_prev_hash: verification.expected,
            actual_prev_hash: verification.actual,
          });
        }
      }

      const verification = verifySnapshotChain(result.rows, {
        from_sequence,
        to_sequence,
        predecessorChainHash,
      });

      return reply.send({
        component: config.component,
        version: config.version,
        valid: verification.valid,
        checked_count: verification.checked_count,
        first_sequence: verification.first_sequence ?? from_sequence,
        last_sequence: verification.last_sequence ?? to_sequence,
        elapsed_ms: Date.now() - startTime,
        failure_code: verification.failure_code,
        message: verification.message,
        break_at_sequence: verification.break_at_sequence,
        expected: verification.expected,
        actual: verification.actual,
        expected_prev_hash: verification.expected,
        actual_prev_hash: verification.actual,
      });
    }
  );
}
