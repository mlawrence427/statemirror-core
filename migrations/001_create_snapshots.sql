-- StateMirror core snapshots table
-- Designed for append-only operation; no UPDATE or DELETE in application code

CREATE TABLE snapshots (
    -- Identity
    snapshot_id         UUID            PRIMARY KEY,
    sequence_num        BIGINT          NOT NULL,
    
    -- External references (caller's identifiers)
    evidence_ref        TEXT            NOT NULL,
    evidence_type       TEXT            NOT NULL,
    
    -- Timestamps
    captured_at         TIMESTAMPTZ     NOT NULL,
    received_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),
    
    -- The snapshot itself
    state_payload       JSONB           NOT NULL,
    payload_bytes       INTEGER         NOT NULL,
    
    -- Integrity
    payload_hash        BYTEA           NOT NULL,
    prev_chain_hash     BYTEA,
    chain_hash          BYTEA           NOT NULL,
    
    -- Provenance (optional, application-provided)
    source_system       TEXT,
    source_version      TEXT,
    correlation_id      TEXT,
    
    -- Constraints
    CONSTRAINT sequence_positive CHECK (sequence_num > 0),
    CONSTRAINT payload_not_empty CHECK (payload_bytes > 0),
    CONSTRAINT hash_lengths CHECK (
        octet_length(payload_hash) = 32 AND 
        octet_length(chain_hash) = 32 AND
        (prev_chain_hash IS NULL OR octet_length(prev_chain_hash) = 32)
    )
);

-- Immutability trigger: prevent UPDATE and DELETE
CREATE OR REPLACE FUNCTION prevent_snapshot_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Snapshots are immutable. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snapshots_immutable
    BEFORE UPDATE OR DELETE ON snapshots
    FOR EACH ROW
    EXECUTE FUNCTION prevent_snapshot_modification();
