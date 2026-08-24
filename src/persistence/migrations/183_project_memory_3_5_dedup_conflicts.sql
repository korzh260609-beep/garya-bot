-- Project Memory 3.0 PM3.5 — deterministic deduplication and visible conflict safety.
-- One immutable source event may create at most one project-memory entry per project.
-- Concurrent resolver work is additionally serialized in application code with a PostgreSQL advisory transaction lock.

CREATE UNIQUE INDEX IF NOT EXISTS project_memory_entries_source_event_unique_idx
  ON project_memory_entries(project_key, source_event_id)
  WHERE source_event_id IS NOT NULL;

-- Keep at most one open conflict for the same unordered pair. Historical resolved/dismissed
-- conflicts remain preserved and a later materially new conflict may be opened again.
CREATE UNIQUE INDEX IF NOT EXISTS project_memory_conflicts_open_pair_unique_idx
  ON project_memory_conflicts(
    project_key,
    LEAST(memory_id, conflicting_memory_id),
    GREATEST(memory_id, conflicting_memory_id)
  )
  WHERE status='open';

CREATE INDEX IF NOT EXISTS project_memory_entries_entity_current_lookup_idx
  ON project_memory_entries(project_key, namespace, fact_type, entity_key, updated_at DESC);
