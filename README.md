# StateMirror Core

Immutable evidence snapshots for application decision systems.

StateMirror Core is a self-hosted runtime for capturing the exact JSON evidence your application computed at a decision moment. It stores that evidence immutably, assigns it a reference, and provides hash-chain verification for later review.

StateMirror does not decide outcomes. It preserves what your system submitted.

---

## Boundary

StateMirror Core does not:

- authorize users
- enforce policy
- grant access
- revoke access
- execute workflows
- send webhooks
- operate a hosted control plane
- provide dashboards or analytics

Applications compute facts. Applications decide. Applications execute outcomes.

StateMirror preserves submitted evidence.

---

## Why this exists

Production systems often need to answer a hard question later:

> What did the application believe was true when it made this decision?

Logs are noisy.
Events are fragmented.
Current database state has already changed.

StateMirror captures a decision-time evidence snapshot so support, operations, compliance, or dispute workflows can retrieve the exact payload later.

---

## Repository contents

```txt
migrations/       PostgreSQL schema and indexes
src/              StateMirror Core runtime
tests/            Smoke tests
scripts/          Local smoke-test script
docs/             Architecture and quickstart notes
examples/         Canonical example payloads

docker-compose.yml
Dockerfile
Makefile
```

---

## Architecture

See:

```txt
docs/architecture.md
```

Core boundary:

```txt
Application computes facts
↓
Application submits evidence payload
↓
StateMirror preserves immutable snapshot
↓
Application executes outcome
↓
Support later retrieves exact evidence
```

StateMirror is an evidence plane, not an enforcement plane.

---

## Quick start

See:

```txt
docs/quickstart.md
```

Short path:

```bash
cp .env.example .env
docker-compose up -d
npm install
npm run migrate
npm run build
npm run start
npm run smoke
```

Expected local server:

```txt
http://localhost:8080
```

---

## Canonical example

See:

```txt
examples/subscription-entitlement-decision-audit.json
```

This example models a subscription entitlement decision workflow:

```txt
User attempts premium API access
↓
Application queries entitlement, denial, and expiry facts
↓
Application computes eligibility
↓
Application snapshots evidence in StateMirror
↓
Application executes outcome
↓
Support later retrieves exact decision snapshot
```

---

## API overview

### Health

```bash
GET /v1/health
```

No authentication required.

---

### Create snapshot

```bash
POST /v1/snapshots
Authorization: Bearer <write_key>
Idempotency-Key: <unique-key>
Content-Type: application/json
```

Example payload:

```json
{
  "evidence_ref": "premium-api:user_123:req_abc",
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
}
```

Idempotency behavior:

```txt
same key + same payload      → original snapshot response
same key + different payload → conflict
```

---

### Retrieve snapshot

```bash
GET /v1/snapshots/{snapshot_id}
Authorization: Bearer <read_key>
```

---

### Query by evidence reference

```bash
GET /v1/snapshots?evidence_ref=<evidence_ref>
Authorization: Bearer <read_key>
```

---

### Verify integrity

```bash
POST /v1/integrity/verify
Authorization: Bearer <read_key>
Content-Type: application/json
```

Example body:

```json
{
  "from_sequence": 1,
  "to_sequence": 100
}
```

---

## Integrity model

Each snapshot contains:

```txt
payload_hash
prev_chain_hash
chain_hash
sequence_num
```

Conceptually:

```txt
payload_hash = hash(canonical_json(state_payload))

chain_hash = hash(
  sequence_num,
  payload_hash,
  prev_chain_hash
)
```

This creates tamper-evident ordering.

If a historical payload changes, verification fails.

StateMirror provides tamper evidence.
It does not provide legal non-repudiation, Byzantine fault tolerance, or compliance guarantees by itself.

---

## Configuration

| Variable | Description |
|---|---|
| DATABASE_URL | PostgreSQL connection string |
| PORT | Server port |
| MAX_PAYLOAD_BYTES | Maximum accepted payload size |
| READ_API_KEYS | Comma-separated read keys |
| WRITE_API_KEYS | Comma-separated write keys |
| LOG_LEVEL | Runtime log level |
| CLEANUP_ON_STARTUP | Cleanup expired idempotency records |

---

## Development

```bash
npm install
npm run migrate
npm run build
npm run start
npm run test
npm run smoke
```

---

## Design posture

StateMirror Core is intentionally:

- self-hosted
- deterministic
- explicit
- operationally boring
- inspectable
- reference-driven
- separate from enforcement

The application decides.

StateMirror preserves evidence.

---

## Related project

SimpleStates products are built on top of StateMirror Core.

SimpleStates extends the evidence model into additional state primitives such as:

- PlanSignal
- DenySignal
- ExpirySignal

Website:

```txt
https://www.simple-states.com
```

---

## License

Apache-2.0
