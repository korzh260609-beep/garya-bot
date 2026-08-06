import { randomUUID } from 'node:crypto';
import { createObservabilityEvent } from '../contracts/observability.js';
import { redactObservabilityData } from './redaction.js';

export function createObservabilityService({ store, clock = () => new Date().toISOString(), idFactory = randomUUID } = {}) {
  if (!store?.append || !store?.list) throw new TypeError('observability store is required');
  if (typeof clock !== 'function' || typeof idFactory !== 'function') throw new TypeError('clock and idFactory must be functions');

  function record(input) {
    const event = createObservabilityEvent({
      ...input,
      eventId: input.eventId ?? idFactory(),
      occurredAt: input.occurredAt ?? clock(),
      data: redactObservabilityData(input.data ?? {})
    });
    store.append(event);
    return event;
  }

  return Object.freeze({
    record,
    recordModelCall({ traceContext, actorRef, transport, model, provider, reason, outcome, durationMs, costUsd, usage, error }) {
      return record({
        eventClass: 'model_call', channel: 'telemetry', stage: 'ai-router', traceContext, actorRef, transport,
        reason, outcome, durationMs, costUsd,
        data: { model, provider, usage, error }
      });
    },
    recordFailure({ traceContext, stage, reason, code, channel = 'telemetry', actorRef, scopeRef, data }) {
      return record({
        eventClass: stage === 'capability' ? 'capability_failed' : 'audit_event',
        channel, stage, traceContext, actorRef, scopeRef, reason, outcome: 'failed', data: { code, ...data }
      });
    },
    recordProtectedAction({ traceContext, actorRef, scopeRef, gateDecision, idempotencyKey, capability, outcome }) {
      return record({
        eventClass: 'audit_event', channel: 'audit', stage: 'protected-action', traceContext, actorRef, scopeRef,
        reason: gateDecision?.reason ?? null, outcome,
        data: { gateOutcome: gateDecision?.outcome, authorized: gateDecision?.authorized, idempotencyKey, capability }
      });
    },
    list: (query) => store.list(query)
  });
}
