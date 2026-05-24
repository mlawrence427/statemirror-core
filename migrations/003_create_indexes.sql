-- Indexes for snapshot retrieval

-- Unique index on sequence number (enforces no duplicates)
CREATE UNIQUE INDEX idx_snapshots_sequence ON snapshots(sequence_num);

-- Index for evidence_ref lookups (exact match)
CREATE INDEX idx_snapshots_evidence_ref ON snapshots(evidence_ref);

-- Index for evidence_type + captured_at range queries
CREATE INDEX idx_snapshots_type_captured ON snapshots(evidence_type, captured_at DESC);

-- Index for correlation_id lookups (sparse - only where not null)
CREATE INDEX idx_snapshots_correlation ON snapshots(correlation_id) 
    WHERE correlation_id IS NOT NULL;
