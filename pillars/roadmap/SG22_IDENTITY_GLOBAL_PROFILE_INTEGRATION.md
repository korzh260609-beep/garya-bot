# SG 2.2 — Block 3: Identity & Global Profile Integration

## Status
HISTORICAL IMPLEMENTATION EVIDENCE — ROLE MODEL SUPERSEDED

> The guest-first profile behavior and general role-transition model documented below
> are no longer current requirements. Preserve this file as evidence of the original
> implementation, but use `pillars/roadmap/SG22_ROLE_MODEL_MIGRATION_PLAN.md` for all
> new work and closure decisions.

## Purpose
Integrate SG Global ID, SG profile, and SG domain roles into the existing OpenClaw identity, session, routing, and access-control architecture without creating a parallel identity or permission system.

## Architectural rule
OpenClaw remains the authoritative foundation for:
- channel sender identity;
- account identity;
- session identity and session scoping;
- `session.identityLinks` and cross-channel canonical identity linking;
- conversation identity/routing;
- allowlists, pairing, access groups, and existing security/access enforcement.

SG 2.2 must extend these mechanisms, not duplicate them.

Target flow:

```text
Telegram / Discord / Web / future channels
        ↓
OpenClaw sender/account identity
        ↓
OpenClaw session.identityLinks
        ↓
canonical identity
        ↓
SG Global Profile binding
        ↓
SG Global ID + SG role + SG profile
        ↓
existing OpenClaw permissions/security/access groups
        ↓
SG runtime
```

## Explicit non-goals
Do NOT create:
- a second transport identity system;
- a second session identity system;
- a second cross-channel identity linker;
- a second permission engine;
- a second allowlist/access-group system;
- Telegram-only identity logic;
- role checks that bypass OpenClaw security/access enforcement.

## ID3.1 — OpenClaw Identity Mapping

### Goal
Fix the exact integration point between OpenClaw canonical identity and SG user/profile identity.

### Work
- verify and document the current OpenClaw sender/account identity flow;
- use existing `session.identityLinks` for cross-channel identity linking;
- use existing session/routing identity normalization;
- identify the canonical identity value that SG profile lookup will consume;
- define one integration contract from OpenClaw identity → SG profile lookup;
- do not alter OpenClaw identity semantics unless a concrete incompatibility is proven.

### Exit criteria
- one authoritative OpenClaw identity input for SG is documented and tested;
- no parallel SG sender/canonicalization subsystem exists.

## ID3.2 — SG Global ID

### Goal
Add a persistent SG-owned user identifier that survives channel changes and is independent of Telegram/Discord/Web IDs.

### Work
- add persistent `globalId` for SG users;
- generate it once when no SG profile exists for the resolved canonical identity;
- return the same `globalId` on all later requests;
- enforce uniqueness and prevent duplicate profile creation under concurrent requests;
- keep external channel IDs outside the SG Global ID namespace.

### Required invariant
One SG person/profile → one stable Global ID.

### Exit criteria
- repeat requests return the same Global ID;
- different canonical users receive different Global IDs;
- duplicate Global IDs cannot be created by normal runtime execution.

## ID3.3 — SG Global Profile

### Goal
Create the minimal persistent SG profile attached to OpenClaw canonical identity.

### Minimum profile model

```text
globalId
canonicalIdentity
role
status
createdAt
updatedAt
```

Optional channel/account metadata may be referenced only when useful, but the authoritative user identity remains the canonical identity → Global ID mapping.

### Work
- implement profile create/read/update lookup;
- keep profile storage independent from any single transport;
- preserve the ability to add future SG profile fields without changing OpenClaw session identity;
- define explicit profile lifecycle/status handling.

### Exit criteria
- SG profile is persistent;
- profile lookup does not depend on Telegram-only fields;
- profile is uniquely bound to the intended canonical identity.

## ID3.4 — SG Domain Roles

### Goal
Add SG-specific semantic roles without replacing OpenClaw authorization.

### Initial roles
- `monarch`
- `citizen`
- `guest`

### Work
- store role in SG profile;
- define deterministic default role assignment;
- define controlled role transitions;
- expose role to runtime context;
- keep role vocabulary extensible for future SG roles.

### Critical rule
SG role is domain metadata. It is NOT a standalone authorization engine.

### Exit criteria
- role resolves deterministically for every SG profile;
- no direct permission bypass exists based only on role value.

## ID3.5 — OpenClaw Security Binding

### Goal
Map SG domain identity/role into existing OpenClaw access/security mechanisms.

### Work
- use existing OpenClaw allowlists/access groups/pairing/security policies;
- define how `monarch`, `citizen`, and `guest` influence or select existing OpenClaw access groups/policies;
- keep final permission enforcement in OpenClaw security/access layers;
- ensure privileged SG role cannot bypass approval/security gates;
- document the mapping between SG role and OpenClaw access semantics.

### Exit criteria
- no second permission engine exists;
- all protected operations continue through existing OpenClaw enforcement;
- SG role mapping is deterministic and test-covered.

