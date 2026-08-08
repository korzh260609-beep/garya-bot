# Block 16.14 — Internal Event Bus

## Status
Planned.

## Goal
Introduce one internal event mechanism so SG subsystems can react to approved state changes and lifecycle events without hard-wiring modules directly to one another.

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
