#!/usr/bin/env node
import 'dotenv/config';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import type { Config } from './config.js';
import { loadConfig } from './config.js';
import { closePool, getPool, initPool } from './db/client.js';
import { toBase64 } from './lib/hash.js';
import { verifySnapshot, verifySnapshotChain } from './lib/verification.js';
import type {
  ChainVerificationResult,
  VerificationResult,
  VerifiableSnapshot,
} from './lib/verification.js';
import type { SnapshotRecord } from './types/index.js';

type Command = 'verify' | 'inspect' | 'export';

interface CliOptions {
  command: Command;
  snapshotId?: string;
  fromSequence?: number;
  toSequence?: number;
  json: boolean;
  pretty: boolean;
  includeVerification: boolean;
  output?: string;
}

const HELP_TEXT = `Usage: statemirror <verify|inspect|export> [flags]

Local tools for preserved evidence integrity only.
Verification checks payload hashes, chain hashes, chain links, and sequence continuity.
Verification does not prove decision correctness, submitted evidence truth, or policy correctness.

Commands:
  verify   Verify one snapshot or a sequence range
  inspect  Print a readable snapshot summary
  export   Export one snapshot or a sequence range as JSON

Flags:
  --snapshot-id <id>
  --from-sequence <number>
  --to-sequence <number>
  --json
  --pretty
  --include-verification
  --output <path>
`;

export interface SerializedSnapshot {
  snapshot_id: string;
  sequence_num: number;
  evidence_ref: string;
  evidence_type: string;
  captured_at: string;
  received_at: string;
  state_payload: Record<string, unknown>;
  payload_hash: string;
  prev_chain_hash: string | null;
  chain_hash: string;
  source_system: string | null;
  source_version: string | null;
  correlation_id: string | null;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const [commandValue, ...args] = argv;
  if (!commandValue || commandValue === '--help' || commandValue === '-h') {
    throw new Error(HELP_TEXT);
  }

  if (!commandValue || !['verify', 'inspect', 'export'].includes(commandValue)) {
    throw new Error(HELP_TEXT);
  }

