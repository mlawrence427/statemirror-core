# StateMirror Core

StateMirror = decision-time evidence ledger for application systems

When a customer is charged, denied, downgraded, expired, or restricted, teams should not have to reconstruct what the application knew from logs, telemetry, Stripe state, scattered database rows, and old business rules. StateMirror preserves the evidence the application submitted at decision time.

```txt
Application -> Decision -> Evidence -> StateMirror -> Verification
```

## What It Is Not

StateMirror is not:

* observability system
* audit log replacement
* policy engine
* workflow engine
* enforcement system
* decision engine
* compliance tool

StateMirror does not determine or validate correctness of decisions. It only preserves and verifies the integrity of decision-time evidence.

## Core Behavior

* captures evidence at decision time
* stores immutable snapshots
* verifies structural and cryptographic integrity only
* retrieves and exports preserved evidence later
* remains schema-agnostic; Evidence Lanes are optional canonical shapes, not required schemas

## Where To Go Next

* Quickstart: [docs/quickstart.md](docs/quickstart.md)
* API reference: [docs/api.md](docs/api.md)
* Architecture: [docs/architecture.md](docs/architecture.md)
* Production guidance: [docs/production.md](docs/production.md)
* Boundary: [docs/boundary.md](docs/boundary.md)
* Verification: [docs/verification.md](docs/verification.md)
* CLI: [docs/cli.md](docs/cli.md)
* Failure modes: [docs/failure-modes.md](docs/failure-modes.md)
* FAQ: [docs/faq.md](docs/faq.md)
* v1.0.0 release notes: [docs/release-notes/v1.0.0.md](docs/release-notes/v1.0.0.md)
* v1.0.0 roadmap: [docs/roadmap/v1.0.0.md](docs/roadmap/v1.0.0.md)

## CLI

* `statemirror verify` = integrity check
* `statemirror inspect` = evidence view
* `statemirror export` = evidence extraction

See [examples/verification-cli-commands.md](examples/verification-cli-commands.md).

## Examples

* [examples/subscription-entitlement-decision-audit.json](examples/subscription-entitlement-decision-audit.json)
* [examples/evidence-lanes-decision-audit.json](examples/evidence-lanes-decision-audit.json)
* [examples/workflow-approval-decision-audit.json](examples/workflow-approval-decision-audit.json)

Examples are reference patterns for evidence discipline, not required schemas.

## Development

```bash
npm install
npm run migrate
npm run build
npm run start
npm run test
```

## License

Apache-2.0
