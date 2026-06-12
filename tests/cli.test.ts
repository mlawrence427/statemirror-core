import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  buildExportPayload,
  findEvidenceLaneTypes,
  formatInspectPretty,
  formatVerificationPretty,
  parseCliArgs,
  type SerializedSnapshot,
} from '../dist/cli.js';

const snapshot: SerializedSnapshot = {
  snapshot_id: 'snapshot-1',
  sequence_num: 1,
  evidence_ref: 'decision:user_123:req_001',
  evidence_type: 'evidence_lanes_decision_audit',
  captured_at: '2025-12-01T18:44:22.000Z',
  received_at: '2025-12-01T18:44:23.000Z',
  state_payload: {
    inputs: {
      plan: { evidence_type: 'plan_evidence' },
      denial: { evidence_type: 'denial_evidence' },
    },
  },
  payload_hash: 'payload_hash',
  prev_chain_hash: null,
  chain_hash: 'chain_hash',
  source_system: 'application-api',
  source_version: '1.0.0',
  correlation_id: 'req_001',
};

describe('CLI helpers', () => {
  test('CLI verify pretty output includes integrity status', () => {
    const output = formatVerificationPretty({
      valid: true,
      message: 'Preserved evidence integrity verified.',
      snapshot_id: 'snapshot-1',
      sequence_num: 1,
    });

    assert.match(output, /Verification: valid/);
    assert.match(output, /Snapshot id: snapshot-1/);
  });

  test('CLI verify JSON options parse', () => {
    const options = parseCliArgs([
      'verify',
      '--snapshot-id',
      'snapshot-1',
      '--json',
      '--pretty',
    ]);

    assert.strictEqual(options.command, 'verify');
    assert.strictEqual(options.snapshotId, 'snapshot-1');
    assert.strictEqual(options.json, true);
    assert.strictEqual(options.pretty, true);
  });

  test('CLI help says verification is integrity-only', () => {
    assert.throws(
      () => parseCliArgs(['--help']),
      /preserved evidence integrity only[\s\S]*does not prove decision correctness/
    );
  });

  test('CLI inspect output includes lanes and hashes', () => {
    const output = formatInspectPretty({
      snapshot,
      verification: {
        valid: true,
        message: 'Preserved evidence integrity verified.',
      },
      hasIdempotencyRecord: true,
    });

    assert.match(output, /Evidence type: evidence_lanes_decision_audit/);
    assert.match(output, /Evidence lanes: plan_evidence, denial_evidence/);
    assert.match(output, /Payload hash: payload_hash/);
  });

  test('CLI export single snapshot payload', () => {
    const output = buildExportPayload({
      snapshots: [snapshot],
      single: true,
    });

    assert.deepStrictEqual(output, { snapshot });
  });

  test('CLI export range payload', () => {
    const output = buildExportPayload({
      snapshots: [snapshot, { ...snapshot, snapshot_id: 'snapshot-2', sequence_num: 2 }],
      single: false,
    });

    assert.strictEqual(output.count, 2);
    assert.strictEqual(Array.isArray(output.snapshots), true);
  });

  test('export with verification metadata', () => {
    const output = buildExportPayload({
      snapshots: [snapshot],
      single: true,
      verification: {
        valid: true,
        message: 'Preserved evidence integrity verified.',
      },
    });

    assert.deepStrictEqual(output.verification, {
      valid: true,
      message: 'Preserved evidence integrity verified.',
    });
  });

  test('detects evidence lane types in state_payload.inputs', () => {
    assert.deepStrictEqual(findEvidenceLaneTypes(snapshot.state_payload), [
      'plan_evidence',
      'denial_evidence',
    ]);
  });
});
