# StateMirror Core Architecture

StateMirror Core is a self-hosted evidence snapshot runtime.

It records submitted JSON evidence at decision time and later retrieves that evidence by reference. It is intentionally not an enforcement engine.

It is useful when teams need to explain billing, access, denial, downgrade, expiry, or restriction decisions without reconstructing what the application knew from logs, telemetry, upstream state, scattered database rows, and old business rules.

Canonical model:

```txt
Application -> Decision -> Evidence -> StateMirror -> Verification
```

Application layer owns decision-making and actions. StateMirror owns evidence preservation. Verification owns structural and cryptographic integrity checks for preserved evidence.

## Boundary model

```txt
APPLICATION
Decision Plane / Enforcement Plane
──────────────────────────────────

Receives request
Reads facts
Computes eligibility
Chooses outcome
Executes action

        │
        │ POST /v1/snapshots
        │ submitted evidence payload
        ▼

STATEMIRROR CORE
Evidence Preservation Layer
──────────────────────────────────

Stores immutable snapshot
Assigns sequence number
Computes payload hash
Computes chain hash
Returns snapshot reference

        │
        │ GET /v1/snapshots/{snapshot_id}
        │ reference-driven retrieval
        ▼

SUPPORT / REVIEW / DISPUTE WORKFLOW

Reads preserved evidence
Reviews what was submitted
Does not ask StateMirror to decide
```

## Flow

```txt
1. Application receives a request.
2. Application queries whatever facts it needs.
3. Application computes a decision.
4. Application submits the computed evidence payload to StateMirror.
5. StateMirror stores the payload immutably.
6. Application executes its own outcome.
7. Later, a reviewer retrieves the exact snapshot by reference.
```

## What StateMirror owns

StateMirror owns:

- snapshot ingest
- immutable persistence
- sequence assignment
- payload hashing
- hash-chain continuity
- idempotent write handling
- reference-driven retrieval
- structural and cryptographic integrity verification

## What the application owns

The application owns:

- identity
- authentication
- authorization
- policy
- decision logic
- access control
- user-facing behavior
- operational outcomes
- whether to fail open or fail closed
- whether evidence capture is required before action

## What StateMirror does not do

StateMirror does not:

- compute state
- interpret payloads
- approve decisions
- deny decisions
- enforce policy
- grant access
- revoke access
- execute workflows
- send notifications
- provide dashboards
- search inside arbitrary payload meaning
- prove the submitted state was correct
- validate correctness of application behavior

## Evidence snapshots

An evidence snapshot is a point-in-time JSON envelope submitted by the application.

Typical fields:

```json
{
  "evidence_ref": "premium-api:user_123:req_abc",
  "evidence_type": "subscription_entitlement_decision",
  "captured_at": "2025-12-01T18:44:22.000Z",
  "state_payload": {
    "subject": "user_123",
    "inputs": {},
    "computed": {}
  }
}
```

StateMirror treats `state_payload` as opaque JSON. Payload meaning remains application-owned.

## Evidence Lanes

StateMirror Core provides native optional canonical Evidence Lane types:

- PlanEvidence
- DenialEvidence
- ExpiryEvidence

These shapes are useful inside `state_payload.inputs` when an application wants to preserve plan, denial, or expiry facts consistently.

Evidence Lanes are not required formats. Snapshot creation remains schema-agnostic.

StateMirror stores Evidence Lanes as ordinary payload JSON. It does not decide, enforce, evaluate policy, execute workflows, or own application actions.

## Integrity model

Each stored snapshot receives:

```txt
sequence_num
payload_hash
prev_chain_hash
chain_hash
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

This produces a sequential dependency:

```txt
snapshot 1 ──hash──► snapshot 2 ──hash──► snapshot 3 ──hash──► snapshot 4
```

If a historical payload changes, verification fails.

## Idempotency model

Snapshot creation supports idempotency keys.

```txt
same key + same payload      → return original result
same key + different payload → conflict
```

This allows clients to safely retry after network failures without creating duplicate evidence records.

## Retrieval model

Retrieval is reference-driven.

Primary retrieval paths:

```txt
GET /v1/snapshots/{snapshot_id}
GET /v1/snapshots?evidence_ref=<evidence_ref>
```

StateMirror is not intended to be a general-purpose analytics system.

## Design posture

StateMirror Core is intentionally small.

It is designed to be:

- self-hosted
- deterministic
- inspectable
- operationally boring
- explicit about failure modes
- separate from enforcement

The application decides.

StateMirror preserves evidence.
