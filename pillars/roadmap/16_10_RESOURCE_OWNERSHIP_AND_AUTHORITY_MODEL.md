# Block 16.10 — Resource Ownership & Authority Model

## Status
Completed and CI-verified.

## Goal
Give SG a canonical model of which real or digital resources a person or project owns, manages or may act upon, separately from identity and generic permissions.

## Implemented scope
- stable `resource_id`, resource type, provider/platform and external identifier;
- durable PostgreSQL `managed_resources` and `resource_authorities` tables via `170_resource_authority.sql`;
- explicit relations: `owns`, `administers`, `manages`, `can_read`, `can_publish`, `can_modify`;
- actor/resource/project relationships and verified provenance;
- delegated authority that cannot exceed the delegator's effective authority;
- revocation and expiry with fail-closed checks;
- resource hierarchy with explicit `applies_to_descendants` inheritance only;
- optional linkage to a Block 16.9 `connection_id` without treating connection as ownership proof;
- production Resource Authority Registry and PostgreSQL/in-memory stores;
- runtime authority resolution before protected resource execution;
- Action Gate `resourceAuthority` check in addition to identity, scope and generic permission;
- audit events for resource registration/verification, authority grant/delegation/revocation and runtime authority resolution;
- production diagnostics surface `resourceAuthority: ready` without leaking resource metadata.

## Canonical separation

```text
Identity           = WHO is acting
Scope              = WHERE the request is bounded
Access / Grants    = WHAT KIND OF ACTION is permitted
Resource Authority = OVER WHICH RESOURCE the actor may act
Action Gate        = whether this concrete action may proceed now
```

## Boundaries
- platform membership alone does not prove ownership;
- adding SG to a group/channel does not automatically grant unrestricted authority;
- a Block 16.9 external connection is not resource ownership proof;
- authority on a parent resource does not propagate unless `applies_to_descendants=true`;
- resource authority cannot merge identities or broaden project scope;
- generic role/grant possession cannot substitute for resource authority;
- a resource-targeted action without matching authority evidence fails closed in Action Gate;
- no command/keyword/secret-phrase identity or authority hacks are used.

## Acceptance evidence
- [x] SG distinguishes owner, administrator, manager and ordinary participant;
- [x] multiple resources belonging to one user remain independently addressable;
- [x] different users' resources and different project scopes cannot be confused;
- [x] delegation is explicit, bounded by delegator authority, revocable and auditable;
- [x] hierarchy inheritance is explicit and tested;
- [x] revoked/expired/unverified authority cannot authorize execution;
- [x] resource authority survives PostgreSQL restart;
- [x] Action Gate rejects missing, mismatched or forged authority evidence;
- [x] runtime resolves authority before Action Gate when a decision declares `resourceRequirement`;
- [x] automated unit and PostgreSQL integration tests cover ownership, delegation, revocation, hierarchy and cross-user/project isolation.

## Implementation files
- `src/authority/resourceAuthorityRegistry.js`
- `src/authority/postgresResourceAuthorityStore.js`
- `src/authority/deploymentResourceAuthority.js`
- `src/persistence/migrations/170_resource_authority.sql`
- `src/contracts/action.js`
- `src/action/actionGate.js`
- `src/runtime/createProductionRuntime.js`
- `src/runtime/localProductionHarness.js`
- `tests/resourceAuthority.test.js`
- `tests/resourceAuthorityPostgres.test.js`

## Next dependency
Block 16.11 — Session & Conversation Context consumes the established Identity/Scope boundaries while remaining separate from long-term memory and Resource Authority.
