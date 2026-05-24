#!/usr/bin/env bash
set -euo pipefail

# Configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
WRITE_KEY="${WRITE_KEY:-smw_test_write_key_456}"
READ_KEY="${READ_KEY:-smr_test_read_key_123}"

echo "=== StateMirror Smoke Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Health check
echo "1. Health check..."
curl -s "$BASE_URL/v1/health" | jq .
echo ""

# Create a snapshot
IDEM_KEY="smoke-test-$(date +%s)-$RANDOM"
echo "2. Creating snapshot (idempotency key: $IDEM_KEY)..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/v1/snapshots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WRITE_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{
    "evidence_ref": "smoke-test:user:12345",
    "evidence_type": "smoke_test",
    "captured_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "state_payload": {
      "user_id": "12345",
      "action": "test_action",
      "computed_score": 0.85,
      "flags": ["flag_a", "flag_b"]
    },
    "source_system": "smoke-test",
    "source_version": "1.0.0",
    "correlation_id": "trace-smoke-001"
  }')
echo "$CREATE_RESPONSE" | jq .
SNAPSHOT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.snapshot_id')
echo "Snapshot ID: $SNAPSHOT_ID"
echo ""

# Idempotent replay (should return 200 with same data)
echo "3. Idempotent replay (same key, same payload)..."
REPLAY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/snapshots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WRITE_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{
    "evidence_ref": "smoke-test:user:12345",
    "evidence_type": "smoke_test",
    "captured_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "state_payload": {
      "user_id": "12345",
      "action": "test_action",
      "computed_score": 0.85,
      "flags": ["flag_a", "flag_b"]
    },
    "source_system": "smoke-test",
    "source_version": "1.0.0",
    "correlation_id": "trace-smoke-001"
  }')
HTTP_CODE=$(echo "$REPLAY_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$REPLAY_RESPONSE" | grep -v "HTTP_CODE:")
echo "HTTP Status: $HTTP_CODE (expected: 200)"
echo "$BODY" | jq .
echo ""

# Conflict detection (same key, different payload)
echo "4. Conflict detection (same key, different payload)..."
CONFLICT_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$BASE_URL/v1/snapshots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WRITE_KEY" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{
    "evidence_ref": "smoke-test:user:12345",
    "evidence_type": "smoke_test",
    "captured_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "state_payload": {
      "user_id": "12345",
      "action": "DIFFERENT_ACTION",
      "computed_score": 0.99
    },
    "source_system": "smoke-test"
  }')
HTTP_CODE=$(echo "$CONFLICT_RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$CONFLICT_RESPONSE" | grep -v "HTTP_CODE:")
echo "HTTP Status: $HTTP_CODE (expected: 409)"
echo "$BODY" | jq .
echo ""

# Read back snapshot
echo "5. Reading snapshot by ID..."
curl -s "$BASE_URL/v1/snapshots/$SNAPSHOT_ID" \
  -H "Authorization: Bearer $READ_KEY" | jq .
echo ""

# Query by evidence_ref
echo "6. Query by evidence_ref..."
curl -s "$BASE_URL/v1/snapshots?evidence_ref=smoke-test:user:12345" \
  -H "Authorization: Bearer $READ_KEY" | jq .
echo ""

# Create another snapshot for integrity verification
IDEM_KEY2="smoke-test-$(date +%s)-$RANDOM"
echo "7. Creating second snapshot for chain verification..."
curl -s -X POST "$BASE_URL/v1/snapshots" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $WRITE_KEY" \
  -H "Idempotency-Key: $IDEM_KEY2" \
  -d '{
    "evidence_ref": "smoke-test:user:67890",
    "evidence_type": "smoke_test",
    "captured_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
    "state_payload": {
      "user_id": "67890",
      "action": "second_test"
    }
  }' | jq .
echo ""

# Verify integrity
echo "8. Verifying chain integrity..."
curl -s -X POST "$BASE_URL/v1/integrity/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $READ_KEY" \
  -d '{
    "from_sequence": 1,
    "to_sequence": 2
  }' | jq .
echo ""

# Test auth failure
echo "9. Testing auth failure (wrong key)..."
AUTH_FAIL=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$BASE_URL/v1/snapshots/$SNAPSHOT_ID" \
  -H "Authorization: Bearer wrong_key")
HTTP_CODE=$(echo "$AUTH_FAIL" | grep "HTTP_CODE:" | cut -d: -f2)
BODY=$(echo "$AUTH_FAIL" | grep -v "HTTP_CODE:")
echo "HTTP Status: $HTTP_CODE (expected: 401)"
echo "$BODY" | jq .
echo ""

echo "=== Smoke Tests Complete ==="
