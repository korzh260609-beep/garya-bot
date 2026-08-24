import { CANONICAL_TEMPORAL_TYPES } from '../contracts/semantic.js';

export const STRUCTURED_AUTOMATION_ACTION_TYPES = Object.freeze([
  'workspace-activity-report', 'group-activity-report', 'test-activity-report', 'participant-activity-report'
]);
export const STRUCTURED_AUTOMATION_SCOPE_TYPES = Object.freeze([
  'authorized-current-workspaces', 'current-workspace', 'current-group', 'explicit-workspaces'
]);
export const STRUCTURED_AUTOMATION_METRICS = Object.freeze([
  'messages-count', 'message-topics', 'polls-count', 'quizzes-count',
  'poll-and-quiz-topics', 'active-participants'
]);

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}
function string(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}
function enumValue(value, allowed, field) {
  const normalized = string(value, field);
  if (!allowed.includes(normalized)) throw new TypeError(`unsupported ${field}: ${normalized}`);
  return normalized;
}

export function createStructuredAutomationPlan(input) {
  const plan = object(input, 'structured automation plan');
  const trigger = object(plan.trigger, 'structured automation plan.trigger');
  if (trigger.type !== 'recurring') throw new TypeError('structured automation plan.trigger.type must be recurring');
  const recurrence = string(trigger.recurrence, 'structured automation plan.trigger.recurrence');
  const localTime = string(trigger.localTime, 'structured automation plan.trigger.localTime');
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new TypeError('structured automation plan.trigger.localTime must be HH:MM');
  const action = object(plan.action, 'structured automation plan.action');
  const scope = object(plan.scope, 'structured automation plan.scope');
  const period = object(plan.period, 'structured automation plan.period');
  const metrics = Array.isArray(plan.metrics) ? [...new Set(plan.metrics.map((value) => enumValue(value, STRUCTURED_AUTOMATION_METRICS, 'structured automation metric')))] : [];
  if (metrics.length === 0) throw new TypeError('structured automation plan.metrics must not be empty');
  const delivery = object(plan.delivery, 'structured automation plan.delivery');
  return Object.freeze({
    version: 1,
    trigger: Object.freeze({ type: 'recurring', recurrence, localTime }),
    action: Object.freeze({ ...action, type: enumValue(action.type, STRUCTURED_AUTOMATION_ACTION_TYPES, 'structured automation action.type') }),
    scope: Object.freeze({ ...scope, type: enumValue(scope.type, STRUCTURED_AUTOMATION_SCOPE_TYPES, 'structured automation scope.type') }),
    period: Object.freeze({ ...period, type: enumValue(period.type, CANONICAL_TEMPORAL_TYPES, 'structured automation period.type') }),
    metrics: Object.freeze(metrics),
    delivery: Object.freeze({ ...delivery, target: enumValue(delivery.target, ['requester'], 'structured automation delivery.target') })
  });
}

export function workflowStepsForStructuredPlan(plan) {
  const canonical = createStructuredAutomationPlan(plan);
  return Object.freeze([
    Object.freeze({ type: 'collect', mode: 'canonical-activity-report', action: canonical.action, scope: canonical.scope, period: canonical.period, metrics: canonical.metrics }),
    Object.freeze({ type: 'compose', mode: 'canonical-activity-report', input: 'collected-activity' }),
    Object.freeze({ type: 'deliver', mode: 'canonical-requester-delivery' })
  ]);
}
