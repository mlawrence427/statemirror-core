import "dotenv/config";
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // Get applied migrations
    const { rows: applied } = await pool.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    const appliedSet = new Set(applied.map((r) => r.version));

    // Find migration files
    const migrationsDir = join(__dirname, '../../migrations');
    let files: string[];
    try {
      files = readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    } catch {
      // When running from dist, migrations is at project root
      const altDir = join(__dirname, '../../../migrations');
      files = readdirSync(altDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();
    }

    // Determine correct migrations directory
    let actualMigrationsDir = migrationsDir;
    try {
      readdirSync(migrationsDir);
    } catch {
      actualMigrationsDir = join(__dirname, '../../../migrations');
    }

    // Apply pending migrations
    for (const file of files) {
      const version = file.replace('.sql', '');
      if (appliedSet.has(version)) {
        console.log(`Migration ${version} already applied, skipping`);
        continue;
      }

      console.log(`Applying migration ${version}...`);
      const sql = readFileSync(join(actualMigrationsDir, file), 'utf8');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1)',
          [version]
        );
        await client.query('COMMIT');
        console.log(`Migration ${version} applied successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('All migrations applied');
  } finally {
    await pool.end();
  }
}

// Run if executed directly
migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