## ID3.6 — Cross-Channel Identity

### Goal
Ensure one person linked by OpenClaw identity linking resolves to one SG Global ID across channels.

### Work
- rely on `session.identityLinks` as the cross-channel linking source;
- verify Telegram + Discord + Web/future adapter behavior using canonical identity;
- confirm linked channel identities resolve to one SG profile;
- confirm unlinked identities remain separate;
- define safe behavior when identity links are missing or ambiguous.

### Exit criteria
- linked identities → same Global ID;
- unlinked distinct identities → different Global IDs;
- no SG-specific parallel cross-channel map is introduced.

## ID3.7 — Runtime Context Integration

### Goal
Make SG identity available to later SG features without forcing them to know transport-specific IDs.

### Runtime context fields

```text
sg.globalId
sg.role
sg.profile
```

### Work
- resolve SG profile after OpenClaw canonical identity resolution;
- attach SG identity context once per request/runtime path;
- make later SG capabilities consume `sg.globalId` instead of Telegram/Discord IDs where persistent person identity is required;
- preserve existing OpenClaw request/session context intact.

### Exit criteria
- SG runtime receives stable identity context;
- downstream SG code does not need to implement its own transport identity resolution.

## ID3.8 — Tests & Regression

### Required tests
- same user, repeated request → same Global ID;
- different users → different Global IDs;
- linked Telegram + Discord identity → same Global ID;
- unlinked Telegram + Discord identity → different Global IDs;
- role resolution for monarch/citizen/guest;
- concurrent first-contact requests do not create duplicate profiles;
- profile persists across process restart/storage reload;
- OpenClaw session keys continue to behave as before;
- existing allowlist/access-group/security behavior remains intact;
- no regression in group/direct/session scoping;
- no Telegram-only dependency in SG profile resolution.

### Exit criteria
- targeted tests pass;
- relevant existing OpenClaw regression tests pass;
- no duplicate identity/security implementation is introduced.

## ID3.9 — Documentation & Closure

### Work
- document the final identity flow and authoritative ownership boundaries;
- document storage schema and migration, if persistence schema changes are required;
- document SG role → OpenClaw access mapping;
- document cross-channel linking behavior;
- document failure/ambiguity behavior;
- record implementation commits and test evidence.

### Block closure criteria
Block 3 is CLOSED only when:
- ID3.1–ID3.9 are complete;
- persistent Global ID works;
- SG profile and roles work;
- linked identities share one Global ID;
- existing OpenClaw identity/session/security remain authoritative;
- targeted and regression tests pass;
- documentation matches runtime behavior.

## Implementation constraint for all future work
Before adding any identity, profile, role, permission, session, or access component, first verify whether OpenClaw already provides the mechanism. If it exists, extend/reuse it. New SG-owned components are allowed only for SG-specific semantics that OpenClaw does not already provide.

## Implemented architecture

- OpenClaw remains authoritative for sender identity, `session.identityLinks`, canonical direct-peer linking, routing, session scoping, allowlists, pairing and access enforcement.
- `src/sg/global-profile.ts` owns only SG domain data: persistent Global ID, profile lifecycle, role metadata and the deterministic `sg-<role>` policy selector.
- The canonical SG lookup key is `linked:<OpenClaw canonical identity>` when `session.identityLinks` resolves the sender, otherwise `channel:<channel>:<sender>`.
- Profiles persist at `<OPENCLAW_STATE_DIR>/sg/global-profiles.json` with atomic replacement, restrictive file mode and a fail-closed inter-process lock.
- First contact creates `guest`; controlled profile mutation can transition `guest`, `citizen`, and `monarch` or change lifecycle status. Role metadata never authorizes an operation by itself.
- Dispatch resolves the profile once and attaches `Sg` to the existing inbound context. The model runtime receives `sg.globalId` and `sg.role`; transport-specific identifiers remain outside downstream SG identity.
- Missing sender identity leaves SG context absent. Invalid storage and unauthorized profile mutations fail closed instead of creating a second or guessed identity.

## Test evidence

`src/sg/global-profile.test.ts` covers repeated lookup, different users, linked Telegram/Discord identities, unlinked identities, concurrent first contact, persistence reload, deterministic guest role, role/status transitions, and denied transitions. Existing OpenClaw session-key behavior is unchanged because the integration consumes `resolveLinkedDirectPeerId` without modifying routing or security enforcement.


## Checklist synchronization

- Canonical migration checklist: `pillars/roadmap/SG_2_2_OPENCLAW_MIGRATION.md`.
- Checklist Point 3 status: CLOSED.
- The next test-enablement block is Point 3A — Telegram Test Runtime.
- Point 3A must expose this completed identity context through the existing OpenClaw Telegram channel without changing the identity architecture or reopening Point 3.
- Point 4 then enables standard OpenClaw GitHub/repository access before Memory, Project Memory and PDK4, without hard-coded repository or branch restrictions.
