import { createActionRequest } from '../contracts/action.js';

export const TELEGRAM_WORKSPACE_MUTATION_CAPABILITIES = Object.freeze({
  apply: 'telegram-workspace-config-apply',
  rollback: 'telegram-workspace-config-rollback'
});

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function normalizedRole(workspaceRole) {
  const value = typeof workspaceRole === 'string' ? workspaceRole.trim().toLowerCase() : '';
  return value ? `workspace-${value}` : 'workspace-authorized';
}

function gateError(decision) {
  const code = decision.outcome === 'require-confirmation'
    ? 'twm-action-gate-confirmation-required'
    : decision.outcome === 'deny'
      ? 'twm-action-gate-denied'
      : 'twm-action-gate-not-executable';
  const message = decision.outcome === 'require-confirmation'
    ? 'workspace mutation requires Action Gate confirmation'
    : 'workspace mutation was not authorized for execution by Action Gate';
  return new TelegramWorkspaceActionGateError(message, code, freeze({
    outcome: decision.outcome,
    reasons: decision.reasons,
    requiresConfirmation: decision.requiresConfirmation,
    requestId: decision.actionRequest.traceContext.requestId,
    traceId: decision.actionRequest.traceContext.traceId,
    risk: decision.actionRequest.risk,
    actionClass: decision.actionRequest.actionClass,
    effectiveActionClass: decision.effectiveActionClass
  }));
}

export class TelegramWorkspaceActionGateError extends Error {
  constructor(message, code = 'twm-action-gate-error', details = null) {
    super(message);
    this.name = 'TelegramWorkspaceActionGateError';
    this.code = code;
    this.details = details;
  }
}

export function createTelegramWorkspaceActionGateIntegration({
  actionGate,
  projectScope = 'sg2.1',
  policyContextResolver = null,
  audit = async () => {}
} = {}) {
  if (typeof actionGate?.evaluate !== 'function') throw new TypeError('actionGate.evaluate is required');
  const project = required(projectScope, 'projectScope');
  if (policyContextResolver !== null && typeof policyContextResolver !== 'function') throw new TypeError('policyContextResolver must be a function');
  if (typeof audit !== 'function') throw new TypeError('audit must be a function');

  async function emit(event) {
    try { await audit(freeze({ eventClass: 'telegram_workspace_action_gate', ...event })); } catch {}
  }

  async function evaluateMutation({
    operation,
    workspaceId,
    namespace,
    actorGlobalUserId,
    traceId,
    requestId,
    baseVersion,
    targetVersion = null,
    risk,
    confirmationRequired = false,
    authority,
    confirmation = null
  } = {}) {
    const op = required(operation, 'operation');
    const capability = TELEGRAM_WORKSPACE_MUTATION_CAPABILITIES[op];
    if (!capability) throw new TypeError(`unsupported Telegram workspace mutation operation: ${op}`);
    const workspace = required(workspaceId, 'workspaceId');
    const actor = required(actorGlobalUserId, 'actorGlobalUserId');
    const trace = required(traceId, 'traceId');
    const request = required(requestId, 'requestId');
    const ns = required(namespace, 'namespace');
    if (authority?.allowed !== true) throw new TypeError('verified workspace authority is required before Action Gate evaluation');

    const actionRequest = createActionRequest({
      capability,
      actionType: `telegram-workspace-config-${op}`,
      actionClass: 'state-changing',
      actor: {
        globalUserId: actor,
        roles: [normalizedRole(authority.workspaceRole)],
        grants: ['workspace:configure'],
        authenticationLevel: 'verified'
      },
      scope: {
        userScope: actor,
        projectScope: project,
        groupScope: workspace,
        threadScope: null,
        allowedCapabilities: [capability]
      },
      requestedScope: {
        userScope: actor,
        projectScope: project,
        groupScope: workspace,
        threadScope: null
      },
      payload: {
        subsystem: 'telegram-workspace-manager',
        operation: op,
        namespace: ns,
        baseVersion: Number(baseVersion),
        targetVersion: targetVersion == null ? null : Number(targetVersion)
      },
      requiredPermission: 'workspace:configure',
      resourceRequirement: { resourceId: workspace, relation: 'workspace:configure' },
      resourceAuthority: {
        allowed: true,
        reason: authority.reason ?? 'twm-workspace-authority-verified',
        actorGlobalUserId: actor,
        projectScope: project,
        resourceId: workspace,
        requiredRelation: 'workspace:configure',
        evidence: {
          source: 'telegram-workspace-authority',
          workspaceRole: authority.workspaceRole ?? null,
          verificationTime: authority.verificationTime ?? null
        }
      },
      risk,
      confirmationRequired: confirmationRequired === true,
      confirmation,
      idempotencyKey: `twm-config:${op}:${workspace}:${ns}:${Number(baseVersion)}:${request}`,
      traceContext: { traceId: trace, requestId: request }
    });

    const policyContext = policyContextResolver ? await policyContextResolver({
      actorGlobalUserId: actor,
      workspaceId: workspace,
      workspaceRole: authority.workspaceRole ?? null,
      operation: op,
      namespace: ns
    }) : null;
    const decision = actionGate.evaluate(actionRequest, { policyContext });
    await emit({
      operation: op,
      outcome: decision.outcome,
      workspaceId: workspace,
      namespace: ns,
      actorGlobalUserId: actor,
      traceId: trace,
      requestId: request,
      risk: actionRequest.risk,
      confirmationRequired: actionRequest.confirmationRequired,
      reasons: decision.reasons
    });
    if (decision.outcome !== 'allow') throw gateError(decision);
    return decision;
  }

  return Object.freeze({ evaluateMutation });
}
