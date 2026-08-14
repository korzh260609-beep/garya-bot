export const OBSERVABILITY_EVENT_CLASSES = Object.freeze([
  'request_received',
  'identity_resolved',
  'policy_context_resolved',
  'language_context_resolved',
  'feature_flag_resolved',
  'semantic_decision_created',
  'context_loaded',
  'capability_selected',
  'action_gate_decision',
  'model_call',
  'capability_started',
  'capability_completed',
  'capability_failed',
  'final_response_observed',
  'delivery_attempt',
  'delivery_completed',
  'telegram_update_completed',
  'response_delivered',
  'audit_event'
]);

export const OBSERVABILITY_CHANNELS = Object.freeze(['audit', 'telemetry', 'debug']);

function required(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value;
}

function finiteNonNegative(value, field) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be a finite non-negative number`);
  return number;
}

export function createObservabilityEvent(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('event input is required');
  const eventClass = required(input.eventClass, 'eventClass');
  const channel = required(input.channel, 'channel');
  if (!OBSERVABILITY_EVENT_CLASSES.includes(eventClass)) throw new TypeError(`Unsupported eventClass: ${eventClass}`);
  if (!OBSERVABILITY_CHANNELS.includes(channel)) throw new TypeError(`Unsupported channel: ${channel}`);
  const traceContext = input.traceContext;
  if (!traceContext?.traceId || !traceContext?.requestId || !traceContext?.environment || !traceContext?.revision) {
    throw new TypeError('traceContext with traceId, requestId, environment and revision is required');
  }
  return Object.freeze({
    eventId: required(input.eventId, 'eventId'),
    eventClass,
    channel,
    occurredAt: required(input.occurredAt, 'occurredAt'),
    stage: required(input.stage ?? eventClass, 'stage'),
    outcome: input.outcome ?? null,
    traceContext: Object.freeze({
      traceId: traceContext.traceId,
      requestId: traceContext.requestId,
      parentSpanId: traceContext.parentSpanId ?? null,
      environment: traceContext.environment,
      revision: traceContext.revision
    }),
    actorRef: input.actorRef ?? null,
    transport: input.transport ?? null,
    scopeRef: input.scopeRef ?? null,
    reason: input.reason ?? null,
    durationMs: finiteNonNegative(input.durationMs, 'durationMs'),
    costUsd: finiteNonNegative(input.costUsd, 'costUsd'),
    data: Object.freeze({ ...(input.data ?? {}) })
  });
}
