-- Idempotency key tracking table
-- Stores hash of idempotency key to detect replay vs conflict

CREATE TABLE idempotency_keys (
    key_hash        BYTEA           PRIMARY KEY,
    snapshot_id     UUID            NOT NULL REFERENCES snapshots(snapshot_id),
    request_hash    BYTEA           NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ     NOT NULL DEFAULT now() + INTERVAL '24 hours',
    
    CONSTRAINT key_hash_length CHECK (octet_length(key_hash) = 32),
    CONSTRAINT request_hash_length CHECK (octet_length(request_hash) = 32)
);

-- Index for cleanup queries
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
