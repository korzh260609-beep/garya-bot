# Block 16.18 — Monarch Control / Owner Security

## Status

**IMPLEMENTED / WIRED / CI-VERIFIED — formal acceptance/closure pending.**

The earlier `planned` status is superseded by the current production implementation. Do not infer CLOSED from implementation alone: the acceptance checklist below still requires explicit evidence/sign-off where not already captured.

## Goal

Make Monarch authority a deterministic system-level security property.

The block must guarantee that privileged SG operations derive only from canonical identity and explicit runtime security policy, never from wording, usernames, display names, transport-local convenience, or AI inference.

## Core rule

> AI may assist. Only authenticated SG policy may authorize.

## Current implementation evidence

Implemented in the active `dev/sg2.1-semantic` branch:
- `src/security/ownerSecurity.js` — canonical Monarch Global ID configuration, owner-only capability policy, verified-owner comparison, fail-closed missing/mismatched owner behavior, lockdown, failed-attempt rate limiting and bounded audit output;
- `src/security/ownerSecurityActionGate.js` — composes Owner Security with the existing Action Gate rather than creating a bypass;
- `src/action/actionGate.js` — consumes the owner-security decision and denies when owner-sensitive authorization does not match the canonical actor/project scope;
- production runtime composition creates the Owner Security gateway and uses the wrapped Action Gate;
- existing Identity, Scope, Resource Authority, Action Gate, Credential Manager and secret boundaries remain authoritative and are not weakened.

Current evidence level: **implemented / wired / CI-verified**. Formal block closure remains separate from these code facts.

## Required architecture

### Canonical owner identity
- one stable `MONARCH_GLOBAL_USER_ID` / Global ID
- owner authority resolves from canonical `globalUserId`
- Telegram username, `@alias`, first/last name and display-name fields remain descriptive metadata only
- admin/owner status cannot be inferred from Telegram/chat text or AI output

### Protected operations
At minimum, protect system-changing classes such as:
- configuration/security policy changes
- application-level access/role management
- identity administration
- production AI provider/model controls
- external connection management
- feature-flag controls
- system/global automation administration
- repository/deployment/database administration
- secret administration

Personal signed-in-user actions such as the user’s own reminders/settings remain governed by ordinary authenticated user scope and the existing Action Gate unless explicitly elevated by policy.

### Action Gate composition
- owner-sensitive requests must pass the existing Action Gate
- owner verification must compose with existing permission/scope/risk/cost/confirmation checks
- no second competing permission system
- no bypass around Resource Authority
- owner mismatch must fail closed

### Fail-closed modes
- missing canonical owner binding denies owner-sensitive operations
- ambiguous/mismatched identity denies
- emergency lockdown mode denies owner-sensitive mutations
- repeated failed privileged attempts may be rate-limited without granting new authority
- policy/config errors must not silently fall back to descriptive profile metadata

### Audit
Privileged paths must record bounded secret-safe evidence including:
- canonical actor Global ID
- policy id/version
- operation/capability
- allow/deny decision
- reason
- resource/project scope
- trace/request correlation

No raw secrets/tokens may enter audit or AI context.

## Architectural constraints
- Identity → Owner Security → Resource Authority / Action Gate → Capability execution
- AI provider is reasoning/execution only
- transports remain thin
- owner state is runtime security policy, not project-memory truth
- Memory cannot grant owner rights
- Project Memory cannot grant owner rights
- Self Knowledge may report owner-security status but cannot decide authority

## Acceptance
- [ ] owner-sensitive capability allowed for canonical Monarch
- [ ] same capability denied for ordinary authenticated user
- [ ] username/display-name impersonation cannot grant authority
- [ ] missing owner binding fails closed
- [ ] lockdown mode blocks protected operations
- [ ] Action Gate remains mandatory
- [ ] Resource Authority remains mandatory where applicable
- [ ] audit records prove privileged decisions without secrets
- [ ] regression coverage proves existing normal user behavior is unchanged
- [ ] README/runtime diagnostics reflect real deployed status only

Unchecked boxes mean the roadmap has not yet recorded explicit acceptance sign-off; they do not mean the corresponding code path is absent.

## Out of scope
- bypassing canonical Identity
- replacing the existing Action Gate
- storing secrets in code/README/Memory
- granting owner via Project Memory
- granting owner via AI decision
