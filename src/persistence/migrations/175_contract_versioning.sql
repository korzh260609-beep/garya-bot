CREATE TABLE IF NOT EXISTS contract_quarantine (
  quarantine_id TEXT PRIMARY KEY,
  contract_name TEXT NOT NULL,
  version TEXT NOT NULL,
  reason TEXT NOT NULL,
  source TEXT,
  trace_context JSONB,
  record JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined','released','discarded')),
  quarantined_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contract_quarantine_contract_idx
  ON contract_quarantine(contract_name, quarantined_at DESC);
CREATE INDEX IF NOT EXISTS contract_quarantine_status_idx
  ON contract_quarantine(status, quarantined_at DESC);

-- Block 16.15 contract versions are independent from schema_migrations.
-- Durable/cross-module payload tables may use their own version fields; this table
-- provides explicit quarantine for unsupported or non-adaptable payload versions.
