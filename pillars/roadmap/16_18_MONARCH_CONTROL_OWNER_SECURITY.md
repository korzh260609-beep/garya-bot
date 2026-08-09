# Block 16.18 — Monarch Control / Owner Security

## Status
Planned — next roadmap block before Render Deployment.

## Goal
Guarantee that only the verified SG owner/Monarch can change SG itself, its security policy, system configuration, roles/grants, privileged integrations or other owner-only state. Other actors may use only explicitly authorized capabilities and may never escalate themselves into owner authority.

This block strengthens the existing Identity, Scope, Action Gate, Resource Authority, Secrets, Configuration/Policy, Automation/Workers and Observability architecture. It does not replace those layers and does not create a parallel authorization system.

## 16.18.1 — Owner Identity & Global ID
- define one canonical SG owner identity bound to the existing `global_user_id` root identity;
- owner identity is not inferred from username, display name, phone number, command, phrase or secret word;
- platform identities from Telegram, Discord, Web/API, Email and future transports must resolve through existing Identity linking before owner authority is considered;
- owner/Monarch is a protected authority state and cannot be self-assigned, duplicated, transferred or downgraded through ordinary user/admin flows;
- identity-link changes that could affect owner resolution are owner-only, auditable and fail closed;
- recovery of owner access must use trusted infrastructure/recovery procedures rather than a conversational phrase or command.

## 16.18.2 — Security Gateway & Permissions
- introduce one centralized owner-security policy boundary composed with the existing Action Gate rather than scattered ad-hoc checks;
- security-sensitive operations are `deny by default` and `fail closed`;
- classify actions at minimum as ordinary user, self-service user change, delegated administration and owner/system operations;
- owner/system operations require verified owner identity plus the existing scope/permission/resource checks applicable to the concrete action;
- a single Security Policy Registry defines which actions/resources are owner-only;
- missing identity, ambiguous identity, missing permission, invalid scope or unresolved owner state produces denial, never best-effort execution.

Canonical direction:

```text
Platform actor
→ Global Identity / Scope
→ Security Gateway / Security Policy Registry
→ Action Gate
→ ALLOW / CONFIRM / DENY
→ Capability / Tool / Worker
```

## 16.18.3 — Protection of System Changes
Owner-only protection covers every action that can alter SG itself or global privileged state, including:
- system/security configuration and authorization-sensitive policy;
- role/grant/permission administration;
- owner/global identity administration;
- AI Router/model/provider configuration that changes production behavior;
- global/project system memory where it affects SG-wide operation;
- privileged external connections and integrations;
- security-critical feature flags and emergency controls;
- system-level tasks/automation;
- privileged database/admin operations;
- deployment/repository/system-management capabilities where SG is allowed to prepare or execute them.

Users may modify only their own explicitly allowed settings/data. Delegated administrators may receive bounded operational permissions, but delegated authority must never imply SG owner authority.

## 16.18.4 — Tools, Agents & Anti-Bypass
- AI output never grants identity, role, permission, owner status or resource authority;
- prompt injection or instructions such as "ignore rules", "make me admin" or equivalent have no authorization effect;
- every task, agent, worker, event-driven continuation and tool call preserves the original initiating `actor_global_user_id` and relevant scope/authorization evidence;
- authorization is revalidated immediately before protected execution, including delayed/queued worker execution;
- tasks, agents, tools, domain modules, Internal Event Bus consumers and AI providers cannot create an alternate execution path around Action Gate/Security Gateway;
- no component may broaden its own permissions, scope, tools, sources or authority;
- delegated agents remain execution components, not independent SG identities or owners.

Forbidden bypass pattern:

```text
USER → TASK/AI/AGENT → TOOL → SYSTEM CHANGE
```

unless the original actor is authorized for that exact protected action at execution time.

