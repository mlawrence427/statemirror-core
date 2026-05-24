# StateMirror

A self-hosted, write-once ledger for state evidence snapshots.

StateMirror captures and preserves immutable JSON snapshots of computed state ("evidence") at a point in time, and provides integrity verification via cryptographic hash chaining.

## What StateMirror Is NOT

- **Not observability**: No dashboards, metrics, or alerting
- **Not logging**: Captures computed state, not event streams
- **Not analytics**: No aggregation, trending, or reporting
- **Not event sourcing**: Stores computed state, not domain events
- **Not a policy engine**: Does not make or enforce decisions

## Quick Start

### Using Docker Compose

```bash
# Start PostgreSQL and StateMirror
docker-compose up -d

# Wait for services to be ready
sleep 10

# Run migrations (inside container)
docker-compose exec statemirror node dist/db/migrate.js

# Test health endpoint
curl http://localhost:8080/v1/health
```

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your PostgreSQL connection

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## API Reference

### Authentication

All endpoints except `/v1/health` require Bearer token authentication:

```
Authorization: Bearer <api_key>
```

Configure keys via environment variables:
- `READ_API_KEYS`: Comma-separated keys for read operations
- `WRITE_API_KEYS`: Comma-separated keys for write operations

### Endpoints

#### Health Check

```bash
GET /v1/health
# No authentication required

# Response:
{
  "status": "healthy",
  "database": "connected",
  "latest_sequence": 42,
  "latest_received_at": "2024-01-15T10:30:00.000Z"
}
```


> Backwards compatibility: `decision_ref` / `decision_type` are accepted on write and query as deprecated aliases for `evidence_ref` / `evidence_type`.
#### Create Snapshot

```bash
POST /v1/snapshots
Authorization: Bearer <write_key>
Idempotency-Key: <unique-key>
Content-Type: application/json

{
  "evidence_ref": "ban_appeal:user:12345:2024-01-15",
  "evidence_type": "ban_appeal_review",
  "captured_at": "2024-01-15T10:30:00.000Z",
  "state_payload": {
    "user_id": "12345",
    "account_status": "suspended",
    "computed_risk_score": 0.73
  },
  "source_system": "trust-safety-api",
  "source_version": "2.14.0",
  "correlation_id": "trace-abc-123"
}

# Response (201 Created):
{
  "snapshot_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "sequence_num": 42,
  "received_at": "2024-01-15T10:30:00.142Z",
  "payload_hash": "base64...",
  "chain_hash": "base64..."
}
```

**Idempotency**:
- Same key + same payload → 200 with original response
- Same key + different payload → 409 Conflict

#### Get Snapshot by ID

```bash
GET /v1/snapshots/:snapshot_id
Authorization: Bearer <read_key>

# Response:
{
  "snapshot_id": "...",
  "sequence_num": 42,
  "evidence_ref": "...",
  "evidence_type": "...",
  "captured_at": "...",
  "received_at": "...",
  "state_payload": { ... },
  "payload_hash": "...",
  "chain_hash": "...",
  "integrity": {
    "payload_valid": true,
    "chain_valid": true
  }
}
```

#### Query by Decision Reference

```bash
GET /v1/snapshots?evidence_ref=ban_appeal:user:12345
Authorization: Bearer <read_key>

# Response:
{
  "snapshots": [ ... ],
  "count": 1
}
```

#### Query by Type and Time Window

```bash
GET /v1/snapshots?evidence_type=ban_appeal_review&captured_after=2024-01-15T00:00:00Z&captured_before=2024-01-16T00:00:00Z&limit=50
Authorization: Bearer <read_key>

# Note: Time window cannot exceed 24 hours, limit max 100
```

#### Verify Chain Integrity

```bash
POST /v1/integrity/verify
Authorization: Bearer <read_key>
Content-Type: application/json

{
  "from_sequence": 1,
  "to_sequence": 100
}

# Response (valid):
{
  "valid": true,
  "checked_count": 100,
  "first_sequence": 1,
  "last_sequence": 100,
  "elapsed_ms": 142
}

# Response (invalid):
{
  "valid": false,
  "break_at_sequence": 47,
  "expected_prev_hash": "...",
  "actual_prev_hash": "...",
  "checked_count": 47,
  ...
}
```

## Integrity Model

### Hash Chain

Each snapshot contains:
- `payload_hash`: SHA-256 of canonicalized `state_payload`
- `prev_chain_hash`: `chain_hash` of the previous snapshot
- `chain_hash`: SHA-256(sequence_num || payload_hash || prev_chain_hash)

This creates a sequential dependency where modifying any snapshot invalidates all subsequent chain hashes.

### Canonicalization

State payloads are canonicalized before hashing using RFC 8785 principles:
- Object keys sorted lexicographically
- No whitespace
- UTF-8 encoding
- Stable number serialization

This ensures the same logical payload always produces the same hash.

### What This Provides

- **Tamper evidence**: Any modification is detectable
- **Ordering proof**: Sequence is cryptographically enforced
- **Completeness check**: Gaps in sequence are detectable

### What This Does NOT Provide

- Non-repudiation (no signatures)
- Byzantine fault tolerance
- Legal-grade audit compliance

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `PORT` | 8080 | Server port |
| `MAX_PAYLOAD_BYTES` | 1048576 | Max state_payload size (1MB) |
| `READ_API_KEYS` | (required) | Comma-separated read keys |
| `WRITE_API_KEYS` | (required) | Comma-separated write keys |
| `LOG_LEVEL` | info | Logging level |
| `CLEANUP_ON_STARTUP` | true | Delete expired idempotency keys on start |

## Limits & Failure Modes

### Limits

- Maximum payload size: 1MB (configurable)
- Query results capped at 100 snapshots
- Time window queries limited to 24 hours
- Idempotency keys expire after 24 hours

### Failure Modes

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| Network failure during write | Client timeout | Retry with same idempotency key |
| Database unavailable | 503 response | Retry with backoff |
| Payload hash mismatch on read | `integrity.payload_valid: false` | Data corruption; restore from backup |
| Chain hash mismatch | `integrity.chain_valid: false` | Tampering or corruption; investigate |

## Development

```bash
# Run tests
npm run test

# Run smoke tests (requires running server)
npm run smoke

# Build for production
npm run build

# Run production build
npm run start
```

## License

MIT
