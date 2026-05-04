// AGENT NOTE:
// SG 2.0 shared collector interface skeleton.
// Purpose: define safe request-plan contracts for future collectors.
// This interface is not a runtime bridge, API client, router, command handler, or technical mode.
// Do not call Render, GitHub, Telegram, DB, AI, filesystem, network, or external services here.

const DEFAULT_LIMITS = Object.freeze({
  defaultLimit: 100,
  maxLimit: 1000,
});

export const COLLECTOR_INTERFACE_SAFETY = Object.freeze({
  readOnly: true,
  canChangeState: false,
  tokensSpent: false,
  connectedToRuntime: false,
  connectedToTelegram: false,
  connectedToRender: false,
  connectedToGitHub: false,
  connectedToDatabase: false,
  connectedToAI: false,
  connectedToNetwork: false,
  executesRequests: false,
  mutatesExternalState: false,
  analyzesFacts: false,
  writesFilesystem: false,
  writesRepository: false,
});

function toSafeString(value, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function toSafeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function normalizeLimits(limits = {}) {
  const defaultLimit = Number(limits.defaultLimit ?? DEFAULT_LIMITS.defaultLimit);
  const maxLimit = Number(limits.maxLimit ?? DEFAULT_LIMITS.maxLimit);

  return Object.freeze({
    defaultLimit: Number.isFinite(defaultLimit) ? Math.max(1, Math.trunc(defaultLimit)) : DEFAULT_LIMITS.defaultLimit,
    maxLimit: Number.isFinite(maxLimit) ? Math.max(1, Math.trunc(maxLimit)) : DEFAULT_LIMITS.maxLimit,
  });
}

export function clampCollectorLimit(value, limits = {}) {
  const safeLimits = normalizeLimits(limits);
  const n = Number(value);
  if (!Number.isFinite(n)) return safeLimits.defaultLimit;
  return Math.max(1, Math.min(safeLimits.maxLimit, Math.trunc(n)));
}

export function createCollectorContract({
  collectorId,
  sourceType,
  allowedActions = [],
  limits = {},
  safety = {},
  futureInterface = {},
} = {}) {
  const safeAllowedActions = Object.freeze(toSafeArray(allowedActions));

  return Object.freeze({
    collectorId: toSafeString(collectorId, "unknown-collector"),
    sourceType: toSafeString(sourceType, "unknown-source"),
    allowedActions: safeAllowedActions,
    limits: normalizeLimits(limits),
    safety: Object.freeze({
      ...COLLECTOR_INTERFACE_SAFETY,
      ...safety,
      readOnly: true,
      canChangeState: false,
      tokensSpent: false,
      executesRequests: false,
      mutatesExternalState: false,
    }),
    futureInterface: Object.freeze({
      requiresSeparateApproval: true,
      ...futureInterface,
    }),
  });
}

export function isCollectorActionAllowed(contract, action) {
  return toSafeArray(contract?.allowedActions).includes(toSafeString(action));
}

export function validateCollectorAction(contract, action) {
  const safeAction = toSafeString(action);
  const allowed = isCollectorActionAllowed(contract, safeAction);

  return Object.freeze({
    ok: allowed,
    collectorId: toSafeString(contract?.collectorId, "unknown-collector"),
    action: safeAction,
    allowed,
    canChangeState: false,
    tokensSpent: false,
    safety: Object.freeze({
      ...COLLECTOR_INTERFACE_SAFETY,
      ...(contract?.safety || {}),
      canChangeState: false,
      tokensSpent: false,
      executesRequests: false,
      mutatesExternalState: false,
    }),
    error: allowed ? null : `collector_action_not_allowed:${safeAction || "empty"}`,
  });
}

export function buildCollectorRequestPlan({
  contract,
  action,
  parameters = {},
  metadata = {},
} = {}) {
  const validation = validateCollectorAction(contract, action);
  const safeLimits = normalizeLimits(contract?.limits || {});
  const limit = clampCollectorLimit(parameters.limit, safeLimits);

  return Object.freeze({
    ok: validation.ok,
    collectorId: validation.collectorId,
    sourceType: toSafeString(contract?.sourceType, "unknown-source"),
    action: validation.action,
    parameters: Object.freeze({
      ...parameters,
      limit,
    }),
    metadata: Object.freeze({
      ...metadata,
      mode: "collector_request_plan_skeleton_v1",
      requestPlanOnly: true,
      executesRequests: false,
      connectedToNetwork: false,
      connectedToRuntime: false,
      connectedToAI: false,
    }),
    safety: validation.safety,
    canChangeState: false,
    tokensSpent: false,
    warnings: Object.freeze([
      "CollectorInterface builds request plans only. It does not execute API calls.",
      "Any future API connection requires separate approval and must follow existing branch patterns when applicable.",
    ]),
    error: validation.error,
  });
}

export default {
  COLLECTOR_INTERFACE_SAFETY,
  clampCollectorLimit,
  createCollectorContract,
  isCollectorActionAllowed,
  validateCollectorAction,
  buildCollectorRequestPlan,
};
