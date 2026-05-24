-- Rename decision_* columns to evidence_* (v1.0 schema hardening)
-- Safe to run once. No data changes beyond column rename.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'decision_ref'
  ) THEN
    ALTER TABLE snapshots RENAME COLUMN decision_ref TO evidence_ref;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'snapshots' AND column_name = 'decision_type'
  ) THEN
    ALTER TABLE snapshots RENAME COLUMN decision_type TO evidence_type;
  END IF;
END $$;

-- Rebuild indexes (names may differ depending on prior install)
DROP INDEX IF EXISTS idx_snapshots_decision_ref;
DROP INDEX IF EXISTS idx_snapshots_type_captured;

CREATE INDEX IF NOT EXISTS idx_snapshots_evidence_ref ON snapshots(evidence_ref);
CREATE INDEX IF NOT EXISTS idx_snapshots_type_captured ON snapshots(evidence_type, captured_at DESC);
