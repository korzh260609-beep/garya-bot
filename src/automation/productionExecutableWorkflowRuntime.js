import { createWorkflowExecutor } from './workflowExecutor.js';
import { createWorkflowExecutionSecurity } from './workflowExecutionSecurity.js';
import { createRuntimeFreshDataCollectHandler } from './runtimeFreshDataCollection.js';
import { createWorkspaceActivityCollector, WORKSPACE_ACTIVITY_CAPABILITY } from './workspaceActivityCollector.js';
import { createMultiWorkspaceActivityAggregator } from './multiWorkspaceActivityAggregator.js';
import { createRuntimeDynamicComposeHandler, isDynamicCompositionStep } from './runtimeDynamicComposition.js';
import { createRestartContinuousWorkflowExecution } from './workflowExecutionContinuity.js';

function required(value, field) {
  if (!value) throw new TypeError(`${field} is required`);
  return value;
}

function allowed(reason, evidenceRefs = [], snapshot = null) {
  return Object.freeze({ allowed: true, reason, evidenceRefs: Object.freeze(evidenceRefs), snapshot });
}

function denied(reason, evidenceRefs = [], snapshot = null) {
  return Object.freeze({ allowed: false, reason, evidenceRefs: Object.freeze(evidenceRefs), snapshot });
}

function identityFor(context) {
  const inherited = context?.parentSecurityVerdict?.checks?.identity?.snapshot;
  if (inherited?.globalUserId && inherited?.telegramUserId) return inherited;
  const globalUserId = String(context?.workflow?.scope?.globalUserId ?? '').trim();
  const origin = context?.workflow?.delivery?.originTarget;
  const telegramUserId = origin?.transport === 'telegram' ? String(origin.address ?? '').trim() : '';
  return Object.freeze({ globalUserId, telegramUserId });
}

