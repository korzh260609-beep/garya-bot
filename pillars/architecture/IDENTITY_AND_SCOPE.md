# SG 2.1 — IDENTITY AND SCOPE

## Responsibility
Identity and Scope resolves who is acting, through which platform identity, under which role and within which data/project boundary.

Resource ownership/authority is deliberately separate and is introduced by Block 16.10. Identity and Scope do not infer ownership merely from platform membership or presence in a channel/group/repository.

## Canonical identity model

```text
platform identity
→ verified identity link
→ canonical global_user_id (`usr_...`)
→ actor roles and grants
→ active scope
```

`global_user_id` is the stable root of a human identity inside SG. Platform IDs are links only and must not be used as canonical user roots.

New real users receive an SG-issued canonical ID in the form `usr_<random-id>`. Production code must not create new canonical identities in forms such as `telegram:<id>` or `tg:<id>`.

Existing verified platform links reuse the already linked canonical `global_user_id`. Legacy platform-shaped global IDs must be migrated transactionally to a canonical `usr_...` identity without losing scoped memory, settings, roles, grants, conversations, tasks or other user-owned records.

## Monarch / owner identity

The canonical owner identity is `MONARCH_GLOBAL_USER_ID` (or its SG-prefixed deployment alias `SG_MONARCH_GLOBAL_USER_ID`). It must contain the owner's canonical `usr_...` identity.

`MONARCH_USER_ID` / `SG_MONARCH_TELEGRAM_USER_ID` is only the trusted Telegram bootstrap/link for the owner's Telegram account. It does not itself grant owner authority.

Canonical owner resolution:

```text
Telegram platform_user_id
→ verified/bootstrap Identity Link
→ global_user_id
→ compare with MONARCH_GLOBAL_USER_ID
→ owner/Monarch authority
```

If the configured owner Telegram account has no identity link yet, bootstrap links that platform account directly to `MONARCH_GLOBAL_USER_ID`. If a legacy/wrong prior link exists for that trusted owner account, it must be migrated to the configured canonical owner identity transactionally.

No other platform user becomes Monarch merely because of a name, username, role text, command, phrase, model output or platform-specific ID.

When an action targets a concrete external or managed resource, later authority resolution extends identity with:

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
- Owner authority = whether the canonical `global_user_id` equals the verified owner identity and passes Owner Security.

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
- Production human identities use canonical SG-issued `usr_...` IDs.
- Platform IDs are links and cannot become independent user roots.
- One human may have multiple platform identity links pointing to the same `global_user_id`.
- Transports report platform facts; they do not assign roles or grants.
- Identity linking and unlinking are state-changing audited actions.
- Guest identities remain isolated and cannot inherit another user's memory.
- Project, group and thread scopes are explicit; absence of scope never means unrestricted scope.
- The Action Gate consumes IdentityContext and ScopeContext but does not create them.
- Cross-user, cross-project or cross-group access requires explicit policy and permission.
- Membership, administrator metadata or connection presence may be evidence for Resource Authority verification, but none is automatically equivalent to ownership.
- Resource authority must be explicit, provenance-backed and revocable.
- Identity, linking, ownership or authority must never depend on secret words, commands, phrases or keyword hacks.
- `MONARCH_USER_ID` is never the final owner-authority check; `MONARCH_GLOBAL_USER_ID` is the canonical owner identity root.

## CanonicalRequest identity fields
- trace_id
- channel
- identity_context
- scope_context
- input
- locale
- timestamp
