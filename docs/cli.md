# CLI Reference

StateMirror = decision-time evidence ledger for application systems

The `statemirror` CLI reads preserved evidence from the local PostgreSQL database configured by the same environment variables as the server.

The CLI verifies structural and cryptographic integrity only. It does not prove decision correctness, policy correctness, upstream truth, or side-effect execution.

## Assumptions

Before using the CLI:

- `DATABASE_URL` must point to the target PostgreSQL database.
- Migrations must already be applied.
- The command must run in an environment that can reach the database.
- The database contents are the source of preserved evidence.

The CLI does not call the HTTP API and does not use read or write API keys.

## statemirror verify

Verifies one snapshot or a sequence range.

Verify one snapshot:

```bash
statemirror verify --snapshot-id <snapshot_id>
```

Verify one snapshot as JSON:

```bash
statemirror verify --snapshot-id <snapshot_id> --json --pretty
```

Verify a sequence range:

```bash
statemirror verify --from-sequence 1 --to-sequence 25
```

Output:

- pretty text by default
- JSON with `--json`
- indented JSON with `--json --pretty`
- file output when `--output <path>` is provided

## statemirror inspect

Retrieves one preserved snapshot for local inspection.

```bash
statemirror inspect --snapshot-id <snapshot_id> --pretty
```

JSON output:

```bash
statemirror inspect --snapshot-id <snapshot_id> --json --pretty
```

`inspect` includes a readable summary, detected Evidence Lane `evidence_type` values under `state_payload.inputs`, hash fields, and verification status.

## statemirror export

Exports one snapshot or a sequence range as JSON.

Export one snapshot:

```bash
statemirror export --snapshot-id <snapshot_id> --include-verification --pretty
```

Export a sequence range to a file:

```bash
statemirror export --from-sequence 1 --to-sequence 25 --include-verification --output evidence-export.json
```

Output:

- stdout by default
- file output when `--output <path>` is provided
- optional verification metadata with `--include-verification`
- compact JSON by default
- indented JSON with `--pretty`

## Limitations

The CLI does not:

- create snapshots
- modify evidence
- run migrations
- manage backups or restores
- authenticate through API keys
- decide outcomes
- enforce policy
- validate upstream truth

Applications decide.

StateMirror preserves evidence.
