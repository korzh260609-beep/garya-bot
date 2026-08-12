function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

function stringList(value, field) {
  const list = [...(value ?? [])];
  if (!list.every((entry) => typeof entry === 'string' && entry.trim() !== '')) {
    throw new TypeError(`${field} must contain non-empty strings`);
  }
  return Object.freeze([...new Set(list)]);
}

function optionalString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function createDescriptiveIdentityProfile(value) {
  if (value == null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('identity profile must be an object');
  const profile = {
    displayName: optionalString(value.displayName),
    preferredName: optionalString(value.preferredName),
    firstName: optionalString(value.firstName),
    lastName: optionalString(value.lastName),
    username: optionalString(value.username),
    languageCode: optionalString(value.languageCode),
    source: optionalString(value.source)
  };
  if (!Object.values(profile).some(Boolean)) return null;
  return Object.freeze(profile);
}

export const IDENTITY_LINK_STATUSES = Object.freeze(['linked', 'guest', 'unlinked', 'local-fixture']);

export function createIdentityContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('identity input is required');
  const linkStatus = input.linkStatus ?? 'local-fixture';
  if (!IDENTITY_LINK_STATUSES.includes(linkStatus)) throw new TypeError(`Unsupported linkStatus: ${linkStatus}`);
  return Object.freeze({
    globalUserId: requireNonEmptyString(input.globalUserId, 'globalUserId'),
    platform: requireNonEmptyString(input.platform, 'platform'),
    platformUserId: requireNonEmptyString(input.platformUserId, 'platformUserId'),
    linkStatus,
    roles: stringList(input.roles, 'roles'),
    grants: stringList(input.grants, 'grants'),
    authenticationLevel: requireNonEmptyString(input.authenticationLevel ?? 'fixture', 'authenticationLevel'),
    profile: createDescriptiveIdentityProfile(input.profile)
  });
}

export function createScopeContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('scope input is required');
  const workspaceScope = input.workspaceScope == null ? null : requireNonEmptyString(input.workspaceScope, 'workspaceScope');
  if (workspaceScope !== null && !workspaceScope.startsWith('tgw_')) {
    throw new TypeError('workspaceScope must be a canonical tgw_* workspace id');
  }
  return Object.freeze({
    userScope: requireNonEmptyString(input.userScope, 'userScope'),
    projectScope: requireNonEmptyString(input.projectScope, 'projectScope'),
    groupScope: input.groupScope == null ? null : requireNonEmptyString(input.groupScope, 'groupScope'),
    threadScope: input.threadScope == null ? null : requireNonEmptyString(input.threadScope, 'threadScope'),
    workspaceScope,
    dataClassification: requireNonEmptyString(input.dataClassification ?? 'internal', 'dataClassification'),
    allowedCapabilities: stringList(input.allowedCapabilities, 'allowedCapabilities')
  });
}

export function createTraceContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('trace input is required');
  return Object.freeze({
    traceId: requireNonEmptyString(input.traceId, 'traceId'),
    requestId: requireNonEmptyString(input.requestId, 'requestId'),
    parentSpanId: input.parentSpanId ?? null,
    environment: requireNonEmptyString(input.environment, 'environment'),
    revision: requireNonEmptyString(input.revision, 'revision')
  });
}