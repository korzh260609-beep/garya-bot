# Block 16.13 — Notification & Delivery Router

## Status
Planned.

## Goal
Create one policy-aware delivery router that decides where an already-authorized SG result should be delivered across current and future transports.

## Required scope
- normalized DeliveryRequest and DeliveryResult contracts;
- recipient global identity and target resource/connection references;
- current-response delivery vs asynchronous notification distinction;
- preferred transport/channel selection;
- explicit target override when authorized;
- language/locale and Temporal Context integration;
- retry, timeout, deduplication and delivery status;
- fallback delivery policy where explicitly configured;
- quiet hours and notification preferences where applicable;
- observability and auditable delivery attempts.

## Boundaries
- Delivery Router does not decide semantic intent or authorize protected actions;
- it cannot deliver to a resource unless Identity/Scope/Resource Authority allow it;
- transports perform protocol delivery only;
- delivery failure must not be reported as successful execution;
- cross-user delivery requires explicit authorization.

## Acceptance criteria
- the same task result can be routed to approved Telegram, Discord, Email, Web or future targets without changing core logic;
- retries are bounded and idempotent;
- preferred delivery settings are honored only within policy;
- failed targets remain visible and diagnosable;
- cross-resource and cross-user leakage tests pass.
