import type { FastifyInstance } from 'fastify';
import { getPool } from '../db/client.js';
import type { HealthResponse } from '../types/index.js';

export async function healthRoutes(fastify: FastifyInstance, config: { component: 'StateMirror'; version: string }) {
  fastify.get<{ Reply: HealthResponse }>(
    '/v1/health',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              component: { type: 'string' },
              version: { type: 'string' },
              status: { type: 'string' },
              database: { type: 'string' },
              latest_sequence: { type: ['number', 'null'] },
              latest_received_at: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
    async (request, reply) => {
      let dbStatus: 'connected' | 'disconnected' = 'disconnected';
      let latestSequence: number | null = null;
      let latestReceivedAt: string | null = null;

      try {
        const pool = getPool();
        const result = await pool.query(`
          SELECT sequence_num, received_at 
          FROM snapshots 
          ORDER BY sequence_num DESC 
          LIMIT 1
        `);

        dbStatus = 'connected';
        if (result.rows.length > 0) {
          latestSequence = parseInt(result.rows[0].sequence_num, 10);
          latestReceivedAt = result.rows[0].received_at.toISOString();
        }
      } catch (error) {
        fastify.log.error(error, 'Health check database query failed');
      }

      return reply.send({
        component: config.component,
        version: config.version,
        status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
        database: dbStatus,
        latest_sequence: latestSequence,
        latest_received_at: latestReceivedAt,
      });
    }
  );
}
