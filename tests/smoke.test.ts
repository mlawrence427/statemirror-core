import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const WRITE_KEY = process.env.WRITE_KEY || 'smw_test_write_key_456';
const READ_KEY = process.env.READ_KEY || 'smr_test_read_key_123';

interface SnapshotResponse {
  component: 'StateMirror';
  version: string;
  warnings: string[];
  snapshot_id: string;
  sequence_num: number;
  received_at: string;
  payload_hash: string;
  chain_hash: string;
}

interface HealthResponse {
  component: 'StateMirror';
  version: string;
  status: string;
  database: string;
  latest_sequence: number | null;
  latest_received_at: string | null;
}

describe('StateMirror Smoke Tests', () => {
  let createdSnapshotId: string;
  const idempotencyKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  test('health check returns healthy status', async () => {
    const response = await fetch(`${BASE_URL}/v1/health`);
    assert.strictEqual(response.status, 200);

    const data = (await response.json()) as HealthResponse;
    assert.strictEqual(data.status, 'healthy');
    assert.strictEqual(data.database, 'connected');
  });

  test('create snapshot returns 201', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WRITE_KEY}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        evidence_ref: 'test:unit:smoke',
        evidence_type: 'unit_test',
        captured_at: new Date().toISOString(),
        state_payload: {
          test_id: 'smoke-1',
          value: 42,
          nested: { key: 'value' },
        },
        source_system: 'unit-test',
        correlation_id: 'unit-test-correlation',
      }),
    });

    assert.strictEqual(response.status, 201);

    const data = (await response.json()) as SnapshotResponse;
    assert.ok(data.snapshot_id);
    assert.ok(data.sequence_num > 0);
    assert.ok(data.payload_hash);
    assert.ok(data.chain_hash);

    createdSnapshotId = data.snapshot_id;
  });

  test('idempotent replay returns 200 with same data', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WRITE_KEY}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        evidence_ref: 'test:unit:smoke',
        evidence_type: 'unit_test',
        captured_at: new Date().toISOString(),
        state_payload: {
          test_id: 'smoke-1',
          value: 42,
          nested: { key: 'value' },
        },
        source_system: 'unit-test',
        correlation_id: 'unit-test-correlation',
      }),
    });

    assert.strictEqual(response.status, 200);

    const data = (await response.json()) as SnapshotResponse;
    assert.strictEqual(data.snapshot_id, createdSnapshotId);
  });

  test('conflict detection returns 409', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WRITE_KEY}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        evidence_ref: 'test:unit:smoke',
        evidence_type: 'unit_test',
        captured_at: new Date().toISOString(),
        state_payload: {
          test_id: 'smoke-1',
          value: 999, // Different value!
        },
        source_system: 'unit-test',
      }),
    });

    assert.strictEqual(response.status, 409);
  });

  test('read snapshot by ID returns full data with integrity', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots/${createdSnapshotId}`, {
      headers: {
        Authorization: `Bearer ${READ_KEY}`,
      },
    });

    assert.strictEqual(response.status, 200);

    const data = (await response.json()) as {
      snapshot_id: string;
      state_payload: { test_id: string; value: number };
      integrity: { payload_valid: boolean; chain_valid: boolean };
    };

    assert.strictEqual(data.snapshot_id, createdSnapshotId);
    assert.strictEqual(data.state_payload.test_id, 'smoke-1');
    assert.strictEqual(data.state_payload.value, 42);
    assert.strictEqual(data.integrity.payload_valid, true);
    assert.strictEqual(data.integrity.chain_valid, true);
  });

  test('query by evidence_ref returns results', async () => {
    const response = await fetch(
      `${BASE_URL}/v1/snapshots?evidence_ref=test:unit:smoke`,
      {
        headers: {
          Authorization: `Bearer ${READ_KEY}`,
        },
      }
    );

    assert.strictEqual(response.status, 200);

    const data = (await response.json()) as { snapshots: unknown[]; count: number };
    assert.ok(data.count >= 1);
    assert.ok(data.snapshots.length >= 1);
  });

  test('unauthorized request returns 401', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots/${createdSnapshotId}`, {
      headers: {
        Authorization: 'Bearer invalid_key',
      },
    });

    assert.strictEqual(response.status, 401);
  });

  test('missing idempotency key returns 400', async () => {
    const response = await fetch(`${BASE_URL}/v1/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WRITE_KEY}`,
      },
      body: JSON.stringify({
        evidence_ref: 'test:unit:no-key',
        evidence_type: 'unit_test',
        captured_at: new Date().toISOString(),
        state_payload: { test: true },
      }),
    });

    assert.strictEqual(response.status, 400);
  });

  test('integrity verify returns valid for chain', async () => {
    // Create a second snapshot first
    const newKey = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await fetch(`${BASE_URL}/v1/snapshots`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${WRITE_KEY}`,
        'Idempotency-Key': newKey,
      },
      body: JSON.stringify({
        evidence_ref: 'test:unit:smoke2',
        evidence_type: 'unit_test',
        captured_at: new Date().toISOString(),
        state_payload: { second: true },
      }),
    });

    const response = await fetch(`${BASE_URL}/v1/integrity/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${READ_KEY}`,
      },
      body: JSON.stringify({
        from_sequence: 1,
        to_sequence: 2,
      }),
    });

    assert.strictEqual(response.status, 200);

    const data = (await response.json()) as { valid: boolean; checked_count: number };
    assert.strictEqual(data.valid, true);
    assert.ok(data.checked_count >= 2);
  });
});