import { buffersEqual, computeChainHash, hashPayload, toBase64 } from './hash.js';

export type VerificationFailureCode =
  | 'PAYLOAD_HASH_MISMATCH'
  | 'PREV_CHAIN_HASH_MISMATCH'
  | 'CHAIN_HASH_MISMATCH'
  | 'SEQUENCE_GAP'
  | 'SNAPSHOT_NOT_FOUND'
  | 'MALFORMED_SNAPSHOT'
  | 'VERIFY_RANGE_INVALID';

export interface VerificationResult {
  valid: boolean;
  failure_code?: VerificationFailureCode;
  message: string;
  snapshot_id?: string;
  sequence_num?: number;
  break_at_sequence?: number;
  expected?: string;
  actual?: string;
}

export interface ChainVerificationResult extends VerificationResult {
  checked_count: number;
  first_sequence?: number;
  last_sequence?: number;
}

export interface VerifiableSnapshot {
  snapshot_id?: string | null;
  sequence_num: string | number | bigint | null;
  state_payload: Record<string, unknown> | null;
  payload_hash: Buffer | null;
  prev_chain_hash: Buffer | null;
  chain_hash: Buffer | null;
}

export interface VerifySnapshotOptions {
  expectedPrevChainHash?: Buffer | null;
  requirePreviousLink?: boolean;
}

export interface VerifySnapshotChainOptions {
  from_sequence: number;
  to_sequence: number;
  predecessorChainHash?: Buffer | null;
}

function parseSequence(value: string | number | bigint | null): bigint | null {
  try {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
    if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
    return null;
  } catch {
    return null;
  }
}

function sequenceToNumber(sequence: bigint): number {
  return Number(sequence);
}

function isHash(value: Buffer | null): value is Buffer {
  return Buffer.isBuffer(value) && value.length === 32;
}

function encodeHash(value: Buffer | null): string {
  return value === null ? 'null' : toBase64(value);
}

function malformed(row: VerifiableSnapshot): VerificationResult | null {
  const sequence = parseSequence(row.sequence_num);
  if (sequence === null || sequence < 1n) {
    return {
      valid: false,
      failure_code: 'MALFORMED_SNAPSHOT',
      message: 'Snapshot sequence number is missing or malformed.',
      snapshot_id: row.snapshot_id ?? undefined,
    };
  }

  if (!row.state_payload || typeof row.state_payload !== 'object') {
    return {
      valid: false,
      failure_code: 'MALFORMED_SNAPSHOT',
      message: 'Snapshot payload is missing or malformed.',
      snapshot_id: row.snapshot_id ?? undefined,
      sequence_num: sequenceToNumber(sequence),
    };
  }

  if (!isHash(row.payload_hash) || !isHash(row.chain_hash)) {
    return {
      valid: false,
      failure_code: 'MALFORMED_SNAPSHOT',
      message: 'Snapshot hash fields are missing or malformed.',
      snapshot_id: row.snapshot_id ?? undefined,
      sequence_num: sequenceToNumber(sequence),
    };
  }

  if (row.prev_chain_hash !== null && !isHash(row.prev_chain_hash)) {
    return {
      valid: false,
      failure_code: 'MALFORMED_SNAPSHOT',
      message: 'Snapshot previous chain hash is malformed.',
      snapshot_id: row.snapshot_id ?? undefined,
      sequence_num: sequenceToNumber(sequence),
    };
  }

  return null;
}

export function verifySnapshot(
  row: VerifiableSnapshot | null | undefined,
  options: VerifySnapshotOptions = {}
): VerificationResult {
  if (!row) {
    return {
      valid: false,
      failure_code: 'SNAPSHOT_NOT_FOUND',
      message: 'Snapshot was not found.',
    };
  }

  const malformedResult = malformed(row);
  if (malformedResult) return malformedResult;

  const sequence = parseSequence(row.sequence_num) as bigint;
  const sequenceNum = sequenceToNumber(sequence);
  const snapshot_id = row.snapshot_id ?? undefined;

  const recomputedPayloadHash = hashPayload(row.state_payload as Record<string, unknown>);
  if (!buffersEqual(recomputedPayloadHash, row.payload_hash as Buffer)) {
    return {
      valid: false,
      failure_code: 'PAYLOAD_HASH_MISMATCH',
      message: 'Stored payload hash does not match recomputed payload hash.',
      snapshot_id,
      sequence_num: sequenceNum,
      break_at_sequence: sequenceNum,
      expected: toBase64(recomputedPayloadHash),
      actual: encodeHash(row.payload_hash),
    };
  }

  if (sequence === 1n && row.prev_chain_hash !== null) {
    return {
      valid: false,
      failure_code: 'PREV_CHAIN_HASH_MISMATCH',
      message: 'First snapshot should not have a previous chain hash.',
      snapshot_id,
      sequence_num: sequenceNum,
      break_at_sequence: sequenceNum,
      expected: 'null',
      actual: encodeHash(row.prev_chain_hash),
    };
  }

  if (options.requirePreviousLink && sequence > 1n) {
    if (options.expectedPrevChainHash === undefined) {
      return {
        valid: false,
        failure_code: 'SEQUENCE_GAP',
        message: `Chain link is broken at sequence ${sequenceNum}.`,
        snapshot_id,
        sequence_num: sequenceNum,
        break_at_sequence: sequenceNum - 1,
        expected: `sequence_${sequenceNum - 1}`,
        actual: 'missing',
      };
    }

    const expectedPrevChainHash = options.expectedPrevChainHash;
    if (expectedPrevChainHash === null) {
      return {
        valid: false,
        failure_code: 'PREV_CHAIN_HASH_MISMATCH',
        message: `Chain link is broken at sequence ${sequenceNum}.`,
        snapshot_id,
        sequence_num: sequenceNum,
        break_at_sequence: sequenceNum,
        expected: 'previous_chain_hash',
        actual: encodeHash(row.prev_chain_hash),
      };
    }

    if (!row.prev_chain_hash || !buffersEqual(row.prev_chain_hash, expectedPrevChainHash)) {
      return {
        valid: false,
        failure_code: 'PREV_CHAIN_HASH_MISMATCH',
        message: `Chain link is broken at sequence ${sequenceNum}.`,
        snapshot_id,
        sequence_num: sequenceNum,
        break_at_sequence: sequenceNum,
        expected: encodeHash(expectedPrevChainHash),
        actual: encodeHash(row.prev_chain_hash),
      };
    }
  }

  const expectedChainHash = computeChainHash(
    sequence,
    row.payload_hash as Buffer,
    row.prev_chain_hash
  );
  if (!buffersEqual(expectedChainHash, row.chain_hash as Buffer)) {
    return {
      valid: false,
      failure_code: 'CHAIN_HASH_MISMATCH',
      message: 'Stored chain hash does not match recomputed chain hash.',
      snapshot_id,
      sequence_num: sequenceNum,
      break_at_sequence: sequenceNum,
      expected: toBase64(expectedChainHash),
      actual: encodeHash(row.chain_hash),
    };
  }

  return {
    valid: true,
    message: 'Preserved evidence integrity verified.',
    snapshot_id,
    sequence_num: sequenceNum,
  };
}

