# SG 2.1 — MONARCH / OWNER SECURITY

## Status

**IMPLEMENTED / WIRED / CI-VERIFIED — formal acceptance/closure pending.**

This document describes the active Owner Security architecture, not a future-only design. Current implementation is composed into production SG runtime; closure remains governed by the roadmap acceptance checklist.

## Purpose
Define the architecture boundary that guarantees SG-wide privileged state can be changed only by the verified SG owner/Monarch while preserving the existing Identity, Scope, Action Gate, Resource Authority, Secrets, Automation/Workers and Observability architecture.

## Canonical owner rule

```text
Verified owner = resolved global_user_id == MONARCH_GLOBAL_USER_ID
                 + protected owner authority
```

`MONARCH_GLOBAL_USER_ID` is the canonical SG owner identity and must be an SG-issued `usr_...` identity. The deployment alias `SG_MONARCH_GLOBAL_USER_ID` may override it operationally but represents the same canonical value.

`MONARCH_USER_ID` / `SG_MONARCH_TELEGRAM_USER_ID` is only the trusted Telegram bootstrap/link used to associate the owner's Telegram account with the canonical owner identity. A Telegram ID is never, by itself, proof of owner authority.

Owner status is never inferred from username, display name, transport account name, phone number, command, phrase, secret word or AI interpretation.

## Current implementation boundary

Active implementation:
- `src/security/ownerSecurity.js` owns owner policy/configuration, verified-owner comparison, lockdown/rate limiting and bounded audit;
- `src/security/ownerSecurityActionGate.js` composes Owner Security into the existing Action Gate path;
- `src/action/actionGate.js` validates the owner-security decision together with identity, permission, scope, Resource Authority, capability/source/tool, risk, cost, confirmation, idempotency and audit checks;
- production runtime creates and exposes Owner Security status without permitting Self Knowledge, Project Memory, AI or transport metadata to grant authority.

## Canonical flow

```text
Platform actor
→ verified Identity Link
→ canonical global_user_id (`usr_...`)
→ Scope / Grants
→ Resource Authority evidence where required
→ Owner Security Policy for owner-sensitive operations
→ existing Action Gate
→ Capability / Tool / Worker
→ Audit / Security Event
```

Owner Security tightens the existing authorization chain. It is not a second permission system and never bypasses Resource Authority or Action Gate.

If the trusted configured owner Telegram identity has no link, the bootstrap procedure may associate it with the canonical owner identity only through the trusted identity-link/bootstrap boundary. If a legacy or incorrect prior global identity exists for that trusted account, migration to the canonical owner identity must be transactional and preserve user-owned state.

## Owner-only surfaces
The owner-only boundary covers any operation that can alter SG itself or its global privileged state, including:
- security policy and authorization-sensitive configuration;
- role/grant/permission administration;
- owner/global identity administration;
- privileged AI Router/model/provider configuration;
- global/project system state where it controls SG behavior;
- privileged external connections and integrations;
- security-critical feature flags and emergency controls;
- privileged task/automation, repository, deployment or database administration.

## Non-owner behavior
Ordinary users may use authorized capabilities and modify only their own explicitly permitted state. Delegated administrators may receive narrowly scoped operational permissions, but delegation never implies SG ownership and cannot be used to grant or expand owner authority.

A stale database role named `monarch` does not override the canonical owner identity. If the resolved `global_user_id` is not `MONARCH_GLOBAL_USER_ID`, owner authority must fail closed.

## Anti-bypass invariant
The original actor identity and scope must survive all deferred/external execution paths:

```text
actor_global_user_id
→ task / agent / worker / event / AI / tool
→ protected execution
```

Authorization is revalidated immediately before protected execution. AI output, prompt injection, agent behavior, task persistence, worker execution, Internal Event Bus consumers, domain modules and tools cannot create an alternate authorization path or broaden permissions.

## Fail-closed behavior
For owner-sensitive operations, any missing/ambiguous identity, unresolved owner state, missing/invalid `MONARCH_GLOBAL_USER_ID`, invalid scope, missing permission or inconsistent authorization evidence produces DENY.

If a Telegram owner bootstrap ID is configured without the canonical `MONARCH_GLOBAL_USER_ID`, production owner resolution must fail closed instead of reverting to Telegram-ID-based authority.

## Secrets and infrastructure
Raw secrets remain inside the Secrets & Credentials boundary and never enter ordinary memory, prompts, responses, events or unrestricted telemetry. Infrastructure access to GitHub, Render, PostgreSQL or provider dashboards remains an independent security perimeter and is not considered protected merely because SG has internal authorization rules.

## Audit and emergency control
Privileged allow/deny decisions must produce privacy-bounded audit evidence containing actor, action, target/resource, scope, result, reason, timestamp and trace/request identity without leaking secrets.

`SECURITY_LOCKDOWN` / `SG_SECURITY_LOCKDOWN` may block protected owner-sensitive operations while retaining bounded diagnostics/health/recovery paths allowed by policy.

## Recovery
Owner recovery must use trusted infrastructure/recovery procedures and verified identity-link restoration. Conversational backdoors, secret phrases and keyword-based owner recovery are forbidden.

## Relationship to existing architecture
- Identity determines who acts and resolves platform links to canonical `global_user_id`.
- Scope determines where the action is bounded.
- Grants/Access determine what kind of action is permitted.
- Resource Authority determines over which concrete resource the actor may act where required.
- Owner Security determines whether the resolved canonical identity may perform an owner-sensitive operation.
- Action Gate remains the concrete execution authorization boundary.

Owner Security therefore tightens the existing authorization chain; it does not replace or bypass any existing layer.

## Evidence and closure

Implementation/CI evidence must remain distinct from formal acceptance. Current code can be reported as implemented/wired/CI-verified, while the block remains NOT CLOSED until the acceptance checklist in the roadmap is explicitly satisfied.

## Roadmap linkage
Implementation and acceptance scope is defined by `../roadmap/16_18_MONARCH_CONTROL_OWNER_SECURITY.md`.
