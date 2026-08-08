ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_source text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone_updated_at timestamptz;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_timezone_nonempty;
ALTER TABLE users ADD CONSTRAINT users_timezone_nonempty CHECK (timezone IS NULL OR btrim(timezone) <> '');
