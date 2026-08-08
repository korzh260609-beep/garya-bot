# SG 2.1 — IDENTITY AND SCOPE

## Responsibility
Identity and Scope resolves who is acting, through which platform identity, under which role and within which data/project boundary.

Resource ownership/authority is deliberately separate and is introduced by Block 16.10. Identity and Scope do not infer ownership merely from platform membership or presence in a channel/group/repository.

## Canonical identity model

```text
platform identity
→ verified identity link
→ global_user_id
→ actor roles and grants
→ active scope
```

When an action targets a concrete external or managed resource, later authority resolution extends this with:

```text
IdentityContext + ScopeContext
→ ResourceAuthorityContext
→ Action Gate
```

Canonical separation:
- Identity = who is acting.
- Scope = where the request is bounded.
- Access/grants = what action/capability is permitted.
- Resource authority = over which concrete resource that actor may act.

## Canonical contracts

### IdentityContext
- global_user_id
- platform
- platform_user_id
- link_status
- roles
- grants
- authentication_level

### ScopeContext
- user_scope
- project_scope
- group_scope
- thread_scope
- data_classification
- allowed_capabilities

## Rules
- `global_user_id` is the stable root of personal identity.
- Platform IDs are links and cannot become independent user roots.
- Transports report platform facts; they do not assign roles or grants.
- Identity linking and unlinking are state-changing audited actions.
- Guest identities remain isolated and cannot inherit another user's memory.
- Project, group and thread scopes are explicit; absence of scope never means unrestricted scope.
- The Action Gate consumes IdentityContext and ScopeContext but does not create them.
- Cross-user, cross-project or cross-group access requires explicit policy and permission.
- Membership, administrator metadata or connection presence may be evidence for Resource Authority verification, but none is automatically equivalent to ownership.
- Resource authority must be explicit, provenance-backed and revocable.
- Identity, linking, ownership or authority must never depend on secret words, commands, phrases or keyword hacks.

## CanonicalRequest identity fields
- trace_id
- channel
- identity_context
- scope_context
- input
- locale
- timestamp
