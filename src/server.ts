import Fastify from 'fastify';
import type { Config } from './config.js';
import { healthRoutes } from './routes/health.js';
import { snapshotRoutes } from './routes/snapshots.js';
import { integrityRoutes } from './routes/integrity.js';

export async function buildServer(config: Config) {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
    requestTimeout: 30000,
  });

  // Register routes
  await fastify.register(healthRoutes, config);
  await fastify.register(snapshotRoutes, config);
  await fastify.register(integrityRoutes, config);

  // Global error handler
  fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: error.message,
      });
    }

    // Don't leak internal errors
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  return fastify;
}