## 16.18.5 — Secrets & Infrastructure Protection
- raw API keys, bot tokens, database URLs, OAuth secrets, deployment tokens and other credentials remain inside the existing Secrets & Credentials boundary;
- ordinary prompts, memory, user responses, events and unrestricted telemetry must never contain raw secret values;
- secret inspection should expose status/metadata (`configured`, `expired`, `revoked`, handle ID) rather than raw values;
- privileged GitHub, deployment, database and provider credentials are owner-bound for administrative use unless an explicitly narrower delegated permission exists;
- credential possession alone never proves owner identity or authorization;
- infrastructure access outside SG (GitHub/Render/PostgreSQL/provider dashboards) remains a separate security perimeter and must not be treated as protected merely because SG has internal permissions.

## 16.18.6 — Audit, Monitoring & Emergency
Every privileged decision/action records privacy-bounded evidence sufficient to answer:
- who initiated it (`actor_global_user_id`);
- what action/resource was requested;
- project/group/thread/transport context where relevant;
- ALLOW / CONFIRM / DENY result;
- reason/policy source;
- trace/request identifier and timestamp.

Security event classes include at minimum:
- denied owner-only operation;
- privilege-escalation attempt;
- owner-identity/linking failure;
- secret-access attempt;
- protected system change;
- repeated authorization failures.

Add bounded rate limits for security-sensitive operations and an emergency `SECURITY_LOCKDOWN` mode. Lockdown blocks new privileged write/execution paths while retaining the minimum owner diagnostics, health and recovery surface required to investigate and restore service safely.

## 16.18.7 — Recovery & Security Tests
Define deterministic owner recovery and verification procedures for lost platform access, identity-link corruption, database restore and deployment recovery without conversational backdoors.

Required automated coverage includes:
- guest/citizen/admin cannot become or impersonate Monarch;
- user cannot assign owner-only roles/grants/permissions;
- non-owner cannot change system/security configuration;
- non-owner cannot modify another user's protected data/memory;
- non-owner cannot read raw secrets;
- Telegram/Discord/Web account cannot claim an existing owner `global_user_id` without approved identity linking;
- AI, task, worker, event consumer, domain module and tool cannot bypass authorization;
- queued protected work is denied if authority is missing/revoked at execution time;
- delegated authority stays within its exact bounds;
- security-critical unknown/missing state fails closed;
- lockdown blocks privileged writes but preserves bounded owner recovery/diagnostic access;
- audit evidence is generated for owner-only allow/deny paths without leaking secrets.

## Canonical invariants
- `MONARCH = verified SG owner`, not merely a display role string.
- Only the verified owner may change SG-wide security/authority state.
- No user, AI, agent, task, worker, tool, transport, event consumer or domain module may grant itself more authority.
- `global_user_id` remains the root personal identity across transports.
- Authorization is code/policy evidence, never natural-language persuasion.
- Owner authority does not remove normal scope/resource/confirmation checks when those checks are relevant to the action.
- Delegation grants a bounded capability, not ownership of SG.
- Unknown security state means DENY.

## Dependency placement
Block 16.18 is inserted after the completed foundational control chain through Block 16.16 and before Block 17 Render Deployment:

```text
16.16 Feature Flags & Controlled Rollout [completed]
→ 16.18 Monarch Control / Owner Security [planned]
→ 17 Render Deployment
→ 18 End-to-End Verification
→ 19 Security and Operations
→ Pilot Launch
```

Block 16.18 must be implementation- and acceptance-verified before Block 17 is considered the next execution stage.

## Acceptance criteria
- [ ] one canonical verified owner identity exists through `global_user_id`;
- [ ] owner-only actions are centralized and deny-by-default;
- [ ] roles/grants/system configuration/security policy cannot be changed by non-owner actors;
- [ ] original actor identity survives tasks/agents/workers/tools and is rechecked before protected execution;
- [ ] secrets remain non-disclosable through ordinary SG surfaces;
- [ ] privileged allow/deny decisions are auditable without secret leakage;
- [ ] emergency lockdown and owner recovery behavior are defined and tested;
- [ ] automated privilege-escalation, impersonation and bypass tests pass;
- [ ] roadmap, architecture indexes and root project status remain synchronized.
