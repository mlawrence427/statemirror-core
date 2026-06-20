# Changelog

## v1.0.0

Stability release.

Highlights:

- Declared stable evidence preservation semantics for submitted decision evidence
- Declared stable retrieval semantics for snapshot-by-id and existing query paths
- Declared stable integrity semantics for structural and cryptographic verification only
- Reaffirmed stable Evidence Lane posture: optional canonical shapes, not required schemas
- Reaffirmed stable boundaries: StateMirror preserves evidence; applications decide and execute outcomes
- Added production guidance for configuration, PostgreSQL, migrations, backups, restores, upgrades, compatibility, and operator responsibilities
- Added complete documentation for existing API endpoints, constraints, failures, auth, and deprecated compatibility fields
- Added CLI documentation for local database assumptions, migration requirements, output behavior, examples, and limitations
- Added release notes and failure-mode examples for v1.0.0 readiness

No feature expansion. No workflow engine. No policy engine. No observability system. No hosted service.

## v0.3.0

Developer workflow and verification release.

Highlights:

- Added shared verification logic for preserved payload/hash/chain integrity
- Added snapshot-by-id verification endpoint
- Kept existing chain verification endpoint and routed it through shared verification logic
- Added local `statemirror verify`, `statemirror inspect`, and `statemirror export` CLI commands
- Added JSON export support for one snapshot or a sequence range, with optional verification metadata
- Added developer-oriented failure codes for payload hash mismatches, broken chain links, sequence gaps, missing snapshots, malformed records, and invalid ranges
- Added verification documentation and CLI examples
- Added focused verification and CLI tests

Verification can detect tampering, broken links, missing records, or corrupted stored evidence. It does not prove the application made the correct decision, prove submitted evidence was globally true, or validate policy correctness.

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
