# SG 2.1 — OBSERVABILITY

## Responsibility
Observability provides factual evidence about requests, decisions, model calls, gate outcomes, capability execution, failures and cost without becoming business logic.

## Trace context
Every canonical request carries:
- trace_id
- request_id
- parent_span_id when applicable
- actor reference
- transport
- environment
- revision

## Event classes
- request_received
- identity_resolved
- semantic_decision_created
- context_loaded
- capability_selected
- action_gate_decision
- model_call
- capability_started
- capability_completed
- capability_failed
- response_delivered
- audit_event

## Separation
- Audit records protected and state-changing actions.
- Telemetry measures performance, reliability and cost.
- Debug data supports diagnosis and is not durable truth.
- Runtime evidence proves what occurred but does not redefine architecture.

## Privacy and security
- Secrets and credentials are never logged.
- Private content is minimized, redacted or referenced by safe identifiers.
- Logs respect user/project/group scope.
- Access to audit and debug data is permission-controlled.
- Retention is configurable by event class and data sensitivity.

## Required outcomes
- Every failure is visible with stage, reason and correlation identifiers.
- Every AI call records model, reason, latency, token/cost metadata and outcome.
- Every protected action records actor, scope, gate decision and idempotency key.
- Evidence identifies environment, revision and test/runtime surface.