  const options: CliOptions = {
    command: commandValue as Command,
    json: false,
    pretty: false,
    includeVerification: false,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = args[index + 1];

    switch (arg) {
      case '--snapshot-id':
        if (!next) throw new Error('--snapshot-id requires a value');
        options.snapshotId = next;
        index++;
        break;
      case '--from-sequence':
        if (!next) throw new Error('--from-sequence requires a value');
        options.fromSequence = parseIntegerFlag('--from-sequence', next);
        index++;
        break;
      case '--to-sequence':
        if (!next) throw new Error('--to-sequence requires a value');
        options.toSequence = parseIntegerFlag('--to-sequence', next);
        index++;
        break;
      case '--json':
        options.json = true;
        break;
      case '--pretty':
        options.pretty = true;
        break;
      case '--include-verification':
        options.includeVerification = true;
        break;
      case '--output':
        if (!next) throw new Error('--output requires a value');
        options.output = next;
        index++;
        break;
      case '--help':
      case '-h':
        throw new Error(HELP_TEXT);
      default:
        throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (options.command === 'inspect' && !options.snapshotId) {
    throw new Error('statemirror inspect requires --snapshot-id');
  }

  if (options.command === 'verify' && !options.snapshotId) {
    requireRange(options);
  }

  if (options.command === 'export' && !options.snapshotId) {
    requireRange(options);
  }

  return options;
}

function parseIntegerFlag(name: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} requires an integer value`);
  }
  return parsed;
}

function requireRange(options: CliOptions) {
  if (options.fromSequence === undefined || options.toSequence === undefined) {
    throw new Error(`${options.command} requires --snapshot-id or --from-sequence and --to-sequence`);
  }
}

function hashOrNull(value: Buffer | null): string | null {
  return value ? toBase64(value) : null;
}

function serializeSnapshot(row: SnapshotRecord): SerializedSnapshot {
  return {
    snapshot_id: row.snapshot_id,
    sequence_num: parseInt(row.sequence_num, 10),
    evidence_ref: row.evidence_ref,
    evidence_type: row.evidence_type,
    captured_at: row.captured_at.toISOString(),
    received_at: row.received_at.toISOString(),
    state_payload: row.state_payload,
    payload_hash: toBase64(row.payload_hash),
    prev_chain_hash: hashOrNull(row.prev_chain_hash),
    chain_hash: toBase64(row.chain_hash),
    source_system: row.source_system,
    source_version: row.source_version,
    correlation_id: row.correlation_id,
  };
}

export function buildExportPayload(args: {
  snapshots: SerializedSnapshot[];
  single: boolean;
  verification?: VerificationResult | ChainVerificationResult;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = args.single
    ? { snapshot: args.snapshots[0] ?? null }
    : { snapshots: args.snapshots, count: args.snapshots.length };

  if (args.verification) {
    payload.verification = args.verification;
  }

  return payload;
}

export function findEvidenceLaneTypes(payload: Record<string, unknown>): string[] {
  const inputs = payload.inputs;
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    return [];
  }

  const lanes: string[] = [];
  for (const value of Object.values(inputs as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const evidenceType = (value as Record<string, unknown>).evidence_type;
      if (typeof evidenceType === 'string') {
        lanes.push(evidenceType);
      }
    }
  }
  return lanes;
}

export function formatVerificationPretty(result: VerificationResult | ChainVerificationResult): string {
  const lines = [
    `Verification: ${result.valid ? 'valid' : 'failed'}`,
    `Message: ${result.message}`,
  ];

  if (result.failure_code) lines.push(`Failure code: ${result.failure_code}`);
  if (result.snapshot_id) lines.push(`Snapshot id: ${result.snapshot_id}`);
  if (result.sequence_num !== undefined) lines.push(`Sequence: ${result.sequence_num}`);
  if (result.break_at_sequence !== undefined) {
    lines.push(`Break at sequence: ${result.break_at_sequence}`);
  }
  if ('checked_count' in result) lines.push(`Checked count: ${result.checked_count}`);
  if (result.expected !== undefined) lines.push(`Expected: ${result.expected}`);
  if (result.actual !== undefined) lines.push(`Actual: ${result.actual}`);

  return `${lines.join('\n')}\n`;
}

export function formatInspectPretty(args: {
  snapshot: SerializedSnapshot;
  verification: VerificationResult;
  hasIdempotencyRecord: boolean;
}): string {
  const lanes = findEvidenceLaneTypes(args.snapshot.state_payload);
  const lines = [
    `Snapshot id: ${args.snapshot.snapshot_id}`,
    `Idempotency key: ${args.hasIdempotencyRecord ? 'present as stored hash' : 'not found'}`,
    `Evidence type: ${args.snapshot.evidence_type}`,
    `Evidence lanes: ${lanes.length > 0 ? lanes.join(', ') : 'none detected'}`,
    `Captured at: ${args.snapshot.captured_at}`,
    `Sequence: ${args.snapshot.sequence_num}`,
    `Payload hash: ${args.snapshot.payload_hash}`,
    `Previous chain hash: ${args.snapshot.prev_chain_hash ?? 'null'}`,
    `Chain hash: ${args.snapshot.chain_hash}`,
    `Verification: ${args.verification.valid ? 'valid' : 'failed'}`,
    `Verification message: ${args.verification.message}`,
  ];

  if (args.verification.failure_code) {
    lines.push(`Failure code: ${args.verification.failure_code}`);
  }

  return `${lines.join('\n')}\n`;
}

async function fetchSnapshotById(snapshotId: string): Promise<SnapshotRecord | null> {
  const result = await getPool().query(`SELECT * FROM snapshots WHERE snapshot_id = $1`, [snapshotId]);
  return result.rows.length > 0 ? (result.rows[0] as SnapshotRecord) : null;
}

async function fetchSnapshotsByRange(fromSequence: number, toSequence: number): Promise<SnapshotRecord[]> {
  const result = await getPool().query(
    `SELECT * FROM snapshots
     WHERE sequence_num >= $1 AND sequence_num <= $2
     ORDER BY sequence_num ASC`,
    [fromSequence, toSequence]
  );
  return result.rows as SnapshotRecord[];
}

async function fetchPredecessorHash(fromSequence: number): Promise<Buffer | null | undefined> {
  if (fromSequence === 1) return null;
  const result = await getPool().query(
    `SELECT chain_hash FROM snapshots WHERE sequence_num = $1`,
    [fromSequence - 1]
  );
  return result.rows.length > 0 ? result.rows[0].chain_hash : undefined;
}

async function verifySingleSnapshot(row: SnapshotRecord | null): Promise<VerificationResult> {
  if (!row) return verifySnapshot(null);
  const sequenceNum = parseInt(row.sequence_num, 10);
  const predecessorHash = await fetchPredecessorHash(sequenceNum);
  return verifySnapshot(row, {
    expectedPrevChainHash: predecessorHash,
    requirePreviousLink: true,
  });
}

async function verifyRange(fromSequence: number, toSequence: number): Promise<ChainVerificationResult> {
  const rows = await fetchSnapshotsByRange(fromSequence, toSequence);
  const predecessorChainHash = await fetchPredecessorHash(fromSequence);
  return verifySnapshotChain(rows, {
    from_sequence: fromSequence,
    to_sequence: toSequence,
    predecessorChainHash,
  });
}

async function hasIdempotencyRecord(snapshotId: string): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM idempotency_keys WHERE snapshot_id = $1 LIMIT 1`,
    [snapshotId]
  );
  return result.rows.length > 0;
}

