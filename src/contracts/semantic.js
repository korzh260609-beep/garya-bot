function requireObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${field} must be an object`);
  }
  return value;
}

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value, field) {
  if (value == null) return null;
  return requireNonEmptyString(value, field);
}

function freezeArray(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze(value.map((item) => Object.freeze({ ...requireObject(item, `${field} item`) })));
}

export function createCanonicalInput(input) {
  requireObject(input, 'canonical input');
  return Object.freeze({
    text: requireNonEmptyString(input.text, 'text'),
    locale: requireNonEmptyString(input.locale ?? 'ru', 'locale'),
    identityContext: requireObject(input.identityContext, 'identityContext'),
    scopeContext: requireObject(input.scopeContext, 'scopeContext'),
    traceContext: requireObject(input.traceContext, 'traceContext'),
    metadata: Object.freeze({ ...(input.metadata ?? {}) })
  });
}

export function createSemanticInterpretation(input) {
  requireObject(input, 'semantic interpretation');
  const uncertainty = Number(input.uncertainty ?? 0);
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 1) {
    throw new TypeError('uncertainty must be between 0 and 1');
  }

  return Object.freeze({
    meaning: requireNonEmptyString(input.meaning, 'meaning'),
    goal: requireNonEmptyString(input.goal, 'goal'),
    intent: requireNonEmptyString(input.intent, 'intent'),
    entities: freezeArray(input.entities ?? [], 'entities'),
    constraints: freezeArray(input.constraints ?? [], 'constraints'),
    uncertainty,
    missingInformation: Object.freeze([...(input.missingInformation ?? [])].map((item) => requireNonEmptyString(item, 'missingInformation item'))),
    clarificationQuestion: optionalString(input.clarificationQuestion, 'clarificationQuestion'),
    contextNeeds: Object.freeze([...(input.contextNeeds ?? [])].map((item) => requireNonEmptyString(item, 'contextNeeds item'))),
    evidenceNeeds: Object.freeze([...(input.evidenceNeeds ?? [])].map((item) => requireNonEmptyString(item, 'evidenceNeeds item'))),
    memoryQuery: optionalString(input.memoryQuery, 'memoryQuery'),
    memoryCandidates: freezeArray(input.memoryCandidates ?? [], 'memoryCandidates'),
    candidateActions: freezeArray(input.candidateActions ?? [], 'candidateActions'),
    rationale: optionalString(input.rationale, 'rationale')
  });
}

export function createDecisionEnvelope(input) {
  requireObject(input, 'decision envelope');
  const allowedTypes = new Set(['answer', 'clarification', 'prepare', 'execute']);
  const decisionType = requireNonEmptyString(input.decisionType, 'decisionType');
  if (!allowedTypes.has(decisionType)) throw new TypeError(`unsupported decisionType: ${decisionType}`);

  return Object.freeze({
    version: '1.0',
    traceId: requireNonEmptyString(input.traceId, 'traceId'),
    requestId: requireNonEmptyString(input.requestId, 'requestId'),
    decisionType,
    goal: requireNonEmptyString(input.goal, 'goal'),
    intent: requireNonEmptyString(input.intent, 'intent'),
    selectedAction: Object.freeze({ ...requireObject(input.selectedAction, 'selectedAction') }),
    contextNeeds: Object.freeze([...(input.contextNeeds ?? [])]),
    evidenceNeeds: Object.freeze([...(input.evidenceNeeds ?? [])]),
    clarificationQuestion: optionalString(input.clarificationQuestion, 'clarificationQuestion'),
    rationale: optionalString(input.rationale, 'rationale'),
    diagnostics: Object.freeze({ ...(input.diagnostics ?? {}) })
  });
}

export function createResponsePlan(input) {
  requireObject(input, 'response plan');
  return Object.freeze({
    mode: requireNonEmptyString(input.mode, 'mode'),
    message: requireNonEmptyString(input.message, 'message'),
    requiresConfirmation: Boolean(input.requiresConfirmation),
    preparedAction: input.preparedAction ? Object.freeze({ ...requireObject(input.preparedAction, 'preparedAction') }) : null
  });
}
