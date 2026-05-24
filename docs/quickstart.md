# Quickstart

This guide runs StateMirror Core locally with PostgreSQL.

## Requirements

- Node.js
- npm
- Docker Desktop
- Git

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
WRITE_API_KEYS=smr_test_write_key_456
DATABASE_URL=postgres://statemirror:statemirror@localhost:5432/statemirror
```

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

Windows CMD:

```bash
curl -X POST http://localhost:8080/v1/snapshots ^
  -H "Authorization: Bearer smr_test_write_key_456" ^
  -H "Idempotency-Key: local-demo-001" ^
  -H "Content-Type: application/json" ^
  -d "{\"evidence_ref\":\"premium-api:user_123:req_001\",\"evidence_type\":\"subscription_entitlement_decision\",\"captured_at\":\"2025-12-01T18:44:22.000Z\",\"state_payload\":{\"subject\":\"user_123\",\"requested_resource\":\"premium_api\",\"computed\":{\"eligible\":true,\"decision\":\"granted\"}}}"
```

macOS/Linux:

```bash
curl -X POST http://localhost:8080/v1/snapshots \
  -H "Authorization: Bearer smr_test_write_key_456" \
  -H "Idempotency-Key: local-demo-001" \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_ref": "premium-api:user_123:req_001",
    "evidence_type": "subscription_entitlement_decision",
    "captured_at": "2025-12-01T18:44:22.000Z",
    "state_payload": {
      "subject": "user_123",
      "requested_resource": "premium_api",
      "computed": {
        "eligible": true,
        "decision": "granted"
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

## 13. Run smoke tests

With the server running:

```bash
npm run smoke
```

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

## Boundary reminder

StateMirror confirms what was submitted and preserved.

It does not confirm that the application made the correct decision.