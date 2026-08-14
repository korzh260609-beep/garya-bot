# Block 16.15 — Schema & Contract Versioning

## Status
Completed.

## Goal
Create explicit versioning and compatibility rules for SG contracts and durable records so older persisted data and queued work remain safe as the platform evolves.

## Implemented scope
- centralized transport-independent contract version registry in `src/contracts/contractVersioning.js`;
- explicit `major.minor` contract versions independent from PostgreSQL `schema_migrations`;
- critical contract policies for CanonicalInput, ContextBundle, memory records, task payloads, capability inputs/results, internal events, resource records, user settings and domain data;
- deterministic backward compatibility through explicit registered adapters only;
- fail-closed forward compatibility: unknown newer versions are rejected rather than guessed;
- unsupported/non-adaptable durable records can be placed in explicit quarantine instead of being silently reinterpreted;
- in-memory and PostgreSQL quarantine stores, with migration `175_contract_versioning.sql`;
- adapter guard prevents changes to authorization-/trust-sensitive fields such as identity, project/resource scope, grants, permissions, resource authority, trust and credential/connection handles;
- version-aware observability events for resolve, adapt and quarantine lifecycle without payload logging;
- explicit deprecation metadata and removal policy for supported legacy versions;
- deterministic prior-version fixtures for every critical contract;
- approved old internal-event fixtures migrate before replay through the current typed Event Bus contract;
- queued task fixtures preserve current authorization-sensitive evidence so replay still enters current safety/authorization behavior.

## Compatibility policy

### Current version
The foundational Block 16.15 policies use contract version `1.0`.

### Backward compatibility
A prior durable/cross-module record is accepted only when:
1. its version is explicitly listed as supported;
2. an explicit adapter exists when it is not already current;
3. the adapter produces the declared current version;
4. protected identity/scope/access/authority/trust fields are unchanged.

No heuristic field guessing or implicit reinterpretation is allowed.

### Forward compatibility
Unknown future versions are rejected with `contract-version-unsupported`. Durable readers may explicitly quarantine them for operator inspection/recovery.

### Deprecation lifecycle
A deprecated version remains readable only through its explicit adapter. Removal requires:
- an explicit release decision/release note;
- evidence that active usage has reached zero or an approved migration window has completed;
- retained migration/rollback fixtures for the supported release boundary.

## Persistence and rollback
- PostgreSQL schema migration numbers remain database-layout history only; they are not payload contract versions.
- Unsupported durable records are stored in `contract_quarantine` with contract name, version, reason, safe trace metadata and the quarantined record.
- Rollback does not rewrite newer unknown records into an older meaning. An older runtime must reject/quarantine an unsupported newer contract version.
- Forward migration is deterministic and explicit; supported old records are adapted in memory to the current contract before current handlers consume them.
- Database destructive downgrade is not automatic. Schema rollback follows the repository release/rollback protocol while payload compatibility remains governed by contract policies.

## Security and architecture boundaries
- database migration numbers alone are not sufficient contract versioning;
- silent reinterpretation of old payloads is forbidden;
- version adapters cannot broaden permissions, scope, identity, resource authority, trust or credential/connection references;
- migration never grants a role, permission, ownership relation or capability;
- old task/event replay must still pass current safety/authorization rules where applicable;
- Event Bus remains facts-only; contract migration cannot turn events into commands;
- Contract Versioning does not become Decision Engine, Action Gate, Capability Executor or Feature Flag policy.

## Acceptance verification
- every critical durable/cross-module contract has an explicit compatibility policy;
- unsupported versions fail visibly or are explicitly quarantined;
- tests cover at least one `0.9 → 1.0` deterministic fixture per critical contract;
- missing adapters fail rather than guessing;
- adapters that alter protected authorization/trust fields are rejected;
- old event fixtures migrate and replay through the current event contract;
- old task fixtures retain authorization-sensitive fields for current safety checks;
- rollback/forward-migration behavior is documented above.

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