export function verifySnapshotChain(
  rows: VerifiableSnapshot[],
  options: VerifySnapshotChainOptions
): ChainVerificationResult {
  const { from_sequence, to_sequence } = options;

  if (
    !Number.isInteger(from_sequence) ||
    !Number.isInteger(to_sequence) ||
    from_sequence < 1 ||
    to_sequence < from_sequence
  ) {
    return {
      valid: false,
      failure_code: 'VERIFY_RANGE_INVALID',
      message: 'Verification range must use integer sequence numbers with to_sequence >= from_sequence.',
      checked_count: 0,
      first_sequence: from_sequence,
      last_sequence: to_sequence,
    };
  }

  if (rows.length === 0) {
    return {
      valid: false,
      failure_code: 'SNAPSHOT_NOT_FOUND',
      message: 'No snapshots were found in the requested verification range.',
      checked_count: 0,
      first_sequence: from_sequence,
      last_sequence: to_sequence,
    };
  }

  let checkedCount = 0;
  let expectedSequence = from_sequence;
  let expectedPrevHash = options.predecessorChainHash;

  if (from_sequence === 1) {
    expectedPrevHash = null;
  } else if (expectedPrevHash === undefined) {
    return {
      valid: false,
      failure_code: 'SEQUENCE_GAP',
      message: `Chain link is broken at sequence ${from_sequence}.`,
      checked_count: 0,
      first_sequence: from_sequence,
      last_sequence: to_sequence,
      break_at_sequence: from_sequence - 1,
      expected: `sequence_${from_sequence - 1}`,
      actual: 'missing',
    };
  }

  for (const row of rows) {
    const sequence = parseSequence(row.sequence_num);
    if (sequence === null) {
      const result = verifySnapshot(row);
      return {
        ...result,
        checked_count: checkedCount,
        first_sequence: from_sequence,
        last_sequence: to_sequence,
      };
    }

    const actualSequence = sequenceToNumber(sequence);
    if (actualSequence !== expectedSequence) {
      return {
        valid: false,
        failure_code: 'SEQUENCE_GAP',
        message: `Chain link is broken at sequence ${expectedSequence}.`,
        checked_count: checkedCount,
        first_sequence: from_sequence,
        last_sequence: actualSequence,
        break_at_sequence: expectedSequence,
        expected: `sequence_${expectedSequence}`,
        actual: `sequence_${actualSequence}`,
      };
    }

    const result = verifySnapshot(row, {
      expectedPrevChainHash: expectedPrevHash,
      requirePreviousLink: true,
    });
    checkedCount++;

    if (!result.valid) {
      return {
        ...result,
        checked_count: checkedCount,
        first_sequence: from_sequence,
        last_sequence: actualSequence,
      };
    }

    expectedPrevHash = row.chain_hash;
    expectedSequence++;
  }

  if (expectedSequence <= to_sequence) {
    return {
      valid: false,
      failure_code: 'SEQUENCE_GAP',
      message: `Chain link is broken at sequence ${expectedSequence}.`,
      checked_count: checkedCount,
      first_sequence: from_sequence,
      last_sequence: expectedSequence - 1,
      break_at_sequence: expectedSequence,
      expected: `sequence_${expectedSequence}`,
      actual: 'missing',
    };
  }

  return {
    valid: true,
    message: 'Preserved evidence chain integrity verified.',
    checked_count: checkedCount,
    first_sequence: from_sequence,
    last_sequence: to_sequence,
  };
}
