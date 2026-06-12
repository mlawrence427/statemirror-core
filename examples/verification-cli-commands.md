# Verification CLI Examples

These examples inspect preserved decision evidence locally.

They do not validate policy correctness, decide outcomes, enforce access, execute workflows, or prove submitted evidence was globally true.

## Verify One Snapshot

```bash
statemirror verify --snapshot-id <snapshot_id>
```

```bash
statemirror verify --snapshot-id <snapshot_id> --json --pretty
```

## Verify A Chain Range

```bash
statemirror verify --from-sequence 1 --to-sequence 25
```

## Inspect One Snapshot

```bash
statemirror inspect --snapshot-id <snapshot_id> --pretty
```

## Export One Snapshot

```bash
statemirror export --snapshot-id <snapshot_id> --include-verification --pretty
```

## Export A Range

```bash
statemirror export --from-sequence 1 --to-sequence 25 --include-verification --output evidence-export.json
```
