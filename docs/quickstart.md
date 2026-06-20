# Quickstart

This guide runs StateMirror Core locally with PostgreSQL.

StateMirror preserves evidence snapshots submitted by your application. It does not decide, enforce, grant access, deny access, expire accounts, run workflows, or trigger follow-up actions.

## Requirements

* Node.js
* npm
* Docker Desktop
* Git

## 1. Clone

```bash
git clone https://github.com/mlawrence427/statemirror-core.git
cd statemirror-core
```

## 2. Configure environment

```bash
cp .env.example .env
```

Use local development keys in `.env`:

```txt
PORT=8080
READ_API_KEYS=smr_test_read_key_123
WRITE_API_KEYS=smw_test_write_key_456
DATABASE_URL=postgres://statemirror:statemirror@localhost:5432/statemirror
```

These keys are for local development only.

## 3. Start PostgreSQL

```bash
docker-compose up -d
```

## 4. Install dependencies

```bash
npm install
```

## 5. Run migrations

```bash
npm run migrate
```

## 6. Build

```bash
npm run build
```

## 7. Start server

```bash
npm run start
```

Expected local base URL:

```txt
http://localhost:8080
```

## 8. Health check

```bash
curl http://localhost:8080/v1/health
```

Expected shape:

```json
{
  "component": "StateMirror",
  "status": "healthy",
  "database": "connected"
}
```

## 9. Create a snapshot

This example submits a simple subscription entitlement evidence snapshot.

The application is still responsible for the actual decision and outcome. StateMirror only preserves the submitted evidence.

The `plan`, `denial`, and `expiry` objects use optional canonical Evidence Lane shapes inside `state_payload.inputs`. They are not required by StateMirror Core.

Windows CMD:

```bash
curl -X POST http://localhost:8080/v1/snapshots ^
  -H "Authorization: Bearer smw_test_write_key_456" ^
  -H "Idempotency-Key: local-demo-001" ^
  -H "Content-Type: application/json" ^
  -d "{\"evidence_ref\":\"premium-api:user_123:req_001\",\"evidence_type\":\"subscription_entitlement_decision\",\"captured_at\":\"2025-12-01T18:44:22.000Z\",\"state_payload\":{\"subject\":\"user_123\",\"requested_resource\":\"premium_api\",\"inputs\":{\"plan\":{\"evidence_type\":\"plan_evidence\",\"status\":\"active\",\"plan\":\"commercial\",\"read_at\":\"2025-12-01T18:44:21.810Z\"},\"denial\":{\"evidence_type\":\"denial_evidence\",\"signal\":\"denial_absent\",\"read_at\":\"2025-12-01T18:44:21.842Z\"},\"expiry\":{\"evidence_type\":\"expiry_evidence\",\"signal\":\"not_expired\",\"expires_at\":\"2026-01-01T00:00:00.000Z\",\"read_at\":\"2025-12-01T18:44:21.879Z\"}},\"computed\":{\"eligible\":true,\"decision\":\"granted\",\"reason\":\"active_plan_no_denial_not_expired\"},\"outcome\":{\"owned_by\":\"application\",\"action\":\"grant_premium_api_access\",\"executed_outside_statemirror\":true}}}"
```

macOS/Linux:

```bash
curl -X POST http://localhost:8080/v1/snapshots \
  -H "Authorization: Bearer smw_test_write_key_456" \
  -H "Idempotency-Key: local-demo-001" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_ref": "premium-api:user_123:req_001",
    "evidence_type": "subscription_entitlement_decision",
    "captured_at": "2025-12-01T18:44:22.000Z",
    "state_payload": {
      "subject": "user_123",
      "requested_resource": "premium_api",
      "inputs": {
        "plan": {
          "evidence_type": "plan_evidence",
          "status": "active",
          "plan": "commercial",
          "read_at": "2025-12-01T18:44:21.810Z"
        },
        "denial": {
          "evidence_type": "denial_evidence",
          "signal": "denial_absent",
          "read_at": "2025-12-01T18:44:21.842Z"
        },
        "expiry": {
          "evidence_type": "expiry_evidence",
          "signal": "not_expired",
          "expires_at": "2026-01-01T00:00:00.000Z",
          "read_at": "2025-12-01T18:44:21.879Z"
        }
      },
      "computed": {
        "eligible": true,
        "decision": "granted",
        "reason": "active_plan_no_denial_not_expired"
      },
      "outcome": {
        "owned_by": "application",
        "action": "grant_premium_api_access",
        "executed_outside_statemirror": true
      }
    }
  }'
```

