import { assertWorkspaceId } from '../telegramWorkspace/workspaceOperationsContract.js';
import { WORKSPACE_ACTIVITY_CAPABILITY } from './workspaceActivityCollector.js';

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function failClosed(message, code) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

function normalizeWorkspaceIds(source) {
  if (!Array.isArray(source?.workspaceIds) || source.workspaceIds.length === 0) {
    throw failClosed('source.workspaceIds must be a non-empty array', 'multi_workspace_ids_required');
  }
  if (source.workspaceId != null) {
    throw failClosed('multi-workspace aggregation cannot also specify source.workspaceId', 'multi_workspace_scope_ambiguous');
  }

  const workspaceIds = source.workspaceIds.map((workspaceId) => assertWorkspaceId(workspaceId));
  if (new Set(workspaceIds).size !== workspaceIds.length) {
    throw failClosed('source.workspaceIds must not contain duplicates', 'multi_workspace_ids_duplicate');
  }
  return workspaceIds;
}

function workspaceStep(step, workspaceId) {
  const { workspaceIds: _workspaceIds, ...sharedSource } = step.source ?? {};
  return Object.freeze({
    ...step,
    source: Object.freeze({
      ...sharedSource,
      capability: WORKSPACE_ACTIVITY_CAPABILITY,
      workspaceId
    })
  });
}

function omissionFromVerdict(workspaceId, verdict) {
  return Object.freeze({
    workspaceId,
    reason: verdict?.reason ?? 'workspace-current-security-denied',
    failedCheck: verdict?.failedCheck ?? null,
    errorCode: verdict?.errorCode ?? null,
    evidenceRefs: Object.freeze([...(verdict?.evidenceRefs ?? [])])
  });
}

function omissionFromError(workspaceId, error) {
  return Object.freeze({
    workspaceId,
    reason: 'workspace-collection-unavailable',
    failedCheck: null,
    errorCode: error?.code ?? 'workspace_collection_unavailable',
    evidenceRefs: Object.freeze([])
  });
}

function addActivityEvents(target, activityEvents = {}) {
  for (const [eventType, count] of Object.entries(activityEvents)) {
    if (!Number.isFinite(count)) throw new TypeError(`activityEvents.${eventType} must be numeric`);
    target[eventType] = (target[eventType] ?? 0) + count;
  }
}

export function createMultiWorkspaceActivityAggregator({
  collectWorkspaceActivity,
  recheckProtectedStep
} = {}) {
  const collectOne = requiredFunction(collectWorkspaceActivity, 'collectWorkspaceActivity');
  const recheckOne = requiredFunction(recheckProtectedStep, 'recheckProtectedStep');

  return async function multiWorkspaceActivityAggregator(context = {}) {
    const source = context?.step?.source;
    if (source?.capability !== WORKSPACE_ACTIVITY_CAPABILITY) {
      throw failClosed('multi-workspace aggregation requires workspace-activity capability', 'multi_workspace_capability_invalid');
    }
    if (context?.securityVerdict?.allowed !== true) {
      throw failClosed('multi-workspace aggregation requires a current allowed parent security verdict', 'multi_workspace_parent_security_required');
    }

    const workspaceIds = normalizeWorkspaceIds(source);
    const workspaces = [];
    const omissions = [];
    const totals = {
      publications: 0,
      polls: 0,
      tests: 0,
      interactionEvents: 0,
      activityEvents: {}
    };
    const evidenceRefs = [];

    for (const workspaceId of workspaceIds) {
      const step = workspaceStep(context.step, workspaceId);
      const securityVerdict = await recheckOne(Object.freeze({
        taskId: context.taskId,
        workflow: Object.freeze({
          automationId: context.automationId ?? null,
          version: context.workflowVersion ?? null,
          scope: context.scope ?? null
        }),
        step,
        stepIndex: context.stepIndex,
        handoff: null,
        traceContext: context.traceContext ?? {}
      }));

      if (securityVerdict?.allowed !== true) {
        omissions.push(omissionFromVerdict(workspaceId, securityVerdict));
        continue;
      }

      try {
        const result = await collectOne(Object.freeze({
          ...context,
          step,
          securityVerdict
        }));
        if (!result || typeof result !== 'object' || result.data?.workspaceId !== workspaceId) {
          throw failClosed('single-workspace collector returned invalid workspace evidence', 'multi_workspace_collector_contract_invalid');
        }

        const data = result.data;
        for (const field of ['publications', 'polls', 'tests']) {
          if (!Number.isFinite(data[field])) throw new TypeError(`${field} must be numeric`);
        }
        if (!Number.isFinite(data.interactions?.events)) throw new TypeError('interactions.events must be numeric');

        workspaces.push(Object.freeze({
          workspaceId,
          data,
          sourceMetadata: result.sourceMetadata ?? null,
          evidenceRefs: Object.freeze([...(result.evidenceRefs ?? [])])
        }));
        totals.publications += data.publications;
        totals.polls += data.polls;
        totals.tests += data.tests;
        totals.interactionEvents += data.interactions.events;
        addActivityEvents(totals.activityEvents, data.activityEvents);
        evidenceRefs.push(...(securityVerdict.evidenceRefs ?? []), ...(result.evidenceRefs ?? []));
      } catch (error) {
        if (error?.code === 'multi_workspace_collector_contract_invalid' || error instanceof TypeError) throw error;
        omissions.push(omissionFromError(workspaceId, error));
      }
    }

    return Object.freeze({
      outcome: omissions.length > 0 ? 'partial' : 'completed',
      data: Object.freeze({
        requestedWorkspaceIds: Object.freeze([...workspaceIds]),
        workspaces: Object.freeze(workspaces),
        omissions: Object.freeze(omissions),
        totals: Object.freeze({
          publications: totals.publications,
          polls: totals.polls,
          tests: totals.tests,
          interactionEvents: totals.interactionEvents,
          activityEvents: Object.freeze({ ...totals.activityEvents })
        })
      }),
      sourceMetadata: Object.freeze({
        capability: WORKSPACE_ACTIVITY_CAPABILITY,
        requestedWorkspaceCount: workspaceIds.length,
        includedWorkspaceCount: workspaces.length,
        omittedWorkspaceCount: omissions.length,
        aggregation: 'authorized-available-workspaces-only'
      }),
      evidenceRefs: Object.freeze([...new Set(evidenceRefs)])
    });
  };
}
