import { describe, test } from 'node:test';
import assert from 'node:assert';
import { computeChainHash, hashPayload } from '../dist/lib/hash.js';
import {
  verifySnapshot,
  verifySnapshotChain,
  type VerifiableSnapshot,
} from '../dist/lib/verification.js';

function snapshot(args: {
  id: string;
  sequence: bigint;
  payload: Record<string, unknown>;
  prevChainHash: Buffer | null;
}): VerifiableSnapshot {
  const payloadHash = hashPayload(args.payload);
  return {
    snapshot_id: args.id,
    sequence_num: args.sequence.toString(),
    state_payload: args.payload,
    payload_hash: payloadHash,
    prev_chain_hash: args.prevChainHash,
    chain_hash: computeChainHash(args.sequence, payloadHash, args.prevChainHash),
  };
}

describe('verification library', () => {
  test('valid single snapshot verification', () => {
    const row = snapshot({
      id: 'snapshot-1',
      sequence: 1n,
      payload: { value: 1 },
      prevChainHash: null,
    });

    const result = verifySnapshot(row);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.failure_code, undefined);
  });

  test('tampered payload returns PAYLOAD_HASH_MISMATCH', () => {
    const row = snapshot({
      id: 'snapshot-1',
      sequence: 1n,
      payload: { value: 1 },
      prevChainHash: null,
    });
    row.state_payload = { value: 2 };

    const result = verifySnapshot(row);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'PAYLOAD_HASH_MISMATCH');
  });

  test('broken chain hash returns CHAIN_HASH_MISMATCH', () => {
    const row = snapshot({
      id: 'snapshot-1',
      sequence: 1n,
      payload: { value: 1 },
      prevChainHash: null,
    });
    row.chain_hash = Buffer.alloc(32, 1);

    const result = verifySnapshot(row);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'CHAIN_HASH_MISMATCH');
  });

  test('broken previous hash returns PREV_CHAIN_HASH_MISMATCH', () => {
    const first = snapshot({
      id: 'snapshot-1',
      sequence: 1n,
      payload: { value: 1 },
      prevChainHash: null,
    });
    const second = snapshot({
      id: 'snapshot-2',
      sequence: 2n,
      payload: { value: 2 },
      prevChainHash: Buffer.alloc(32, 9),
    });

    const result = verifySnapshot(second, {
      expectedPrevChainHash: first.chain_hash,
      requirePreviousLink: true,
    });

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'PREV_CHAIN_HASH_MISMATCH');
  });

  test('sequence gap returns SEQUENCE_GAP', () => {
    const first = snapshot({
      id: 'snapshot-1',
      sequence: 1n,
      payload: { value: 1 },
      prevChainHash: null,
    });
    const third = snapshot({
      id: 'snapshot-3',
      sequence: 3n,
      payload: { value: 3 },
      prevChainHash: first.chain_hash,
    });

    const result = verifySnapshotChain([first, third], {
      from_sequence: 1,
      to_sequence: 3,
    });

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'SEQUENCE_GAP');
    assert.strictEqual(result.break_at_sequence, 2);
  });

  test('missing snapshot id returns SNAPSHOT_NOT_FOUND', () => {
    const result = verifySnapshot(null);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'SNAPSHOT_NOT_FOUND');
  });

  test('malformed verify range returns VERIFY_RANGE_INVALID', () => {
    const result = verifySnapshotChain([], {
      from_sequence: 5,
      to_sequence: 4,
    });

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.failure_code, 'VERIFY_RANGE_INVALID');
  });
});