Save the returned `snapshot_id`.

## 10. Retrieve a snapshot

Windows CMD:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id> ^
  -H "Authorization: Bearer smr_test_read_key_123"
```

macOS/Linux:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id> \
  -H "Authorization: Bearer smr_test_read_key_123"
```

## 11. Query by evidence_ref

Windows CMD:

```bash
curl "http://localhost:8080/v1/snapshots?evidence_ref=premium-api:user_123:req_001" ^
  -H "Authorization: Bearer smr_test_read_key_123"
```

macOS/Linux:

```bash
curl "http://localhost:8080/v1/snapshots?evidence_ref=premium-api:user_123:req_001" \
  -H "Authorization: Bearer smr_test_read_key_123"
```

## 12. Verify integrity

Verify the snapshot by ID:

Windows CMD:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id>/verify ^
  -H "Authorization: Bearer smr_test_read_key_123"
```

macOS/Linux:

```bash
curl http://localhost:8080/v1/snapshots/<snapshot_id>/verify \
  -H "Authorization: Bearer smr_test_read_key_123"
```

Verify a sequence range:

Windows CMD:

```bash
curl -X POST http://localhost:8080/v1/integrity/verify ^
  -H "Authorization: Bearer smr_test_read_key_123" ^
  -H "Content-Type: application/json" ^
  -d "{\"from_sequence\":1,\"to_sequence\":100}"
```

macOS/Linux:

```bash
curl -X POST http://localhost:8080/v1/integrity/verify \
  -H "Authorization: Bearer smr_test_read_key_123" \
  -H "Content-Type: application/json" \
  -d '{"from_sequence":1,"to_sequence":100}'
```

Verification checks the stored hash chain across the requested sequence range.

It can detect tampering with preserved snapshot payloads or ordering.

It does not prove the original application decision was correct.

## 13. Inspect and export with the CLI

The CLI reads the same local database configuration, including `DATABASE_URL`.

Inspect the snapshot:

```bash
statemirror inspect --snapshot-id <snapshot_id> --pretty
```

Export the snapshot with verification metadata:

```bash
statemirror export --snapshot-id <snapshot_id> --include-verification --pretty
```

Export a sequence range to a file:

```bash
statemirror export --from-sequence 1 --to-sequence 100 --include-verification --output evidence-export.json
```

See [docs/cli.md](cli.md) for CLI assumptions and limitations.

## 14. Test idempotency

Send the same request again with the same `Idempotency-Key` and identical payload.

Expected behavior:

```txt
same key + same payload      → original snapshot response
same key + different payload → conflict
```

This protects clients from accidentally creating duplicate snapshots during retries.

## 15. Run smoke tests

With the server running:

```bash
npm run smoke
```

## Sample evidence model

StateMirror Core is schema-agnostic.

Your `state_payload` can use your own schema.

A good evidence snapshot usually includes:

* subject or actor
* requested resource or action
* input facts the application consulted
* source timestamps or read times
* derived facts
* policy or application version
* application-declared decision
* outcome owned by the application
* correlation ID or request ID

Native Evidence Lanes are optional canonical shapes for common input facts:

* PlanEvidence
* DenialEvidence
* ExpiryEvidence

They are useful inside `state_payload.inputs`, but they are not required formats. StateMirror stores them as ordinary payload JSON and does not decide, enforce, evaluate policy, execute workflows, or own application actions.

## Troubleshooting

### Port already in use

Change `PORT` in `.env`.

### Database connection fails

Confirm Docker is running:

```bash
docker ps
```

Confirm Postgres is listening on the expected port.

### Unauthorized response

Check that your request includes the correct bearer token:

```txt
Authorization: Bearer <key>
```

Read endpoints require a read key.

Write endpoints require a write key.

### Snapshot conflict

If you receive an idempotency conflict, you reused the same `Idempotency-Key` with a different payload.

Use a new idempotency key for a new snapshot.

Use the same idempotency key only when retrying the same request.

## Boundary reminder

StateMirror confirms what was submitted and preserved.

It does not confirm that the application made the correct decision.

The application decides.

StateMirror preserves evidence.