async function writeOutput(text: string, output?: string) {
  if (output) {
    await writeFile(output, text, 'utf8');
  } else {
    process.stdout.write(text);
  }
}

async function handleVerify(options: CliOptions) {
  const result = options.snapshotId
    ? await verifySingleSnapshot(await fetchSnapshotById(options.snapshotId))
    : await verifyRange(options.fromSequence as number, options.toSequence as number);

  const output = options.json
    ? `${JSON.stringify(result, null, options.pretty ? 2 : 0)}\n`
    : formatVerificationPretty(result);
  await writeOutput(output, options.output);
}

async function handleInspect(options: CliOptions) {
  const snapshot = await fetchSnapshotById(options.snapshotId as string);
  if (!snapshot) {
    const result = verifySnapshot(null);
    const output = options.json
      ? `${JSON.stringify(result, null, options.pretty ? 2 : 0)}\n`
      : formatVerificationPretty(result);
    await writeOutput(output, options.output);
    process.exitCode = 1;
    return;
  }

  const verification = await verifySingleSnapshot(snapshot);
  const hasIdempotency = await hasIdempotencyRecord(snapshot.snapshot_id);
  const serialized = serializeSnapshot(snapshot);
  const output = options.json
    ? `${JSON.stringify({ snapshot: serialized, verification, has_idempotency_record: hasIdempotency }, null, options.pretty ? 2 : 0)}\n`
    : formatInspectPretty({ snapshot: serialized, verification, hasIdempotencyRecord: hasIdempotency });
  await writeOutput(output, options.output);
}

async function handleExport(options: CliOptions) {
  const snapshots = options.snapshotId
    ? [await fetchSnapshotById(options.snapshotId)].filter((row): row is SnapshotRecord => row !== null)
    : await fetchSnapshotsByRange(options.fromSequence as number, options.toSequence as number);

  const serialized = snapshots.map(serializeSnapshot);
  const verification = options.includeVerification
    ? options.snapshotId
      ? await verifySingleSnapshot(snapshots[0] ?? null)
      : await verifyRange(options.fromSequence as number, options.toSequence as number)
    : undefined;

  const payload = buildExportPayload({
    snapshots: serialized,
    single: Boolean(options.snapshotId),
    verification,
  });

  await writeOutput(`${JSON.stringify(payload, null, options.pretty ? 2 : 0)}\n`, options.output);
}

export async function runCli(argv: string[], config?: Config) {
  const options = parseCliArgs(argv);
  const runtimeConfig = config ?? loadConfig();
  await initPool(runtimeConfig.databaseUrl);
  try {
    if (options.command === 'verify') await handleVerify(options);
    if (options.command === 'inspect') await handleInspect(options);
    if (options.command === 'export') await handleExport(options);
  } finally {
    await closePool();
  }
}

function isMain() {
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return fileURLToPath(import.meta.url) === invokedPath;
}

if (isMain()) {
  runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown CLI error';
    console.error(message);
    process.exitCode = 1;
  });
}
