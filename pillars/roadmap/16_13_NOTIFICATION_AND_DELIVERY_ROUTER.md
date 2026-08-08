# Block 16.13 — Notification & Delivery Router

## Status
Completed.

## Goal
Create one policy-aware delivery router that decides where an already-authorized SG result should be delivered across current and future transports.

## Implemented scope
- normalized `DeliveryRequest` and `DeliveryResult` contracts;
- recipient global identity plus resource/connection target references;
- explicit distinction between `current-response` and asynchronous `notification`;
- preferred transport selection from Block 16.12 settings;
- explicit target override only through authorization checks;
- locale/user settings and timezone-aware quiet-hours integration;
- bounded timeout/retry, durable idempotency and visible delivery status;
- explicitly configured fallback transport order;
- notification disable and quiet-hours suppression/defer behavior;
- auditable/observable delivery attempts without message-content logging;
- PostgreSQL persistence through migration `173_delivery_router.sql`;
- Telegram protocol delivery moved behind the shared Delivery Router.

## Boundaries
- Delivery Router does not decide semantic intent or authorize protected actions;
- current responses are bound to their inbound origin unless an explicit authorized target is supplied;
- asynchronous/explicit delivery requires verified `can_publish` resource authority;
- cross-user delivery fails closed unless the caller supplies explicit prior authorization evidence;
- transports perform protocol delivery only;
- delivery failure is returned as delivery failure and cannot be reported as successful delivery;
- preferences never override Identity, Scope, Resource Authority, Connections or Action Gate.

## Acceptance evidence
- same normalized result can target registered Telegram/Discord/Email/Web/Voice adapters without changing core routing logic;
- retries are bounded and idempotency survives PostgreSQL service recreation;
- preferred delivery settings are honored only for an authorized target;
- disabled notifications and quiet hours are respected;
- failed/denied targets remain diagnosable through bounded status and observability;
- cross-user and cross-resource leakage tests fail closed;
- production Telegram current-response delivery uses the common router.
