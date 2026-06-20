# API Reference

StateMirror = decision-time evidence ledger for application systems

The API preserves submitted decision evidence and verifies preservation integrity. It does not decide outcomes, enforce policy, validate correctness, validate upstream truth, execute workflows, or provide observability.

All examples assume:

```txt
Authorization: Bearer <read_or_write_key>
Content-Type: application/json
```

Read endpoints require a read key. Snapshot creation requires a write key.

## POST /v1/snapshots

Creates an immutable evidence snapshot.

Required headers:

- `Authorization: Bearer <write_key>`
- `Idempotency-Key: <stable_retry_key>`
- `Content-Type: application/json`

Required body fields:

- `evidence_ref`: application-owned evidence reference.
- `evidence_type`: application-owned evidence type.
- `captured_at`: ISO timestamp string.
- `state_payload`: JSON object preserved as opaque evidence.

Optional body fields:

- `source_system`
- `source_version`
- `correlation_id`

Deprecated compatibility fields:

- `decision_ref`: accepted as compatibility input for `evidence_ref`.
- `decision_type`: accepted as compatibility input for `evidence_type`.

New integrations should use `evidence_ref` and `evidence_type`.

Example:

```bash
curl -X POST http://localhost:8080/v1/snapshots \
  -H "Authorization: Bearer smw_test_write_key_456" \
  -H "Idempotency-Key: decision-req-001" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_ref": "premium-api:user_123:req_001",
    "evidence_type": "subscription_entitlement_decision",
    "captured_at": "2025-12-01T18:44:22.000Z",
    "state_payload": {
      "subject": "user_123",
      "inputs": {},
      "computed": {
        "decision": "granted"
      }
    }
  }'
```

Expected success:

- `201 Created` for a new snapshot.
- `200 OK` for a retried request with the same idempotency key and identical payload.

Expected failures:

- `400 Bad Request`: missing idempotency key, required field, invalid timestamp, or invalid payload shape.
- `401 Unauthorized`: missing or invalid write key.
- `409 Conflict`: same idempotency key reused with a different payload.
- `413 Payload Too Large`: `state_payload` exceeds `MAX_PAYLOAD_BYTES`.
- `503 Service Unavailable`: database operation failed.

## GET /v1/snapshots/{snapshot_id}

Retrieves one preserved snapshot by ID.

Required headers:

- `Authorization: Bearer <read_key>`

Example:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id> \
  -H "Authorization: Bearer smr_test_read_key_123"
```

Expected success:

- `200 OK` with snapshot fields, preserved `state_payload`, hashes, and an `integrity` summary.

Expected failures:

- `400 Bad Request`: invalid `snapshot_id` format.
- `401 Unauthorized`: missing or invalid read key.
- `404 Not Found`: snapshot does not exist.

## GET /v1/snapshots/{snapshot_id}/verify

Verifies one preserved snapshot.

Verification checks stored payload hash, chain hash, and adjacent chain context where available. It does not prove the original application decision was correct.

Required headers:

- `Authorization: Bearer <read_key>`

Example:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id>/verify \
  -H "Authorization: Bearer smr_test_read_key_123"
```

Expected failures:

- `400 Bad Request`: invalid `snapshot_id` format.
- `401 Unauthorized`: missing or invalid read key.
- `404 Not Found`: snapshot does not exist.

Possible verification failure codes include:

- `SNAPSHOT_NOT_FOUND`
- `PAYLOAD_HASH_MISMATCH`
- `PREV_CHAIN_HASH_MISMATCH`
- `CHAIN_HASH_MISMATCH`
- `SEQUENCE_GAP`
- `MALFORMED_SNAPSHOT`

## GET /v1/snapshots Queries

Retrieves snapshots by existing query paths.

Required headers:

- `Authorization: Bearer <read_key>`

### Query by evidence_ref

```bash
curl "http://localhost:8080/v1/snapshots?evidence_ref=premium-api:user_123:req_001" \
  -H "Authorization: Bearer smr_test_read_key_123"
```

Constraints:

- Exact `evidence_ref` match.
- Results are ordered by descending sequence number.
- More than 100 matching snapshots returns `400 Bad Request` with a message asking for a more specific reference.

Deprecated compatibility field:

- `decision_ref` is accepted as compatibility input for `evidence_ref`.

### Query by evidence_type and captured_at window

```bash
curl "http://localhost:8080/v1/snapshots?evidence_type=subscription_entitlement_decision&captured_after=2025-12-01T00:00:00.000Z&captured_before=2025-12-02T00:00:00.000Z&limit=25" \
  -H "Authorization: Bearer smr_test_read_key_123"
```

Required query parameters:

- `evidence_type`
- `captured_after`
- `captured_before`

Optional query parameter:

- `limit`: positive integer up to `100`; default is `100`.

Constraints:

- `captured_after` and `captured_before` must be valid ISO timestamps.
- The time window cannot exceed 24 hours.
- `captured_after` must be before `captured_before`.

Deprecated compatibility field:

- `decision_type` is accepted as compatibility input for `evidence_type`.

Expected failures:

- `400 Bad Request`: no supported query parameter, invalid timestamps, invalid window, invalid limit, too-broad `evidence_ref` query.
- `401 Unauthorized`: missing or invalid read key.

## POST /v1/integrity/verify

Verifies a sequence range.

Required headers:

- `Authorization: Bearer <read_key>`
- `Content-Type: application/json`

Body:

```json
{
  "from_sequence": 1,
  "to_sequence": 100
}
```

Example:

```bash
curl -X POST http://localhost:8080/v1/integrity/verify \
  -H "Authorization: Bearer smr_test_read_key_123" \
  -H "Content-Type: application/json" \
  -d '{"from_sequence":1,"to_sequence":100}'
```

Constraints:

- `from_sequence` and `to_sequence` must be integers.
- `from_sequence` must be `>= 1`.
- `to_sequence` must be `>= from_sequence`.

Expected failures:

- `400 Bad Request`: invalid range or no snapshots found.
- `401 Unauthorized`: missing or invalid read key.

Possible verification failure codes include:

- `VERIFY_RANGE_INVALID`
- `SNAPSHOT_NOT_FOUND`
- `PAYLOAD_HASH_MISMATCH`
- `PREV_CHAIN_HASH_MISMATCH`
- `CHAIN_HASH_MISMATCH`
- `SEQUENCE_GAP`
- `MALFORMED_SNAPSHOT`

## Verification Boundary

Verification is structural and cryptographic integrity only.

It does not validate:

- decision correctness
- policy correctness
- upstream truth
- side effects
- compliance status
