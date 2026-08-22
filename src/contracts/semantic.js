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

function freezeObject(value, field, { nullable = false } = {}) {
  if (value == null && nullable) return null;
  return Object.freeze({ ...requireObject(value, field) });
}

function freezeArray(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze(value.map((item) => Object.freeze({ ...requireObject(item, `${field} item`) })));
}

function boundedConfidence(value, field = 'confidence') {
  const confidence = Number(value);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new TypeError(`${field} must be between 0 and 1`);
  }
  return confidence;
}

function conversationHistoryQuery(value) {
  if (value == null) return null;
  const input = requireObject(value, 'conversationHistoryQuery');
  const scope = input.scope ?? 'current-scope';
  if (!['current-scope', 'current-conversation', 'current-topic'].includes(scope)) throw new TypeError('conversationHistoryQuery.scope is invalid');
  const maxRecords = Number(input.maxRecords ?? 100);
  if (!Number.isInteger(maxRecords) || maxRecords < 1 || maxRecords > 200) throw new TypeError('conversationHistoryQuery.maxRecords must be 1..200');
  return Object.freeze({
    query: requireNonEmptyString(input.query, 'conversationHistoryQuery.query'),
    temporalExpression: optionalString(input.temporalExpression, 'conversationHistoryQuery.temporalExpression'),
    scope,
    maxRecords
  });
}

function subsystemRequest(value) {
  if (value == null) return null;
  const input = requireObject(value, 'subsystemRequest');
  const name = requireNonEmptyString(input.name, 'subsystemRequest.name');
  if (name !== 'telegram-workspace-manager') throw new TypeError(`unsupported subsystemRequest.name: ${name}`);
  const operation = requireNonEmptyString(input.operation, 'subsystemRequest.operation');
  if (!['configure', 'configuration-history'].includes(operation)) throw new TypeError(`unsupported subsystemRequest.operation: ${operation}`);
  return Object.freeze({ name, operation });
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
    target: freezeObject(input.target, 'target', { nullable: true }),
    action: freezeObject(input.action, 'action', { nullable: true }),
    timeExpression: freezeObject(input.timeExpression, 'timeExpression', { nullable: true }),
    scope: freezeObject(input.scope, 'scope', { nullable: true }),
    parameters: freezeObject(input.parameters ?? {}, 'parameters'),
    delivery: freezeObject(input.delivery, 'delivery', { nullable: true }),
    confidence: boundedConfidence(input.confidence ?? (1 - uncertainty)),
    provenance: freezeObject(input.provenance ?? {}, 'provenance'),
    entities: freezeArray(input.entities ?? [], 'entities'),
    constraints: freezeArray(input.constraints ?? [], 'constraints'),
    uncertainty,
    missingInformation: Object.freeze([...(input.missingInformation ?? [])].map((item) => requireNonEmptyString(item, 'missingInformation item'))),
    clarificationQuestion: optionalString(input.clarificationQuestion, 'clarificationQuestion'),
    contextNeeds: Object.freeze([...(input.contextNeeds ?? [])].map((item) => requireNonEmptyString(item, 'contextNeeds item'))),
    evidenceNeeds: Object.freeze([...(input.evidenceNeeds ?? [])].map((item) => requireNonEmptyString(item, 'evidenceNeeds item'))),
    memoryQuery: optionalString(input.memoryQuery, 'memoryQuery'),
    conversationHistoryQuery: conversationHistoryQuery(input.conversationHistoryQuery),
    subsystemRequest: subsystemRequest(input.subsystemRequest),
    memoryCandidates: freezeArray(input.memoryCandidates ?? [], 'memoryCandidates'),
    candidateActions: freezeArray(input.candidateActions ?? [], 'candidateActions'),
    rationale: optionalString(input.rationale, 'rationale')
  });
}

export function createCanonicalSemanticModel(input) {
  requireObject(input, 'canonical semantic model');
  const resolutionStatus = requireNonEmptyString(input.resolutionStatus ?? 'resolved', 'resolutionStatus');
  if (!['resolved', 'clarification-required'].includes(resolutionStatus)) {
    throw new TypeError(`unsupported resolutionStatus: ${resolutionStatus}`);
  }
  return Object.freeze({
    version: '1.0',
    resolutionStatus,
    intent: requireNonEmptyString(input.intent, 'intent'),
    goal: requireNonEmptyString(input.goal, 'goal'),
    target: freezeObject(input.target, 'target', { nullable: true }),
    action: freezeObject(input.action, 'action'),
    timeExpression: freezeObject(input.timeExpression, 'timeExpression', { nullable: true }),
    scope: freezeObject(input.scope, 'scope', { nullable: true }),
    parameters: freezeObject(input.parameters ?? {}, 'parameters'),
    delivery: freezeObject(input.delivery, 'delivery', { nullable: true }),
    confidence: boundedConfidence(input.confidence),
    missingInformation: Object.freeze([...(input.missingInformation ?? [])].map((item) => requireNonEmptyString(item, 'missingInformation item'))),
    clarificationQuestion: optionalString(input.clarificationQuestion, 'clarificationQuestion'),
    provenance: freezeObject(input.provenance ?? {}, 'provenance'),
    diagnostics: freezeObject(input.diagnostics ?? {}, 'diagnostics')
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
