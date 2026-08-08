# Block 16.15 — Schema & Contract Versioning

## Status
Planned.

## Goal
Create explicit versioning and compatibility rules for SG contracts and durable records so older persisted data and queued work remain safe as the platform evolves.

## Required scope
- version fields for durable and cross-module contracts where needed;
- compatibility policy for CanonicalInput, contexts, memory records, task payloads, capability inputs/results, events, resource records, user settings and domain data;
- forward/backward compatibility rules;
- migrations and adapters for supported versions;
- rejection/quarantine of unsupported versions;
- version-aware observability and diagnostics;
- contract deprecation lifecycle;
- fixtures proving old data can be read or migrated deterministically.

## Boundaries
- database migration numbers alone are not sufficient contract versioning;
- silent reinterpretation of old payloads is forbidden;
- version adapters cannot broaden permissions, scope or trust;
- old task/event replay must still pass current safety/authorization rules where applicable.

## Acceptance criteria
- every versioned durable contract has an explicit compatibility policy;
- unsupported versions fail visibly rather than being guessed;
- migration tests cover at least one prior-version fixture per critical contract;
- queued tasks/events survive approved upgrades without semantic corruption;
- rollback and forward migration behavior is documented and tested.
