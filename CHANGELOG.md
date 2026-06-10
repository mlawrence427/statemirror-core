# Changelog

## v0.2.0

Native Evidence Lanes release.

Highlights:

- Added native TypeScript reference shapes for PlanEvidence, DenialEvidence, and ExpiryEvidence
- Added a dedicated Evidence Lanes example snapshot
- Documented Evidence Lanes as optional canonical shapes for use inside `state_payload.inputs`
- Reaffirmed that Evidence Lanes are not required formats and do not change snapshot-layer schema agnosticism
- Reaffirmed that StateMirror preserves submitted evidence and does not decide, enforce, evaluate policy, execute workflows, or own application actions
- Fixed existing TypeScript build errors as maintenance cleanup

## v0.1.1

Documentation and DX release.

Highlights:

- Expanded README positioning and boundary language
- Clarified that StateMirror Core is schema-agnostic
- Clarified that Plan Evidence, Denial Evidence, and Expiry Evidence are optional canonical evidence shapes
- Added stronger FAQ answers for logs, observability, JSONB, OPA, schema validation, stale reads, corrections, and hash-chain verification
- Added clearer framing for custom evidence schemas
- Improved quickstart and sample snapshot guidance
- Reinforced that StateMirror preserves evidence only and does not decide, enforce, trigger, or execute outcomes

## v0.1.0

Initial public release.

Highlights:

- Immutable decision evidence snapshots
- Hash-chain verification
- PostgreSQL storage
- Idempotent snapshot creation
- Canonical subscription entitlement example
- Architecture documentation
- Quickstart documentation
- Boundary and guarantees documentation
