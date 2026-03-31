BEGIN;

CREATE TABLE IF NOT EXISTS public.render_error_snapshots (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'unknown',
  error_kind TEXT NOT NULL DEFAULT 'unknown',
  error_headline TEXT NOT NULL DEFAULT 'unknown',
  candidate_path TEXT,
  exact_line INTEGER,
  confidence TEXT NOT NULL DEFAULT 'very_low',
  log_text TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_render_error_snapshots_source_created
  ON public.render_error_snapshots (source_key, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS public.render_deploy_snapshots (
  id BIGSERIAL PRIMARY KEY,
  source_key TEXT NOT NULL,
  deploy_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  top_error TEXT,
  candidate_path TEXT,
  exact_line INTEGER,
  confidence TEXT NOT NULL DEFAULT 'very_low',
  log_text TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_key, deploy_id)
);

CREATE INDEX IF NOT EXISTS idx_render_deploy_snapshots_source_updated
  ON public.render_deploy_snapshots (source_key, updated_at DESC, id DESC);

COMMIT;