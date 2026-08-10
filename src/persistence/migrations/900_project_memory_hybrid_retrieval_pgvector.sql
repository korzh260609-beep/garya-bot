CREATE TABLE IF NOT EXISTS project_memory_embeddings (
  memory_id text PRIMARY KEY REFERENCES project_memory_entries(memory_id) ON DELETE CASCADE,
  project_key text NOT NULL,
  model_key text NOT NULL,
  dimensions integer NOT NULL CHECK (dimensions > 0 AND dimensions <= 4096),
  embedding double precision[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_memory_embeddings_project_idx
  ON project_memory_embeddings(project_key, model_key, dimensions);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'project_memory_embeddings'
        AND column_name = 'embedding_vector'
    ) THEN
      EXECUTE 'ALTER TABLE project_memory_embeddings ADD COLUMN embedding_vector vector';
    END IF;
  END IF;
END
$$;
