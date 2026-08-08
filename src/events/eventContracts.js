const EVENT_TYPE_LIST = [
  'identity.linked','identity.unlinked',
  'connection.connected','connection.reconnected','connection.verified','connection.revoked','connection.status-changed',
  'resource.registered','resource.updated','resource.authority-granted','resource.authority-revoked','resource.authority-verified',
  'conversation.started','conversation.continued','conversation.topic-changed','conversation.closed',
  'memory.written','memory.conflict','memory.expired',
  'task.created','task.queued','task.started','task.completed','task.failed','task.cancelled',
  'schedule.created','schedule.triggered','schedule.paused','schedule.resumed','schedule.cancelled',
  'capability.started','capability.succeeded','capability.failed',
  'delivery.delivered','delivery.suppressed','delivery.deferred','delivery.failed',
  'failure.recorded'
];

export const INTERNAL_EVENT_TYPES = Object.freeze(EVENT_TYPE_LIST);
export const INTERNAL_EVENT_TYPE_SET = new Set(INTERNAL_EVENT_TYPES);
export const INTERNAL_EVENT_VERSION = '1.0';
export const EVENT_PRIVACY_CLASSES = Object.freeze(['internal','sensitive']);

const FORBIDDEN_KEY = /^(?:secret|token|password|api[_-]?key|access[_-]?token|refresh[_-]?token|credential(?:value)?|prompt|raw|content|message|text|body)$/i;
const MAX_PAYLOAD_BYTES = 32 * 1024;

function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function optional(value) { return value == null || String(value).trim() === '' ? null : String(value).trim(); }
function plainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
  return value;
}
function clone(value) { return value == null ? value : structuredClone(value); }
function assertSafe(value, path = 'payload') {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return;
  if (typeof value === 'string') return;
  if (Array.isArray(value)) { for (let i = 0; i < value.length; i += 1) assertSafe(value[i], `${path}[${i}]`); return; }
  if (typeof value !== 'object') throw new TypeError(`${path} contains unsupported value`);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new TypeError(`${path}.${key} is forbidden in internal event payloads`);
    assertSafe(nested, `${path}.${key}`);
  }
}
function safeObject(value, name) {
  const object = plainObject(value ?? {}, name);
  assertSafe(object, name);
  const encoded = JSON.stringify(object);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PAYLOAD_BYTES) throw new TypeError(`${name} exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  return Object.freeze(JSON.parse(encoded));
}
function normalizeTrace(value) {
  const trace = plainObject(value, 'traceContext');
  return Object.freeze({
    traceId: required(trace.traceId, 'traceContext.traceId'),
    requestId: required(trace.requestId, 'traceContext.requestId'),
    environment: optional(trace.environment),
    revision: optional(trace.revision)
  });
}
function normalizeScope(value) {
  const scope = plainObject(value, 'scope');
  return Object.freeze({
    globalUserId: optional(scope.globalUserId),
    projectScope: required(scope.projectScope, 'scope.projectScope'),
    groupScope: optional(scope.groupScope),
    threadScope: optional(scope.threadScope),
    resourceId: optional(scope.resourceId)
  });
}

export function createInternalEventEnvelope(input, { idFactory, clock = () => new Date() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('internal event input is required');
  const eventType = required(input.eventType, 'eventType');
  if (!INTERNAL_EVENT_TYPE_SET.has(eventType)) throw new TypeError(`unsupported internal event type: ${eventType}`);
  const version = required(input.version ?? INTERNAL_EVENT_VERSION, 'version');
  if (version !== INTERNAL_EVENT_VERSION) throw new TypeError(`unsupported internal event version: ${version}`);
  const privacyClass = required(input.privacyClass ?? 'internal', 'privacyClass');
  if (!EVENT_PRIVACY_CLASSES.includes(privacyClass)) throw new TypeError(`unsupported privacy class: ${privacyClass}`);
  const eventId = optional(input.eventId) ?? `event:${required(idFactory?.(), 'generated event id')}`;
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : clock();
  if (Number.isNaN(occurredAt.getTime())) throw new TypeError('occurredAt must be a valid timestamp');
  return Object.freeze({
    eventId,
    eventType,
    version,
    occurredAt: occurredAt.toISOString(),
    traceContext: normalizeTrace(input.traceContext),
    scope: normalizeScope(input.scope),
    actorGlobalUserId: optional(input.actorGlobalUserId),
    privacyClass,
    orderingKey: optional(input.orderingKey),
    provenance: safeObject(input.provenance ?? {}, 'provenance'),
    payload: safeObject(input.payload ?? {}, 'payload')
  });
}

export function assertInternalEventEnvelope(event) {
  return createInternalEventEnvelope(event, { idFactory: () => String(event?.eventId ?? '').replace(/^event:/, '') || 'validated', clock: () => new Date(event?.occurredAt ?? 0) });
}