function workspaceIdFor(context) {
  const value = context?.step?.source?.workspaceId;
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function securityKey(context) {
  return [
    context?.occurrenceId ?? context?.traceContext?.occurrenceId ?? context?.taskId ?? 'task',
    context?.attempt ?? 1,
    context?.stepIndex ?? 0,
    workspaceIdFor(context) ?? 'parent'
  ].join(':');
}

function actionRequest({ context, identity, authority }) {
  const workflow = context.workflow ?? {};
  const scope = workflow.scope ?? {};
  const traceId = context.traceContext?.traceId ?? `workflow:${workflow.automationId ?? context.taskId}`;
  const requestId = context.traceContext?.requestId ?? `${traceId}:step:${context.stepIndex ?? 0}`;
  const workspaceId = workspaceIdFor(context);
  return Object.freeze({
    capability: WORKSPACE_ACTIVITY_CAPABILITY,
    actionType: 'workflow-runtime-collect',
    actionClass: 'read-only',
    actor: Object.freeze({
      globalUserId: identity.globalUserId,
      roles: Object.freeze([]),
      grants: Object.freeze([]),
      authenticationLevel: 'deferred-verified-link'
    }),
    scope: Object.freeze({
      userScope: identity.globalUserId,
      projectScope: scope.projectScope,
      groupScope: scope.groupScope ?? null,
      threadScope: scope.threadScope ?? null,
      requestedUserScope: identity.globalUserId,
      requestedProjectScope: scope.projectScope,
      requestedGroupScope: scope.groupScope ?? null,
      requestedThreadScope: scope.threadScope ?? null,
      allowedCapabilities: Object.freeze([WORKSPACE_ACTIVITY_CAPABILITY])
    }),
    payload: Object.freeze({ automated: true, workflow: { automationId: workflow.automationId, version: workflow.version }, workspaceId }),
    requiredPermission: `capability:${WORKSPACE_ACTIVITY_CAPABILITY}`,
    requiredSources: Object.freeze([]),
    requiredTools: Object.freeze([]),
    resourceRequirement: workspaceId ? Object.freeze({ resourceId: workspaceId, relation: 'can_read' }) : null,
    resourceAuthority: workspaceId ? authority?.resourceAuthority ?? null : null,
    risk: 'low',
    estimatedCostUsd: 0,
    confirmationRequired: false,
    confirmation: null,
    idempotencyKey: null,
    traceContext: Object.freeze({ ...context.traceContext, traceId, requestId })
  });
}

function createProductionExecutionSecurity({
  workspaceAuthority,
  botCapabilityService,
  actionGate,
  policyContextResolver,
  credentialManager
}) {
  const authorityCache = new Map();

  async function currentAuthority(context) {
    const key = securityKey(context);
    if (authorityCache.has(key)) return authorityCache.get(key);
    const workspaceId = workspaceIdFor(context);
    if (!workspaceId) return null;
    const identity = identityFor(context);
    const decision = await workspaceAuthority.verify({
      workspaceId,
      telegramUserId: identity.telegramUserId,
      expectedGlobalUserId: identity.globalUserId,
      requestedAction: 'workspace:view',
      forceFresh: true
    });
    authorityCache.set(key, decision);
    return decision;
  }

  return createWorkflowExecutionSecurity({
    checks: {
      async identity(context) {
        const identity = identityFor(context);
        if (!identity.globalUserId || !/^\d+$/.test(identity.telegramUserId)) {
          return denied('workflow-runtime-identity-unavailable');
        }
        if (identity.globalUserId !== context.workflow?.scope?.globalUserId) {
          return denied('workflow-runtime-identity-scope-mismatch');
        }
        return allowed('workflow-runtime-identity-current', ['identity:workflow-scope'], identity);
      },
      async access(context) {
        const identity = identityFor(context);
        return identity.globalUserId === context.workflow?.scope?.globalUserId
          ? allowed('workflow-runtime-access-current', ['access:workflow-owner'])
          : denied('workflow-runtime-access-denied');
      },
      async resourceAuthority(context) {
        if (!workspaceIdFor(context)) {
          return allowed('workflow-runtime-resource-check-per-workspace', ['authority:per-workspace']);
        }
        const decision = await currentAuthority(context);
        if (decision?.allowed !== true) authorityCache.delete(securityKey(context));
        return decision?.allowed === true
          ? allowed(decision.reason ?? 'workflow-runtime-resource-authorized', decision.resourceAuthority?.evidenceRefs ?? [], decision)
          : denied(decision?.reason ?? 'workflow-runtime-resource-authority-denied', decision?.resourceAuthority?.evidenceRefs ?? [], decision);
      },
      async actionGate(context) {
        const identity = identityFor(context);
        const authority = workspaceIdFor(context) ? await currentAuthority(context) : null;
        if (workspaceIdFor(context) && authority?.allowed !== true) {
          return denied(authority?.reason ?? 'workflow-runtime-resource-authority-denied');
        }
        const decision = actionGate.evaluate(actionRequest({ context, identity, authority }), {
          policyContext: policyContextResolver?.() ?? null
        });
        if (decision?.outcome !== 'allow') authorityCache.delete(securityKey(context));
        return decision?.outcome === 'allow'
          ? allowed('workflow-runtime-action-gate-allowed', ['gate:sg-action-gate'], decision)
          : denied(decision?.reasons?.[0] ?? decision?.outcome ?? 'workflow-runtime-action-gate-denied', ['gate:sg-action-gate'], decision);
      },
      async credentials() {
        try {
          const record = credentialManager.describeCredential('sg.telegram.bot');
          return record?.state === 'active'
            ? allowed('workflow-runtime-credential-available', ['credential:sg.telegram.bot'], { credentialId: record.credentialId, state: record.state, version: record.version })
            : denied('workflow-runtime-credential-unavailable');
        } catch {
          return denied('workflow-runtime-credential-unavailable');
        }
      },
      async permissionHealth(context) {
        const workspaceId = workspaceIdFor(context);
        if (!workspaceId) return allowed('workflow-runtime-permission-check-per-workspace', ['permission-health:per-workspace']);
        let health;
        try {
          health = await botCapabilityService.checkCapabilities({ workspaceId, requiredCapabilities: [], requireFresh: true });
        } finally {
          authorityCache.delete(securityKey(context));
        }
        return health?.available === true
          ? allowed(health.reason ?? 'workflow-runtime-permission-health-current', ['permission-health:telegram-bot'], health)
          : denied(health?.reason ?? 'workflow-runtime-permission-health-denied', ['permission-health:telegram-bot'], health);
      }
    }
  });
}

function staticCompose(context) {
  const input = context.step?.input ?? 'message';
  const message = context.workflow?.inputs?.[input];
  if (typeof message !== 'string' || message.trim() === '') {
    const error = new Error('static workflow composition requires a non-empty workflow input');
    error.code = 'workflow_static_message_invalid';
    error.retryable = false;
    throw error;
  }
  return Object.freeze({
    outcome: 'completed',
    output: Object.freeze({ message: message.trim(), compositionMetadata: { mode: 'static' } }),
    evidenceRefs: Object.freeze(['composition:static-workflow-input'])
  });
}

function deliveryHandler(deliveryRouter) {
  return async function deliver(context) {
    const message = context.handoff?.previousStep?.output?.message;
    if (typeof message !== 'string' || message.trim() === '') {
      const error = new Error('workflow delivery requires a composed runtime message');
      error.code = 'workflow_delivery_message_missing';
      error.retryable = false;
      throw error;
    }
    const workflow = context.workflow;
    const target = workflow.delivery?.originTarget;
    const result = await deliveryRouter.route({
      kind: 'notification',
      actorGlobalUserId: workflow.scope.globalUserId,
      recipientGlobalUserId: workflow.delivery?.recipientGlobalUserId ?? workflow.scope.globalUserId,
      projectScope: workflow.scope.projectScope,
      message: message.trim(),
      originTarget: target,
      explicitTarget: false,
      idempotencyKey: context.deliveryIdempotencyKey,
      locale: workflow.delivery?.locale ?? null,
      traceContext: context.traceContext,
      metadata: {
        originBoundSelfNotification: true,
        automationTaskId: context.taskId,
        automationId: workflow.automationId,
        workflowVersion: workflow.version,
        workflowStepIndex: context.stepIndex,
        occurrenceId: context.occurrenceId,
        automationAttempt: context.attempt,
        outputFormat: workflow.delivery?.format ?? null
      }
    });
    return Object.freeze({
      outcome: result.status === 'delivered' ? 'completed' : 'failed',
      output: Object.freeze({ delivery: result }),
      evidenceRefs: Object.freeze([`delivery:${result.deliveryId ?? result.status}`]),
      errorCode: result.status === 'delivered' ? null : result.failureCode ?? `workflow_delivery_${result.status}`,
      errorMessage: result.status === 'delivered' ? null : result.message ?? 'workflow delivery did not complete',
      retryable: result.status === 'delivered' ? null : result.retryable === true
    });
  };
}

function unsupportedHandler(type) {
  return async function unsupported() {
    const error = new Error(`production workflow step handler is unavailable: ${type}`);
    error.code = 'production_workflow_step_unavailable';
    error.retryable = false;
    throw error;
  };
}

export function createProductionExecutableWorkflowRuntime({
  workflowStore,
  stepRunStore,
  workspaceOperationsStore,
  workspaceRegistry = null,
  workspaceAuthority,
  botCapabilityService,
  actionGate,
  policyContextResolver = null,
  credentialManager,
  deliveryRouter,
  aiRouter = null,
  clock = () => new Date().toISOString()
} = {}) {
  required(workflowStore?.resolveVersion, 'workflowStore.resolveVersion');
  required(stepRunStore?.recordStep, 'stepRunStore.recordStep');
  required(workspaceOperationsStore, 'workspaceOperationsStore');
  if (workspaceRegistry != null) required(workspaceRegistry?.listWorkspaces, 'workspaceRegistry.listWorkspaces');
  required(workspaceAuthority?.verify, 'workspaceAuthority.verify');
  required(botCapabilityService?.checkCapabilities, 'botCapabilityService.checkCapabilities');
  required(actionGate?.evaluate, 'actionGate.evaluate');
  required(credentialManager?.describeCredential, 'credentialManager.describeCredential');
  required(deliveryRouter?.route, 'deliveryRouter.route');

  const executionSecurity = createProductionExecutionSecurity({
    workspaceAuthority,
    botCapabilityService,
    actionGate,
    policyContextResolver,
    credentialManager
  });
  const collectWorkspaceActivity = createWorkspaceActivityCollector({ workspaceOperationsStore, clock });
  let multiWorkspaceActivity;
  multiWorkspaceActivity = createMultiWorkspaceActivityAggregator({
    collectWorkspaceActivity,
    recheckProtectedStep: (context) => executionSecurity.recheckProtectedStep(context)
  });

  async function resolveAuthorizedCurrentWorkspaces(context) {
    if (context.step?.source?.workspaceSelection !== 'authorized-current') return context;
    if (workspaceRegistry == null) {
      const error = new Error('authorized-current workspace selection requires the workspace registry');
      error.code = 'authorized_workspace_registry_unavailable';
      error.retryable = false;
      throw error;
    }
    const identity = identityFor(context);
    const candidates = await workspaceRegistry.listWorkspaces({ limit: 500 });
    const authorized = [];
    for (const workspace of candidates) {
      if (['DISCONNECTED', 'REVOKED'].includes(workspace.lifecycleState)) continue;
      try {
        const decision = await workspaceAuthority.verify({
          workspaceId: workspace.workspaceId,
          telegramUserId: identity.telegramUserId,
          expectedGlobalUserId: identity.globalUserId,
          requestedAction: 'workspace:view',
          forceFresh: true
        });
        if (decision?.allowed === true) authorized.push(workspace);
      } catch {}
    }
    if (authorized.length === 0) {
      const error = new Error('no currently authorized Telegram workspaces are available');
      error.code = 'authorized_workspace_activity_unavailable';
      error.retryable = false;
      throw error;
    }
    return Object.freeze({
      ...context,
      step: Object.freeze({
        ...context.step,
        source: Object.freeze({
          ...context.step.source,
          workspaceIds: Object.freeze(authorized.map((workspace) => workspace.workspaceId)),
          workspaceLabels: Object.freeze(Object.fromEntries(authorized.map((workspace) => [
            workspace.workspaceId,
            workspace.title || workspace.username || 'Группа Telegram'
          ])))
        })
      })
    });
  }
  const collect = createRuntimeFreshDataCollectHandler({
    clock,
    collectCurrent: async (context) => {
      const resolved = await resolveAuthorizedCurrentWorkspaces(context);
      return Array.isArray(resolved.step?.source?.workspaceIds)
        ? multiWorkspaceActivity(resolved)
        : collectWorkspaceActivity(resolved);
    }
  });
  const dynamicCompose = createRuntimeDynamicComposeHandler({ aiRouter, clock });
  const executor = createWorkflowExecutor({
    executionSecurity,
    stepRunStore,
    stepHandlers: {
      collect,
      retrieve: unsupportedHandler('retrieve'),
      analyze: unsupportedHandler('analyze'),
      compose: (context) => isDynamicCompositionStep(context.step) ? dynamicCompose(context) : staticCompose(context),
      'invoke-capability': unsupportedHandler('invoke-capability'),
      deliver: deliveryHandler(deliveryRouter)
    }
  });
  return createRestartContinuousWorkflowExecution({ workflowStore, workflowExecutor: executor });
}
