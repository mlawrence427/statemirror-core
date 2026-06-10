# StateMirror Core

Immutable evidence snapshots for application decision systems.

StateMirror Core is a self-hosted runtime for capturing the exact JSON evidence your application computed at a decision moment. It stores that evidence immutably, assigns it a reference, and provides hash-chain verification for later review.

StateMirror does not decide outcomes. It preserves what your system submitted.

---

## Boundary

StateMirror Core does not:

* authorize users
* enforce policy
* grant access
* revoke access
* expire accounts
* execute workflows
* trigger webhooks
* send notifications
* operate a hosted control plane
* provide dashboards or analytics
* evaluate business rules
* replace your application logic

Applications compute facts. Applications decide. Applications execute outcomes.

StateMirror preserves submitted evidence.

---

## Core model

StateMirror is schema-agnostic at the core.

Your application submits evidence-shaped JSON. StateMirror preserves it immutably and makes it retrievable by reference.

StateMirror includes native optional canonical evidence shapes for common patterns, but those shapes are not required formats. Custom evidence schemas remain first-class.

PlanEvidence, DenialEvidence, and ExpiryEvidence are optional canonical Evidence Lanes. They are useful inside `state_payload.inputs` when an application wants to preserve plan, denial, or expiry facts in a consistent shape.

Evidence Lanes are passive evidence types only. They do not grant access, deny access, expire accounts, evaluate policy, run workflows, enforce outcomes, or own application actions.

---

## Why this exists

Production systems often need to answer a hard question later:

> What did the application believe was true when it made this decision?

Logs are noisy.
Events are fragmented.
Current database state has already changed.

StateMirror captures a decision-time evidence snapshot so support, operations, compliance, or dispute workflows can retrieve the exact payload later.

StateMirror is for preserving the evidence behind a decision, not for making the decision.

---

## Repository contents

```txt
migrations/       PostgreSQL schema and indexes
src/              StateMirror Core runtime
tests/            Smoke tests
scripts/          Local smoke-test script
docs/             Architecture, quickstart, boundary, and DX notes
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

## Canonical examples

See:

```txt
examples/subscription-entitlement-decision-audit.json
examples/evidence-lanes-decision-audit.json
```

These examples model decision evidence snapshots:

```txt
User attempts premium API access
↓
Application queries plan, denial, and expiry facts
↓
Application computes eligibility
↓
Application snapshots evidence in StateMirror
↓
Application executes outcome
↓
Support later retrieves exact decision snapshot
```

Additional examples may model other decision-evidence patterns, such as:

* subscription downgrade
* entitlement denial
* expiry state
* workflow approval

These examples are not required schemas. They are reference patterns for evidence discipline.

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

## Why not just logs, JSONB, or OPA?

StateMirror does not replace logs. Logs are useful for operational debugging, but they are often noisy, fragmented, and difficult to treat as a stable decision record.

StateMirror does not replace JSONB. It formalizes the evidence pattern teams often try to build with JSONB.

StateMirror is not valuable because it uses JSON. It is valuable because it turns decision evidence into a disciplined, verifiable, append-only record.

StateMirror does not replace OPA or policy engines. Policy engines can help applications evaluate rules. StateMirror preserves the evidence the application submitted before or around the moment it acted.

---

## Configuration

| Variable           | Description                         |
| ------------------ | ----------------------------------- |
| DATABASE_URL       | PostgreSQL connection string        |
| PORT               | Server port                         |
| MAX_PAYLOAD_BYTES  | Maximum accepted payload size       |
| READ_API_KEYS      | Comma-separated read keys           |
| WRITE_API_KEYS     | Comma-separated write keys          |
| LOG_LEVEL          | Runtime log level                   |
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

* self-hosted
* deterministic
* explicit
* operationally boring
* inspectable
* reference-driven
* schema-agnostic at the core
* separate from enforcement

The application decides.

StateMirror preserves evidence.

---

## Native Evidence Lanes

StateMirror Core stays schema-agnostic.

StateMirror Core provides optional canonical Evidence Lane types for common decision evidence patterns:

* PlanEvidence
* DenialEvidence
* ExpiryEvidence

These shapes are intended for use inside `state_payload.inputs`. They are optional schemas only. Custom evidence schemas remain first-class.

They do not change the StateMirror boundary: the application owns the decision and action, and StateMirror preserves the evidence.

---

## License

Apache-2.0
