CREATE TABLE IF NOT EXISTS diagnostic_runs (
  run_id text PRIMARY KEY,
  mode text NOT NULL,
  trace_id text,
  request_id text,
  test_case_id text,
  status text NOT NULL,
  environment text,
  revision text,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS diagnostic_runs_trace_idx ON diagnostic_runs(trace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS diagnostic_runs_request_idx ON diagnostic_runs(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_evidence (
  evidence_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES diagnostic_runs(run_id) ON DELETE CASCADE,
  source text NOT NULL,
  source_ref text,
  occurred_at timestamptz,
  trace_id text,
  request_id text,
  stage text,
  status text,
  component text,
  error_code text,
  fingerprint text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, source, fingerprint)
);

CREATE INDEX IF NOT EXISTS diagnostic_evidence_run_idx ON diagnostic_evidence(run_id, occurred_at, evidence_id);
CREATE INDEX IF NOT EXISTS diagnostic_evidence_trace_idx ON diagnostic_evidence(trace_id, occurred_at, evidence_id);
CREATE INDEX IF NOT EXISTS diagnostic_evidence_request_idx ON diagnostic_evidence(request_id, occurred_at, evidence_id);

CREATE TABLE IF NOT EXISTS diagnostic_findings (
  finding_id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES diagnostic_runs(run_id) ON DELETE CASCADE,
  kind text NOT NULL,
  error_class text NOT NULL,
  component text,
  confidence text NOT NULL,
  summary text NOT NULL,
  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diagnostic_findings_run_idx ON diagnostic_findings(run_id, created_at, finding_id);

CREATE TABLE IF NOT EXISTS diagnostic_regressions (
  regression_id text PRIMARY KEY,
  name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  fixture jsonb NOT NULL,
  expected jsonb NOT NULL,
  fixed_revision text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
