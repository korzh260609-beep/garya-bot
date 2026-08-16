import { createWorkflowDefinition } from './workflowContract.js';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} is required`);
  return value.trim();
}

function scopeValues(scope = {}) {
  return [
    requiredString(scope.globalUserId ?? scope.userScope, 'scope.globalUserId'),
    requiredString(scope.projectScope, 'scope.projectScope'),
    scope.groupScope ?? null,
    scope.threadScope ?? null
  ];
}

function successfulValidationResult(definition) {
  return Object.freeze({
    valid: true,
    validator: 'createWorkflowDefinition',
    schemaVersion: definition.schemaVersion
  });
}

function normalizeRecord(row) {
  if (!row) return null;
  return Object.freeze({
    automationId: row.automation_id,
    taskId: row.task_id ?? null,
    scheduleId: row.schedule_id ?? null,
    lifecycleStatus: row.lifecycle_status,
    workflow: createWorkflowDefinition(row.workflow)
  });
}

export function createPostgresWorkflowUpdateStore({ database } = {}) {
  if (!database?.query || !database?.transaction) throw new TypeError('database is required');

  async function register({ workflow, taskId = null, scheduleId = null } = {}) {
    const definition = createWorkflowDefinition(workflow);
    const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(definition.scope);
    return database.transaction(async (tx) => {
      const result = await tx.query(`INSERT INTO automation_workflows(
          automation_id,task_id,schedule_id,global_user_id,project_scope,group_scope,thread_scope,current_version,workflow,lifecycle_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,'active')
        ON CONFLICT(automation_id) DO NOTHING RETURNING *`,
      [definition.automationId, taskId, scheduleId, globalUserId, projectScope, groupScope, threadScope, definition.version, JSON.stringify(definition)]);
      const row = result.rows[0] ?? (await tx.query('SELECT * FROM automation_workflows WHERE automation_id=$1', [definition.automationId])).rows[0];
      if (!row) throw new Error('workflow registration failed');
      if (Number(row.current_version) !== definition.version) throw new Error('workflow already registered with a different current version');
      await tx.query(`INSERT INTO automation_workflow_versions(
          automation_id,version,previous_version,workflow,patch_summary,actor_global_user_id,provenance,validation_result,gate_result
        ) VALUES ($1,$2,NULL,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7::jsonb,$8::jsonb)
        ON CONFLICT(automation_id,version) DO NOTHING`,
      [definition.automationId, definition.version, JSON.stringify(definition), JSON.stringify({ fields: [], lifecycleAction: null, registration: true }), definition.createdBy, JSON.stringify(definition.provenance), JSON.stringify(successfulValidationResult(definition)), JSON.stringify({ allowed: true, reason: 'workflow-registration' })]);
      return normalizeRecord(row);
    });
  }

  async function resolve({ selector, scope } = {}) {
    const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
    const automationId = selector?.automationId ?? null;
    const taskId = selector?.taskId ?? null;
    const scheduleId = selector?.scheduleId ?? null;
    const result = await database.query(`SELECT * FROM automation_workflows
      WHERE global_user_id=$1 AND project_scope=$2
        AND group_scope IS NOT DISTINCT FROM $3
        AND thread_scope IS NOT DISTINCT FROM $4
        AND ($5::text IS NULL OR automation_id=$5)
        AND ($6::text IS NULL OR task_id=$6)
        AND ($7::text IS NULL OR schedule_id=$7)
      ORDER BY automation_id LIMIT 2`,
    [globalUserId, projectScope, groupScope, threadScope, automationId, taskId, scheduleId]);
    return Object.freeze(result.rows.map(normalizeRecord));
  }

  async function list({ scope, limit = 100 } = {}) {
    const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
    const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 201) : 100;
    const result = await database.query(`SELECT * FROM automation_workflows
      WHERE global_user_id=$1 AND project_scope=$2
        AND group_scope IS NOT DISTINCT FROM $3
        AND thread_scope IS NOT DISTINCT FROM $4
      ORDER BY automation_id LIMIT $5`,
    [globalUserId, projectScope, groupScope, threadScope, bounded]);
    return Object.freeze(result.rows.map(normalizeRecord));
  }

  async function commitMutation({
    currentWorkflow,
    nextWorkflow,
    expectedVersion,
    actor,
    provenance,
    gateResult,
    patchSummary,
    lifecycleAction = null,
    runtimeMutation = null
  } = {}) {
    const current = createWorkflowDefinition(currentWorkflow);
    const next = createWorkflowDefinition(nextWorkflow);
    if (current.automationId !== next.automationId) throw new TypeError('automationId cannot change');
    if (next.version !== current.version + 1) throw new TypeError('workflow version must increment by exactly one');
    if (runtimeMutation != null && typeof runtimeMutation !== 'function') throw new TypeError('runtimeMutation must be a function');
    const actorGlobalUserId = requiredString(actor?.globalUserId, 'actor.globalUserId');

    return database.transaction(async (tx) => {
      const locked = await tx.query('SELECT * FROM automation_workflows WHERE automation_id=$1 FOR UPDATE', [current.automationId]);
      const row = locked.rows[0];
      if (!row || Number(row.current_version) !== Number(expectedVersion)) return null;

      const runtimeResult = runtimeMutation ? await runtimeMutation(tx) : null;
      const lifecycleStatus = lifecycleAction === 'pause'
        ? 'paused'
        : lifecycleAction === 'resume'
          ? 'active'
          : lifecycleAction === 'cancel'
            ? 'cancelled'
            : row.lifecycle_status;

      await tx.query(`INSERT INTO automation_workflow_versions(
          automation_id,version,previous_version,workflow,patch_summary,actor_global_user_id,provenance,validation_result,gate_result
        ) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8::jsonb,$9::jsonb)`,
      [next.automationId, next.version, current.version, JSON.stringify(next), JSON.stringify(patchSummary ?? {}), actorGlobalUserId, JSON.stringify(provenance ?? {}), JSON.stringify(successfulValidationResult(next)), JSON.stringify(gateResult ?? {})]);

      const updated = await tx.query(`UPDATE automation_workflows
        SET current_version=$2,workflow=$3::jsonb,lifecycle_status=$4,updated_at=now()
        WHERE automation_id=$1 AND current_version=$5 RETURNING *`,
      [next.automationId, next.version, JSON.stringify(next), lifecycleStatus, expectedVersion]);
      const record = normalizeRecord(updated.rows[0] ?? null);
      if (!record) throw new Error('workflow optimistic update failed after lock');
      return runtimeMutation ? Object.freeze({ record, runtimeResult }) : record;
    });
  }

  async function history({ automationId, limit = 50 } = {}) {
    const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 50;
    const result = await database.query(`SELECT automation_id,version,previous_version,workflow,patch_summary,
        actor_global_user_id,provenance,validation_result,gate_result,created_at
      FROM automation_workflow_versions WHERE automation_id=$1
      ORDER BY version DESC LIMIT $2`, [requiredString(automationId, 'automationId'), bounded]);
    return Object.freeze(result.rows.map((row) => Object.freeze({
      automationId: row.automation_id,
      version: Number(row.version),
      previousVersion: row.previous_version == null ? null : Number(row.previous_version),
      workflow: createWorkflowDefinition(row.workflow),
      patchSummary: row.patch_summary ?? {},
      actorGlobalUserId: row.actor_global_user_id,
      provenance: row.provenance ?? {},
      validationResult: row.validation_result ?? {},
      gateResult: row.gate_result ?? {},
      createdAt: new Date(row.created_at).toISOString()
    })));
  }

  return Object.freeze({ register, resolve, list, commitMutation, history, atomicRuntimeMutation: true });
}
