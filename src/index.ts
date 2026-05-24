import "dotenv/config";
import { loadConfig } from './config.js';
import { buildServer } from './server.js';
import { initPool, closePool, getPool } from './db/client.js';

async function main() {
  const config = loadConfig();

  // Initialize database connection
  console.log('Connecting to database...');
  await initPool(config.databaseUrl);
  console.log('Database connected');

  // Optional: cleanup expired idempotency keys on startup
  if (config.cleanupOnStartup) {
    try {
      const pool = getPool();
      const result = await pool.query(
        `DELETE FROM idempotency_keys WHERE expires_at < now()`
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} expired idempotency keys`);
      }
    } catch (error) {
      // Table might not exist yet if migrations haven't run
      console.log('Skipping idempotency cleanup (table may not exist yet)');
    }
  }

  // Build and start server
  const server = await buildServer(config);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    await server.close();
    await closePool();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`StateMirror listening on port ${config.port}`);
  } catch (error) {
    server.log.error(error);
    await closePool();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
