const MODEL_ACTOR_KINDS = new Set(['model', 'llm', 'ai']);
const CONTROL_OPERATIONS = Object.freeze(['confirm', 'reject', 'correct', 'invalidate']);
const MAX_AUDIT_ENTRIES = 16;
const MAX_REASON_LENGTH = 512;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function optional(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value).trim();
}

function clone(value, name = 'value') {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) throw new Error();
    return JSON.parse(serialized);
  } catch {
    throw new TypeError(`${name} must be JSON-compatible`);
  }
}

function controlError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeOperation(value) {
  const operation = required(value, 'operation').toLowerCase();
  if (!CONTROL_OPERATIONS.includes(operation)) {
    throw controlError(`unsupported Project Memory control operation: ${operation}`, 'project-memory-control-operation-denied');
  }
  return operation;
}

function normalizeReason(value) {
  const reason = optional(value);
  if (reason && reason.length > MAX_REASON_LENGTH) {
    throw controlError('Project Memory control reason is too long', 'project-memory-control-payload-too-large');
  }
  return reason;
}

function normalizeAudit(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_AUDIT_ENTRIES + 1).map((entry) => clone(entry, 'confirmationAudit entry'));
}

export function createProjectMemoryConfirmationPolicy({ confirmableTrust = ['verified'] } = {}) {
  const allowedTrust = new Set(confirmableTrust.map((item) => required(item, 'confirmableTrust')));

  return Object.freeze({
    policyId: 'project-memory-confirmation-policy-v1',
    evaluate({ operation, record, correction = null } = {}) {
      const op = normalizeOperation(operation);
      if (!record || typeof record !== 'object') throw new TypeError('project memory record is required');

      if (record.confirmationState === 'rejected') {
        return Object.freeze({ allowed: false, reason: 'already-rejected', operation: op });
      }

      if (op === 'confirm') {
        if (record.confirmationState !== 'proposed') return Object.freeze({ allowed: false, reason: 'confirm-requires-proposed', operation: op });
        if (!allowedTrust.has(record.trust)) return Object.freeze({ allowed: false, reason: 'trust-not-confirmable', operation: op });
      }

      if (op === 'reject' && record.confirmationState !== 'proposed') {
        return Object.freeze({ allowed: false, reason: 'reject-requires-proposed', operation: op });
      }

      if (op === 'invalidate' && record.confirmationState !== 'confirmed') {
        return Object.freeze({ allowed: false, reason: 'invalidate-requires-confirmed', operation: op });
      }

      if (op === 'correct') {
        if (!['proposed', 'confirmed'].includes(record.confirmationState)) {
          return Object.freeze({ allowed: false, reason: 'correct-requires-proposed-or-confirmed', operation: op });
        }
        if (record.confirmationState === 'proposed' && !allowedTrust.has(record.trust)) {
          return Object.freeze({ allowed: false, reason: 'trust-not-confirmable', operation: op });
        }
        if (!correction || correction.fact === undefined) {
          return Object.freeze({ allowed: false, reason: 'correction-fact-required', operation: op });
        }
      }

      return Object.freeze({ allowed: true, reason: 'policy-approved', operation: op });
    }
  });
}

