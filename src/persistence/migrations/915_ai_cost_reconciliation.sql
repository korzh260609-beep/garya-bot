CREATE TABLE IF NOT EXISTS ai_cost_calls (
  call_id text PRIMARY KEY,
  trace_id text NOT NULL,
  request_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  tier text,
  project_id text,
  workspace_id text,
  usage jsonb NOT NULL,
  pricing_snapshot jsonb NOT NULL,
  calculated_cost_usd numeric,
  provider_reported_cost_usd numeric,
  effective_cost_usd numeric,
  cost_source text NOT NULL,
  reconciliation_status text NOT NULL DEFAULT 'estimated',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_cost_calls_occurred_at_idx ON ai_cost_calls(occurred_at);
CREATE INDEX IF NOT EXISTS ai_cost_calls_project_time_idx ON ai_cost_calls(project_id, occurred_at);

CREATE TABLE IF NOT EXISTS ai_provider_cost_buckets (
  provider text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  project_id text NOT NULL DEFAULT '',
  api_key_id text NOT NULL DEFAULT '',
  line_item text NOT NULL DEFAULT '',
  currency text NOT NULL,
  amount numeric NOT NULL,
  source text NOT NULL,
  fetched_at timestamptz NOT NULL,
  raw jsonb NOT NULL,
  PRIMARY KEY(provider, start_time, end_time, project_id, api_key_id, line_item)
);

CREATE TABLE IF NOT EXISTS ai_cost_reconciliation_runs (
  run_id text PRIMARY KEY,
  provider text NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL,
  bucket_count integer NOT NULL DEFAULT 0,
  provider_cost_usd numeric,
  estimated_cost_usd numeric,
  difference_usd numeric,
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
