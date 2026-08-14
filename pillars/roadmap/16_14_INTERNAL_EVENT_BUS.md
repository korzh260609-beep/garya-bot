# Block 16.14 — Internal Event Bus

## Status
Completed.

## Goal
Introduce one internal event mechanism so SG subsystems can react to approved state changes and lifecycle events without hard-wiring modules directly to one another.

## Implemented scope
- canonical typed `InternalEventEnvelope` with `eventId`, `eventType`, contract `version`, timestamp, trace context, actor, bounded scope, privacy class, ordering key, provenance and minimized payload;
- explicit lifecycle event contracts for identity, connection, resource, conversation, memory, task, schedule, capability, delivery and failure domains;
- synchronous subscribers for immediate internal projections/observers;
- durable/asynchronous subscribers backed by PostgreSQL;
- subscriber registration with event-type, privacy, project, user and resource filters;
- idempotent durable delivery keyed by `(event_id, subscriber_id)`;
- bounded retry, dead-letter state and explicit requeue recovery;
- stale `processing` claim recovery after worker interruption/restart;
- worker lifecycle (`start`/`stop`) plus explicit `drain` for deterministic workers/tests;
- event provenance and trace-context propagation into observability;
- payload minimization: raw secrets/credentials/tokens/passwords and unnecessary raw message/text/content/body fields are rejected; payload size is bounded;
- ordering metadata exists only as an explicit `orderingKey`; no accidental global ordering guarantee is claimed;
- PostgreSQL migration `174_internal_event_bus.sql` persists event facts, subscriptions and durable consumer deliveries.

## Security and architecture boundaries
- Event Bus carries facts/events only. It is not Decision Engine, Action Gate, capability execution or transport command routing.
- Event names are typed contracts and arbitrary command-like event names are rejected.
- A subscriber receiving an event gains no new identity, role, grant, ownership or resource authority.
- Protected effects triggered by consumers must still enter the normal Identity → Scope → Access/Resource Authority → Action Gate → Capability path.
- Scope matching is fail-closed for project/user/resource-bound subscriptions.
- Cross-user/project/resource event leakage is covered by tests.
- Raw credentials and unnecessary raw message bodies are not valid event payloads.

## Acceptance verification
- adding a new consumer requires subscriber registration only; producer business logic does not reference consumers;
- duplicate publication cannot create duplicate durable consumer delivery;
- transient consumer failures retry boundedly and terminal failures become visible dead letters;
- dead letters can be explicitly requeued and recovered;
- trace context is retained from originating work through event observability;
- stale in-flight work can be reclaimed after interruption;
- PostgreSQL durability is verified across persistence restart;
- privacy/scope tests prove cross-boundary subscriptions do not receive unrelated events.

## Required scope
- typed event envelope with event_id, event_type, version, timestamp, trace context and bounded payload;
- synchronous and durable/asynchronous delivery modes where appropriate;
- events for identity, connection, resource, conversation, memory, task, schedule, capability, delivery and failure lifecycle;
- subscriber registration and isolation;
- idempotent event handling;
- retry/dead-letter behavior for durable consumers;
- event provenance and observability;
- privacy classification and payload minimization;
- ordering guarantees only where explicitly required.

## Boundaries
- Event Bus carries facts/events; it does not become Decision Engine or Action Gate;
- subscribers cannot use events to bypass permissions or perform protected actions without the normal gate path;
- raw secrets and unnecessary message content are forbidden in event payloads;
- event names are contracts, not keyword commands.

## Acceptance criteria
- new consumers can subscribe without modifying event producers' business logic;
- duplicate delivery does not cause duplicate protected effects;
- failed durable consumers are visible and recoverable;
- trace context connects events to originating work;
- privacy and scope tests prove events do not leak cross-user/project data.
