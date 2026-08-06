function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
  return value;
}

export function createIdentityContext(input) {
  if (!input || typeof input !== 'object') throw new TypeError('identity input is required');
  return Object.freeze({
    globalUserId: requireNonEmptyString(input.globalUserId, 'globalUserId'),
    platform: requireNonEmptyString(input.platform, 'platform'),
    platformUserId: requireNonEmptyString(input.platformUserId, 'platformUserId'),
    linkStatus: input.linkStatus ?? 'local-fixture',
    roles: Object.freeze([...(input.roles ?? [])]),
    grants: Object.freeze([...(input.grants ?? [])]),
    authenticationLevel: input.authenticationLevel ?? 'fixture'
  });
}

export function createScopeContext(input) {
  if (!input || typeof input !== 'object') throw new TypeError('scope input is required');
  return Object.freeze({
    userScope: requireNonEmptyString(input.userScope, 'userScope'),
    projectScope: requireNonEmptyString(input.projectScope, 'projectScope'),
    groupScope: input.groupScope ?? null,
    threadScope: input.threadScope ?? null,
    dataClassification: input.dataClassification ?? 'internal',
    allowedCapabilities: Object.freeze([...(input.allowedCapabilities ?? [])])
  });
}

export function createTraceContext(input) {
  if (!input || typeof input !== 'object') throw new TypeError('trace input is required');
  return Object.freeze({
    traceId: requireNonEmptyString(input.traceId, 'traceId'),
    requestId: requireNonEmptyString(input.requestId, 'requestId'),
    parentSpanId: input.parentSpanId ?? null,
    environment: requireNonEmptyString(input.environment, 'environment'),
    revision: requireNonEmptyString(input.revision, 'revision')
  });
}
