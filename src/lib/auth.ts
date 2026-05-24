import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../config.js';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Create auth hook for read operations
 */
export function createReadAuthHook(config: Config) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request);
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <api_key>',
      });
    }

    // Accept either read or write keys for read operations
    if (!config.readApiKeys.has(token) && !config.writeApiKeys.has(token)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }
  };
}

/**
 * Create auth hook for write operations
 */
export function createWriteAuthHook(config: Config) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractBearerToken(request);
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Expected: Bearer <api_key>',
      });
    }

    // Only write keys for write operations
    if (!config.writeApiKeys.has(token)) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key or insufficient permissions',
      });
    }
  };
}
