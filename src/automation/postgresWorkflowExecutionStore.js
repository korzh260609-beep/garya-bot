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

function boundedJson(value, field, maximum = 32768) {
  let serialized;
  try {
    serialized = JSON.stringify(value ?? null);
  } catch {
    throw new TypeError(`${field} must be JSON-compatible`);
  }
  if (serialized.length <= maximum) return JSON.parse(serialized);
  return { truncated: true, preview: serialized.slice(0, maximum - 100) };
}

const STEP_STATUSES = Object.freeze(['running', 'completed', 'partial', 'failed', 'denied', 'cancelled']);
export const WORKFLOW_RUN_EVENT_TYPES = Object.freeze([
  'gate-decision',
  'source-result',
  'ai-call',
  'delivery-result'
]);

function assertStatus(value, field = 'status') {
  const status = requiredString(value, field);
  if (!STEP_STATUSES.includes(status)) throw new TypeError(`unsupported workflow status: ${status}`);
  return status;
}

export function createPostgresWorkflowExecutionStore({ database } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('database is required');

  async function startRun({
    runId,
    taskId,
    automationId,
    workflowVersion,
    occurrenceId,
    attempt = 1,
    traceId = null,
    requestId = null
  } = {}) {
    const result = await database.query(`
      INSERT INTO automation_workflow_runs(
        run_id, task_id, automation_id, workflow_version, occurrence_id, attempt,
        trace_id, request_id, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'running')
      ON CONFLICT(run_id) DO NOTHING
      RETURNING *
    `, [
      requiredString(runId, 'runId'),
      requiredString(taskId, 'taskId'),
      requiredString(automationId, 'automationId'),
      positiveInteger(workflowVersion, 'workflowVersion'),
      requiredString(occurrenceId, 'occurrenceId'),
      positiveInteger(attempt, 'attempt'),
      traceId == null ? null : requiredString(traceId, 'traceId'),
      requestId == null ? null : requiredString(requestId, 'requestId')
    ]);
    if (result.rows[0]) return result.rows[0];
    const existing = await database.query('SELECT * FROM automation_workflow_runs WHERE run_id=$1', [runId]);
    if (!existing.rows[0]) throw new Error('workflow run identity conflict');
    return existing.rows[0];
  }

  async function recordStep({
    runId,
    taskId,
    automationId,
    workflowVersion,
    stepIndex,
    stepType,
    status,
    output = null,
    evidenceRefs = [],
    errorCode = null,
    errorMessage = null,
    retryable = null
  } = {}) {
    const normalizedTaskId = requiredString(taskId, 'taskId');
    const normalizedRunId = runId == null ? `${normalizedTaskId}:legacy-runtime` : requiredString(runId, 'runId');
    const normalizedAutomationId = requiredString(automationId, 'automationId');
    const normalizedVersion = positiveInteger(workflowVersion, 'workflowVersion');
    const normalizedStepIndex = nonNegativeInteger(stepIndex, 'stepIndex');
    const normalizedStepType = requiredString(stepType, 'stepType');
    const normalizedStatus = assertStatus(status);
    const normalizedOutput = boundedJson(output, 'output');
    const normalizedEvidence = boundedJson(evidenceRefs, 'evidenceRefs');
    const terminal = normalizedStatus !== 'running';

    return database.transaction(async (tx) => {
      await tx.query(`
        INSERT INTO automation_workflow_runs(
          run_id, task_id, automation_id, workflow_version, occurrence_id, attempt, status
        ) VALUES ($1,$2,$3,$4,$2,1,'running')
        ON CONFLICT(run_id) DO NOTHING
      `, [normalizedRunId, normalizedTaskId, normalizedAutomationId, normalizedVersion]);

      const result = await tx.query(`
        INSERT INTO automation_workflow_step_runs(
          run_id, task_id, automation_id, workflow_version, step_index, step_type, status,
          output, evidence_refs, error_code, error_message, completed_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,CASE WHEN $12::boolean THEN now() ELSE NULL END,now())
        ON CONFLICT(run_id, step_index) DO UPDATE SET
          task_id=EXCLUDED.task_id,
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
        normalizedRunId, normalizedTaskId, normalizedAutomationId, normalizedVersion,
        normalizedStepIndex, normalizedStepType, normalizedStatus,
        JSON.stringify(normalizedOutput), JSON.stringify(normalizedEvidence),
        errorCode == null ? null : String(errorCode),
        errorMessage == null ? null : String(errorMessage), terminal
      ]);

      await tx.query(`
        INSERT INTO automation_workflow_run_events(run_id,event_type,step_index,payload,evidence_refs)
        VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
      `, [
        normalizedRunId,
        normalizedStatus === 'running' ? 'step-running' : 'step-completed',
        normalizedStepIndex,
        JSON.stringify(boundedJson({
          stepType: normalizedStepType,
          status: normalizedStatus,
          output: normalizedOutput,
          errorCode: errorCode ?? null,
          errorMessage: errorMessage ?? null,
          retryable
        }, 'step event')),
        JSON.stringify(normalizedEvidence)
      ]);
      return result.rows[0];
    });
  }

  async function recordRunEvent({ runId, eventType, stepIndex = null, payload = {}, evidenceRefs = [] } = {}) {
    const normalizedType = requiredString(eventType, 'eventType');
    if (!WORKFLOW_RUN_EVENT_TYPES.includes(normalizedType)) throw new TypeError(`unsupported workflow run event type: ${normalizedType}`);
    const result = await database.query(`
      INSERT INTO automation_workflow_run_events(run_id,event_type,step_index,payload,evidence_refs)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
      RETURNING *
    `, [
      requiredString(runId, 'runId'),
      normalizedType,
      stepIndex == null ? null : nonNegativeInteger(stepIndex, 'stepIndex'),
      JSON.stringify(boundedJson(payload, 'payload')),
      JSON.stringify(boundedJson(evidenceRefs, 'evidenceRefs'))
    ]);
    return result.rows[0];
  }

  async function completeRun({
    runId,
    status,
    output = null,
    evidenceRefs = [],
    errorCode = null,
    errorMessage = null,
    retryable = null
  } = {}) {
    const normalizedStatus = assertStatus(status);
    if (normalizedStatus === 'running') throw new TypeError('completeRun status must be terminal');
    return database.transaction(async (tx) => {
      const result = await tx.query(`
        UPDATE automation_workflow_runs SET
          status=$2,
          output=$3::jsonb,
          evidence_refs=$4::jsonb,
          error_code=$5,
          error_message=$6,
          retryable=$7,
          completed_at=now(),
          updated_at=now()
        WHERE run_id=$1 AND status='running'
        RETURNING *
      `, [
        requiredString(runId, 'runId'), normalizedStatus,
        JSON.stringify(boundedJson(output, 'output')),
        JSON.stringify(boundedJson(evidenceRefs, 'evidenceRefs')),
        errorCode == null ? null : String(errorCode),
        errorMessage == null ? null : String(errorMessage),
        retryable == null ? null : retryable === true
      ]);
      if (result.rows[0]) {
        await tx.query(`
          INSERT INTO automation_workflow_run_events(run_id,event_type,payload,evidence_refs)
          VALUES ($1,'run-completed',$2::jsonb,$3::jsonb)
        `, [runId, JSON.stringify({ status: normalizedStatus, errorCode, errorMessage, retryable }), JSON.stringify(boundedJson(evidenceRefs, 'evidenceRefs'))]);
        return result.rows[0];
      }
      const existing = await tx.query('SELECT * FROM automation_workflow_runs WHERE run_id=$1', [runId]);
      if (!existing.rows[0]) throw new Error('workflow run not found');
      return existing.rows[0];
    });
  }

  async function getRunHistory(runId) {
    const normalizedRunId = requiredString(runId, 'runId');
    const [run, steps, events] = await Promise.all([
      database.query('SELECT * FROM automation_workflow_runs WHERE run_id=$1', [normalizedRunId]),
      database.query('SELECT * FROM automation_workflow_step_runs WHERE run_id=$1 ORDER BY step_index', [normalizedRunId]),
      database.query('SELECT * FROM automation_workflow_run_events WHERE run_id=$1 ORDER BY event_id', [normalizedRunId])
    ]);
    if (!run.rows[0]) return null;
    return Object.freeze({ run: run.rows[0], steps: Object.freeze(steps.rows), events: Object.freeze(events.rows) });
  }

  async function listRuns({ automationId, limit = 100 } = {}) {
    positiveInteger(limit, 'limit');
    const result = await database.query(`
      SELECT * FROM automation_workflow_runs
      WHERE automation_id=$1
      ORDER BY started_at DESC, run_id DESC
      LIMIT $2
    `, [requiredString(automationId, 'automationId'), limit]);
    return result.rows;
  }

  async function listSteps(taskId) {
    const result = await database.query(
      'SELECT * FROM automation_workflow_step_runs WHERE task_id=$1 ORDER BY started_at,run_id,step_index',
      [requiredString(taskId, 'taskId')]
    );
    return result.rows;
  }

  return Object.freeze({ startRun, recordStep, recordRunEvent, completeRun, getRunHistory, listRuns, listSteps });
}
