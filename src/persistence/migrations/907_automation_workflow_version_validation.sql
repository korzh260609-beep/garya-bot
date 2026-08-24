ALTER TABLE automation_workflow_versions
  ADD COLUMN IF NOT EXISTS validation_result jsonb;

UPDATE automation_workflow_versions
SET validation_result = jsonb_build_object(
  'valid', true,
  'validator', 'createWorkflowDefinition',
  'schemaVersion', workflow->'schemaVersion'
)
WHERE validation_result IS NULL;

ALTER TABLE automation_workflow_versions
  ALTER COLUMN validation_result SET NOT NULL;
