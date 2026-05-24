export interface Config {
  component: 'StateMirror';
  version: string;
  databaseUrl: string;
  port: number;
  maxPayloadBytes: number;
  readApiKeys: Set<string>;
  writeApiKeys: Set<string>;
  logLevel: string;
  cleanupOnStartup: boolean;
}

function parseCommaSeparated(value: string | undefined): Set<string> {
  if (!value || value.trim() === '') {
    return new Set();
  }
  return new Set(
    value
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0)
  );
}

export function loadConfig(): Config {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const readApiKeys = parseCommaSeparated(process.env.READ_API_KEYS);
  const writeApiKeys = parseCommaSeparated(process.env.WRITE_API_KEYS);

  if (readApiKeys.size === 0) {
    throw new Error('READ_API_KEYS environment variable is required (comma-separated)');
  }
  if (writeApiKeys.size === 0) {
    throw new Error('WRITE_API_KEYS environment variable is required (comma-separated)');
  }

  return {
    component: 'StateMirror',
    version: process.env.APP_VERSION || '1.0.0',
    databaseUrl,
    port: parseInt(process.env.PORT || '8080', 10),
    maxPayloadBytes: parseInt(process.env.MAX_PAYLOAD_BYTES || '1048576', 10),
    readApiKeys,
    writeApiKeys,
    logLevel: process.env.LOG_LEVEL || 'info',
    cleanupOnStartup: process.env.CLEANUP_ON_STARTUP === 'true',
  };
}