export function createProjectMemoryConfirmationControl({
  store,
  ownerSecurityGateway,
  policy = createProjectMemoryConfirmationPolicy(),
  clock = () => new Date()
} = {}) {
  if (!store?.get || !store?.put) throw new TypeError('project memory store with get/put is required');
  if (!ownerSecurityGateway?.evaluate) throw new TypeError('Owner Security gateway is required');
  if (!policy?.evaluate) throw new TypeError('Project Memory confirmation policy is required');
  if (typeof clock !== 'function') throw new TypeError('clock must be a function');

  async function apply({ operation, memoryId, projectKey, actionContext, reason = null, correction = null } = {}) {
    const op = normalizeOperation(operation);
    const id = required(memoryId, 'memoryId');
    const project = required(projectKey, 'projectKey').toLowerCase();
    const actor = actionContext?.actor;
    const actorGlobalUserId = required(actor?.globalUserId, 'actionContext.actor.globalUserId');
    const actorKind = optional(actor?.kind ?? actor?.actorKind)?.toLowerCase() ?? 'user';
    if (MODEL_ACTOR_KINDS.has(actorKind)) {
      throw controlError('model/LLM actors cannot confirm Project Memory', 'project-memory-model-control-denied');
    }
    if (actionContext?.scope?.projectScope !== project || !actionContext?.traceContext) {
      throw new TypeError('validated actionContext with matching project scope and trace is required');
    }

    const ownerDecision = ownerSecurityGateway.evaluate({
      ...actionContext,
      capability: 'project-memory-control',
      actionType: `project-memory-${op}`,
      actionClass: 'write',
      payload: {
        ...(actionContext.payload ?? {}),
        ownerOnly: true,
        securityClass: 'owner-only',
        projectMemoryOperation: op,
        memoryId: id
      }
    });
    if (!ownerDecision?.allowed || !ownerDecision?.ownerVerified) {
      throw controlError(`Project Memory control denied by Owner Security: ${ownerDecision?.reason ?? 'unknown'}`, 'project-memory-owner-authorization-denied');
    }

    const record = await store.get(id, { projectKey: project });
    if (!record) throw controlError('Project Memory record not found in requested project scope', 'project-memory-candidate-not-found');

    const normalizedCorrection = correction == null ? null : clone(correction, 'correction');
    const policyDecision = policy.evaluate({ operation: op, record, correction: normalizedCorrection });
    if (!policyDecision?.allowed) {
      throw controlError(`Project Memory confirmation policy denied transition: ${policyDecision?.reason ?? 'unknown'}`, 'project-memory-confirmation-transition-denied');
    }

    const nowValue = clock();
    const at = new Date(nowValue?.toISOString?.() ?? nowValue).toISOString();
    const audit = normalizeAudit(record.metadata?.confirmationAudit);
    audit.push({
      operation: op,
      at,
      actorRef: actorGlobalUserId,
      reason: normalizeReason(reason),
      policyId: policy.policyId ?? null,
      ownerSecurityPolicyId: ownerDecision.policyId ?? null,
      before: {
        confirmationState: record.confirmationState,
        confirmed: record.confirmed,
        lifecycleState: record.lifecycleState,
        recordVersion: record.recordVersion,
        semanticFingerprint: record.semanticFingerprint
      },
      ...(op === 'correct' ? { previousFact: clone(record.fact, 'previousFact') } : {})
    });

    const confirmed = op === 'confirm' || op === 'correct';
    const confirmationState = confirmed ? 'confirmed' : 'rejected';
    const lifecycleState = confirmed ? 'active' : 'archived';
    const nextFact = op === 'correct' ? clone(normalizedCorrection.fact, 'correction.fact') : record.fact;

    const updated = await store.put({
      ...record,
      fact: nextFact,
      confirmed,
      confirmationState,
      lifecycleState,
      updatedAt: at,
      recordVersion: Number(record.recordVersion ?? 1) + 1,
      metadata: {
        ...(record.metadata ?? {}),
        confirmationControl: {
          lastOperation: op,
          lastAt: at,
          policyId: policy.policyId ?? null
        },
        confirmationAudit: audit
      }
    });

    return Object.freeze({
      status: op === 'confirm' ? 'confirmed' : op === 'correct' ? 'corrected' : op === 'reject' ? 'rejected' : 'invalidated',
      operation: op,
      policyDecision,
      ownerDecision,
      record: updated
    });
  }

  return Object.freeze({
    apply,
    confirm(input) { return apply({ ...input, operation: 'confirm' }); },
    reject(input) { return apply({ ...input, operation: 'reject' }); },
    correct(input) { return apply({ ...input, operation: 'correct' }); },
    invalidate(input) { return apply({ ...input, operation: 'invalidate' }); }
  });
}

export const PROJECT_MEMORY3_CONTROL_OPERATIONS = CONTROL_OPERATIONS;
export const PROJECT_MEMORY3_CONTROL_LIMITS = Object.freeze({ auditEntries: MAX_AUDIT_ENTRIES, reasonLength: MAX_REASON_LENGTH });
