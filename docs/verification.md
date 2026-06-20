# Verification

StateMirror verification checks structural and cryptographic integrity of preserved evidence.

Verification confirms that preserved snapshot payloads and chain links match their stored hashes.

Verification can detect tampering, broken links, missing records, or corrupted stored evidence.

Verification does not prove the application made the correct decision.

Verification does not prove submitted evidence was globally true across all upstream systems.

Verification does not validate policy correctness.

Verification does not make StateMirror an enforcement layer, workflow engine, policy engine, decision engine, observability replacement, compliance tool, or audit log replacement.

---

## What Is Verified

StateMirror verifies:

* canonical payload hash
* previous chain hash linkage
* recomputed chain hash
* sequence continuity
* missing records in a requested range
* malformed stored records where applicable

Verification is limited to structural and cryptographic integrity of preserved evidence.

---

## API

Verify a chain range:

```bash
POST /v1/integrity/verify
Authorization: Bearer <read_key>
Content-Type: application/json
```

```json
{
  "from_sequence": 1,
  "to_sequence": 100
}
```

Verify one snapshot:

```bash
GET /v1/snapshots/{snapshot_id}/verify
Authorization: Bearer <read_key>
```

The snapshot endpoint verifies the stored payload hash and recomputed chain hash. When adjacent chain context is available, it also checks the previous chain link.

---

## CLI

See [CLI Reference](cli.md) for local database assumptions, output behavior, and limitations.

Verify one snapshot:

```bash
statemirror verify --snapshot-id <snapshot_id>
```

Verify a sequence range:

```bash
statemirror verify --from-sequence 1 --to-sequence 100 --json
```

Inspect one snapshot:

```bash
statemirror inspect --snapshot-id <snapshot_id> --pretty
```

Export one snapshot:

```bash
statemirror export --snapshot-id <snapshot_id> --include-verification --pretty
```

Export a sequence range to a file:

```bash
statemirror export --from-sequence 1 --to-sequence 100 --include-verification --output evidence-export.json
```

The CLI reads the same local environment configuration as the server, including `DATABASE_URL`.

---

## Failure Codes

Verification may return:

* `PAYLOAD_HASH_MISMATCH`
* `PREV_CHAIN_HASH_MISMATCH`
* `CHAIN_HASH_MISMATCH`
* `SEQUENCE_GAP`
* `SNAPSHOT_NOT_FOUND`
* `MALFORMED_SNAPSHOT`
* `VERIFY_RANGE_INVALID`

Messages describe preserved evidence integrity only. They do not say that a decision was invalid, a policy failed, access was wrong, or evidence was false.
