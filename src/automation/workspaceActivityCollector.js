import { WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES } from '../telegramWorkspace/workspaceAnalyticsOperations.js';

export const WORKSPACE_ACTIVITY_CAPABILITY = 'workspace-activity';

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function optionalTimestamp(value, field) {
  if (value == null) return null;
  const parsed = new Date(requiredString(value, field));
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${field} must be a valid timestamp`);
  return parsed.toISOString();
}

function failClosed(message, code) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) freeze(item);
  return Object.freeze(value);
}

function normalizeWindow(source, clock) {
  const configured = source?.dataWindow ?? {};
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    throw new TypeError('step.source.dataWindow must be an object when provided');
  }
  const from = optionalTimestamp(configured.from, 'step.source.dataWindow.from');
  const to = optionalTimestamp(configured.to, 'step.source.dataWindow.to') ?? optionalTimestamp(clock(), 'clock');
  if (from !== null && new Date(from).getTime() >= new Date(to).getTime()) {
    throw new TypeError('step.source.dataWindow.from must be earlier than to');
  }
  return Object.freeze({ from, to });
}

export function createWorkspaceActivityCollector({ workspaceOperationsStore, clock = () => new Date().toISOString() } = {}) {
  if (!workspaceOperationsStore || typeof workspaceOperationsStore !== 'object') {
    throw new TypeError('workspaceOperationsStore is required');
  }
  const countRecords = requiredFunction(workspaceOperationsStore.countRecords, 'workspaceOperationsStore.countRecords');
  const aggregateEvents = requiredFunction(workspaceOperationsStore.aggregateEvents, 'workspaceOperationsStore.aggregateEvents');
  const aggregateEventActors = requiredFunction(workspaceOperationsStore.aggregateEventActors, 'workspaceOperationsStore.aggregateEventActors');
  requiredFunction(clock, 'clock');

  return async function collectWorkspaceActivity(context = {}) {
    const source = context?.step?.source;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw failClosed('workspace activity collection requires step.source', 'workspace_activity_source_required');
    }
    if (source.capability !== WORKSPACE_ACTIVITY_CAPABILITY) {
      throw failClosed('workspace activity collector capability mismatch', 'workspace_activity_capability_mismatch');
    }
    if (context?.securityVerdict?.allowed !== true) {
      throw failClosed('workspace activity collection requires current allowed security', 'workspace_activity_security_required');
    }

    const workspaceId = requiredString(source.workspaceId, 'step.source.workspaceId');
    const window = normalizeWindow(source, clock);
    const query = Object.freeze({ workspaceId, from: window.from, to: window.to });

    const [publications, polls, tests, interactions, activityEvents] = await Promise.all([
      countRecords({ ...query, domain: 'content', status: 'published' }),
      countRecords({ ...query, domain: 'poll' }),
      countRecords({ ...query, domain: 'test' }),
      aggregateEventActors({ ...query, eventTypes: WORKSPACE_ANALYTICS_INTERACTION_EVENT_TYPES }),
      aggregateEvents(query)
    ]);

    const data = freeze({
      workspaceId,
      window,
      publications: Number(publications),
      polls: Number(polls),
      tests: Number(tests),
      interactions: {
        uniqueActors: Number(interactions?.uniqueActors ?? 0),
        events: Number(interactions?.interactionEvents ?? 0)
      },
      activityEvents: Object.fromEntries(
        Object.entries(activityEvents ?? {})
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([eventType, count]) => [eventType, Number(count)])
      )
    });

    return Object.freeze({
      outcome: 'completed',
      data,
      sourceMetadata: freeze({
        capability: WORKSPACE_ACTIVITY_CAPABILITY,
        workspaceId,
        persistence: ['telegram_workspace_domain_records', 'telegram_workspace_domain_events'],
        window
      }),
      evidenceRefs: Object.freeze([
        `workspace:${workspaceId}:content:published`,
        `workspace:${workspaceId}:poll`,
        `workspace:${workspaceId}:test`,
        `workspace:${workspaceId}:activity-events`
      ])
    });
  };
}
