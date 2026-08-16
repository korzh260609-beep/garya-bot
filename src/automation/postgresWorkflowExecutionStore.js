function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${field} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer`);
  return value;
}

const STEP_STATUSES = Object.freeze(['running', 'completed', 'partial', 'failed', 'denied', 'cancelled']);

export function createPostgresWorkflowExecutionStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');

  async function recordStep({
    taskId,
    automationId,
    workflowVersion,
    stepIndex,
    stepType,
    status,
    output = null,
    evidenceRefs = [],
    errorCode = null,
    errorMessage = null
  } = {}) {
    const normalizedStatus = requiredString(status, 'status');
    if (!STEP_STATUSES.includes(normalizedStatus)) throw new TypeError(`unsupported workflow step status: ${normalizedStatus}`);
    const terminal = normalizedStatus !== 'running';
    const result = await database.query(`
      INSERT INTO automation_workflow_step_runs(
        task_id, automation_id, workflow_version, step_index, step_type, status,
        output, evidence_refs, error_code, error_message, completed_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,CASE WHEN $11::boolean THEN now() ELSE NULL END,now())
      ON CONFLICT(task_id, step_index) DO UPDATE SET
        automation_id=EXCLUDED.automation_id,
        workflow_version=EXCLUDED.workflow_version,
        step_type=EXCLUDED.step_type,
        status=EXCLUDED.status,
        output=EXCLUDED.output,
        evidence_refs=EXCLUDED.evidence_refs,
        error_code=EXCLUDED.error_code,
        error_message=EXCLUDED.error_message,
        completed_at=EXCLUDED.completed_at,
        updated_at=now()
      RETURNING *
    `, [
      requiredString(taskId, 'taskId'),
      requiredString(automationId, 'automationId'),
      positiveInteger(workflowVersion, 'workflowVersion'),
      nonNegativeInteger(stepIndex, 'stepIndex'),
      requiredString(stepType, 'stepType'),
      normalizedStatus,
      JSON.stringify(output),
      JSON.stringify(evidenceRefs),
      errorCode == null ? null : String(errorCode),
      errorMessage == null ? null : String(errorMessage),
      terminal
    ]);
    return result.rows[0];
  }

  async function listSteps(taskId) {
    const result = await database.query(
      'SELECT * FROM automation_workflow_step_runs WHERE task_id=$1 ORDER BY step_index',
      [requiredString(taskId, 'taskId')]
    );
    return result.rows;
  }

  return Object.freeze({ recordStep, listSteps });
}
