import { ACTION_CLASSES } from './action.js';

export const CAPABILITY_STATUSES = Object.freeze(['success', 'partial', 'failed', 'timeout', 'unavailable']);

function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

function stringList(value, field) {
  const list = [...(value ?? [])];
  if (!list.every((entry) => typeof entry === 'string' && entry.trim() !== '')) throw new TypeError(`${field} must contain non-empty strings`);
  return Object.freeze(list);
}

function nonNegative(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return number;
}

export function createCapability(input) {
  requireObject(input, 'capability');
  const actionClasses = stringList(input.actionClasses, 'actionClasses');
  if (actionClasses.length === 0 || !actionClasses.every((value) => ACTION_CLASSES.includes(value))) {
    throw new TypeError('actionClasses must contain supported action classes');
  }
  if (typeof input.execute !== 'function') throw new TypeError('capability.execute must be a function');
  if (input.verifyPostcondition != null && typeof input.verifyPostcondition !== 'function') throw new TypeError('capability.verifyPostcondition must be a function');
  const timeoutMs = Number(input.timeoutMs ?? 5000);
  const maxRetries = Number(input.maxRetries ?? 0);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');
  if (!Number.isInteger(maxRetries) || maxRetries < 0) throw new TypeError('maxRetries must be a non-negative integer');

  return Object.freeze({
    name: requireString(input.name, 'name'),
    version: input.version ?? '1.0.0',
    description: input.description ?? '',
    actionTypes: stringList(input.actionTypes, 'actionTypes'),
    actionClasses,
    requiredPermissions: stringList(input.requiredPermissions, 'requiredPermissions'),
    requiredSources: stringList(input.requiredSources, 'requiredSources'),
    requiredTools: stringList(input.requiredTools, 'requiredTools'),
    risk: input.risk ?? 'low',
    estimatedCostUsd: nonNegative(input.estimatedCostUsd, 'estimatedCostUsd'),
    confirmationRequired: Boolean(input.confirmationRequired),
    timeoutMs,
    maxRetries,
    fallbackCapabilities: stringList(input.fallbackCapabilities, 'fallbackCapabilities'),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    execute: input.execute,
    verifyPostcondition: input.verifyPostcondition ?? null
  });
}

export function createCapabilityExecutionRequest({ capability, actionRequest, gateDecision, attempt = 1, fallbackFrom = null }) {
  if (!capability?.name) throw new TypeError('capability is required');
  if (!actionRequest?.traceContext) throw new TypeError('actionRequest is required');
  if (gateDecision?.outcome !== 'allow' || gateDecision.authorized !== true) throw new TypeError('Authorized GateDecision is required');
  if (gateDecision.actionRequest !== actionRequest) throw new TypeError('GateDecision and ActionRequest must reference the same request');
  return Object.freeze({
    capability: capability.name,
    input: actionRequest.payload,
    actor: actionRequest.actor,
    scope: actionRequest.scope,
    traceContext: actionRequest.traceContext,
    actionRequest,
    gateDecision,
    attempt,
    fallbackFrom
  });
}

export function createCapabilityResult(input) {
  requireObject(input, 'capability result');
  const status = requireString(input.status, 'status');
  if (!CAPABILITY_STATUSES.includes(status)) throw new TypeError(`Unsupported capability status: ${status}`);
  const error = input.error ? Object.freeze({
    code: requireString(input.error.code ?? 'capability-failed', 'error.code'),
    message: requireString(input.error.message ?? 'Capability failed', 'error.message'),
    retryable: Boolean(input.error.retryable)
  }) : null;
  return Object.freeze({
    status,
    capability: requireString(input.capability, 'capability'),
    data: input.data ?? null,
    error,
    warnings: stringList(input.warnings, 'warnings'),
    sources: stringList(input.sources, 'sources'),
    tools: stringList(input.tools, 'tools'),
    durationMs: nonNegative(input.durationMs, 'durationMs'),
    costUsd: nonNegative(input.costUsd, 'costUsd'),
    attempts: Object.freeze([...(input.attempts ?? [])].map((entry) => Object.freeze({ ...entry }))),
    fallbackUsed: input.fallbackUsed ?? null,
    traceContext: Object.freeze({ ...requireObject(input.traceContext, 'traceContext') })
  });
}
