CREATE TABLE IF NOT EXISTS user_settings (
  global_user_id text NOT NULL REFERENCES users(global_user_id) ON DELETE CASCADE,
  project_scope text,
  project_scope_key text GENERATED ALWAYS AS (COALESCE(project_scope, '')) STORED,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  explicit_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  inferred_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (global_user_id, project_scope_key),
  CHECK (jsonb_typeof(settings) = 'object'),
  CHECK (jsonb_typeof(explicit_fields) = 'array'),
  CHECK (jsonb_typeof(inferred_fields) = 'array'),
  CHECK (jsonb_typeof(provenance) = 'object')
);

CREATE INDEX IF NOT EXISTS user_settings_project_idx ON user_settings(project_scope, global_user_id);

-- Migrate existing Block 16.5 timezone state into the canonical settings boundary.
INSERT INTO user_settings(global_user_id, project_scope, settings, explicit_fields, inferred_fields, source, provenance, updated_at)
SELECT global_user_id, NULL,
       jsonb_build_object('timeZone', timezone),
       jsonb_build_array('timeZone'),
       '[]'::jsonb,
       COALESCE(timezone_source, 'legacy-temporal-setting'),
       COALESCE(timezone_provenance, '{}'::jsonb),
       COALESCE(timezone_updated_at, now())
FROM users
WHERE timezone IS NOT NULL
ON CONFLICT(global_user_id, project_scope_key) DO UPDATE SET
  settings = user_settings.settings || EXCLUDED.settings,
  explicit_fields = (SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(user_settings.explicit_fields || EXCLUDED.explicit_fields)),
  updated_at = GREATEST(user_settings.updated_at, EXCLUDED.updated_at);

-- Migrate existing Block 16.6 language/locale preferences without deleting legacy data.
INSERT INTO user_settings(global_user_id, project_scope, settings, explicit_fields, inferred_fields, source, provenance, updated_at)
SELECT global_user_id, NULL,
       jsonb_strip_nulls(jsonb_build_object('language', profile->'languageSettings'->>'language', 'locale', profile->'languageSettings'->>'locale')),
       CASE WHEN profile->'languageSettings'->>'locale' IS NOT NULL
            THEN jsonb_build_array('language','locale') ELSE jsonb_build_array('language') END,
       '[]'::jsonb,
       COALESCE(profile->'languageSettings'->>'source', 'legacy-language-setting'),
       COALESCE(profile->'languageSettings'->'provenance', '{}'::jsonb),
       COALESCE((profile->'languageSettings'->>'updatedAt')::timestamptz, now())
FROM users
WHERE profile->'languageSettings'->>'language' IS NOT NULL
ON CONFLICT(global_user_id, project_scope_key) DO UPDATE SET
  settings = user_settings.settings || EXCLUDED.settings,
  explicit_fields = (SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements(user_settings.explicit_fields || EXCLUDED.explicit_fields)),
  updated_at = GREATEST(user_settings.updated_at, EXCLUDED.updated_at);
