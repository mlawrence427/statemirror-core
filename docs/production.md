# Production Guidance

StateMirror = decision-time evidence ledger for application systems

StateMirror Core is self-hosted. Operators are responsible for the database, configuration, deployment, backups, restores, monitoring of the host environment, and upgrade process.

StateMirror preserves submitted decision evidence. It does not decide, enforce, run workflows, send alerts, replace observability, or operate as a hosted service.

## Environment Variables

Required:

- `DATABASE_URL`: PostgreSQL connection string.
- `READ_API_KEYS`: comma-separated bearer tokens for read and verification endpoints.
- `WRITE_API_KEYS`: comma-separated bearer tokens for snapshot creation.

Optional:

- `PORT`: server port. Defaults to `8080`.
- `MAX_PAYLOAD_BYTES`: maximum accepted `state_payload` size. Defaults to `1048576`.
- `LOG_LEVEL`: runtime log level.
- `CLEANUP_ON_STARTUP`: when `true`, removes expired idempotency key records during startup.
- `APP_VERSION`: value returned in API responses such as `/v1/health`. For v1.0.0, use `1.0.0`.

API keys are application credentials for this service. They are not an authorization model for end users.

## PostgreSQL Requirements

StateMirror Core requires PostgreSQL and stores immutable evidence snapshots in database tables managed by the project migrations.

Operators should provide:

- durable storage
- regular backups
- controlled migration execution
- restricted database access
- operational monitoring for database availability, capacity, and replication lag if replication is used

StateMirror does not manage PostgreSQL hosting, failover, replication, or retention policy.

## Migrations

Run migrations before starting a new deployment version:

```bash
npm run migrate
```

Migrations are part of the release artifact and should be applied exactly once per target database. Operators should run them in a controlled deployment step and keep database backups before upgrades.

Do not edit historical migrations for a deployed environment.

## Backups

Backups are operator-owned.

Because StateMirror is an evidence preservation system, backup strategy should preserve:

- `snapshots`
- `idempotency_keys`
- `schema_migrations`
- database metadata needed for restore

Backups should be tested periodically by restoring into a non-production environment and running integrity verification over representative sequence ranges.

## Restores

Restore expectations are operator-owned.

After a restore:

- confirm migrations are present in `schema_migrations`
- confirm the service starts with the intended `APP_VERSION`
- verify representative chain ranges with `POST /v1/integrity/verify` or `statemirror verify`
- compare expected latest sequence and latest received timestamp through `/v1/health`

Verification confirms structural and cryptographic integrity of preserved evidence only. It does not prove application correctness or upstream truth.

## Upgrades

For v1.0.0 upgrades:

1. Back up the database.
2. Deploy the release artifact.
3. Apply pending migrations.
4. Start the service with explicit environment variables.
5. Check `/v1/health`.
6. Run representative integrity verification.

The v1.0.0 release is a stability release, not a feature expansion. API, retrieval, integrity, and Evidence Lane semantics should remain intentionally narrow.

## Version Compatibility

The runtime version is reported through `APP_VERSION`. Package metadata should match the deployed release version.

Existing v1.0.0 API fields use `evidence_ref` and `evidence_type`. Deprecated compatibility fields `decision_ref` and `decision_type` are accepted by existing endpoints but should not be used for new integrations.

StateMirror Core remains schema-agnostic at the `state_payload` layer. Applications own payload shape compatibility.

## Idempotency Retention

Snapshot creation requires `Idempotency-Key`.

The server stores hashed idempotency keys with an expiration timestamp. Idempotency protects retries of the same request from creating duplicate snapshots during the retention window.

Operators should understand that idempotency records are retry protection, not evidence retention. The evidence snapshot remains the preserved record.

## Payload Size

`MAX_PAYLOAD_BYTES` limits the canonicalized `state_payload` size.

Applications should submit the minimum evidence needed to explain the decision. Avoid secrets, credentials, tokens, full payment details, and unrelated personal data.

## Operational Boundaries

StateMirror does not provide:

- dashboards
- alerts
- hosted service operation
- authorization or end-user identity
- policy validation
- workflow orchestration
- remediation
- observability replacement
- compliance certification

The application decides. StateMirror preserves evidence.
