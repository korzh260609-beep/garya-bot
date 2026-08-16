# SG 2.1 — SG ACCESS CONTROL SYSTEM 1.0 PROGRAM

## Status
**PLANNED / NOT IMPLEMENTED.**

ACS1 is the canonical transport-neutral access, entitlement, delegation and usage-control program for SG 2.1. It is not a Telegram Workspace Manager extension and is not owned by any transport.

ACS1 governs access to SG across Telegram, Discord, Web, API, Email, the future native SG interface and any later transport.

## Canonical authority principle

**Default Access Authority = SG. Human approval is escalation, not the default control path.**

The Monarch remains the supreme policy authority. SG may grant, limit, deny, expire, revoke or escalate access only inside deterministic policy boundaries established by the Monarch and the canonical security architecture.

AI/model output may interpret a natural-language access request into a structured capability proposal, but AI/model output MUST NOT decide GRANT/DENY/ESCALATE and MUST NOT mutate grants directly.

## Non-negotiable separation

Identity answers **who the actor is**.
ACS answers **what the actor may do**.
Usage/Budget answers **how much resource the actor may consume**.
Resource Authority answers **whether the actor currently has authority over the target resource**.
Action Gate answers **whether a protected action may execute now**.
Credential Manager answers **which approved credential may execute it**.
Transport only supplies authenticated transport facts and delivery mechanics.

Therefore:
- creating/linking a Global User ID does not grant SG usage;
- `/start`, Web login, Discord login or API authentication do not themselves grant `ai.compose`;
- Telegram/Discord/workspace membership does not grant global SG access;
- workspace administrator status is authority evidence, not automatic SG entitlement;
- receiving one's own test/poll/form/case result does not grant conversational AI access;
- feature flags may restrict availability but cannot grant authority;
- denied AI usage must fail before AI Router so denied requests consume zero AI calls/tokens.

## Canonical decision pipeline

```text
Identity
→ Entitlement
→ Access Status
→ Scope
→ Capability
→ Resource Authority
→ Usage/Budget
→ Risk/Confirmation
→ Action Gate
→ Credential Authority where required
→ Execute/Deliver
→ Audit/Observability
```

## Core entities

### AccessStatus
Canonical initial statuses:
- `blocked`
- `delivery-only`
- `restricted`
- `user`
- `privileged`
- `monarch`

A newly identified ordinary user defaults to `delivery-only` unless a deterministic policy grants more.

### Entitlement
High-level service entitlement independent of individual operations, e.g.:
- `service.private-results`
- `service.workspace-participation`
- `service.sg-ai`

### CapabilityGrant
A grant binds:
- subject Global User ID;
- capability;
- scope;
- constraints;
- grant authority/provenance;
- validity window;
- optional usage/budget policy;
- audit identity.

### Scope
ACS must support at least:
- global;
- project;
- workspace;
- resource;
- own-resource.

Own-resource access must be explicit and must never imply access to another user's result/submission/profile/case.

### RoleTemplate
Roles are bounded templates for grants; roles are not blanket authorization. A transport/workspace role may propose a template but cannot silently create global SG authority.

## Initial capability families

The exact registry is versioned during ACS1.3, but the system must cover at least:

### Private delivery and self-service
- `delivery.private.read-own`
- `result.read-own`
- `access.request`

### AI and memory
- `ai.compose`
- `memory.personal.read`
- `memory.personal.write`

### Workspace
- `workspace.view`
- `workspace.config.read`
- `workspace.config.write`

### Content
- `content.create`
- `content.publish`
- `content.schedule`

### Polls/tests/forms
- `poll.create`
- `poll.close`
- `poll.results.view`
- `test.create`
- `test.participate`
- `test.results.read-own`
- `test.results.aggregate`

### Community/operations
- `analytics.view`
- `moderation.review`
- `moderation.execute`
- `case.create`
- `case.transition`
- `decision.propose`
- `decision.confirm`
- `automation.create`
- `automation.manage`
- `export.create`

### Access administration
- `access.review`
- `access.manage`

## Default new-user baseline

For an ordinary newly identified user, the intended ACS baseline is:

```text
identity = known
accessStatus = delivery-only
allowed:
  - delivery.private.read-own
  - result.read-own
  - access.request
not automatically allowed:
  - ai.compose
  - workspace management
  - privileged actions
```

Current production behavior that automatically grants `compose-answer` to a new Telegram guest is explicitly a migration target, not the desired ACS end state.

## Private-result delivery rule

A user may participate in a workspace interaction without having general SG AI access.

Required flow:
1. store the user's result/submission under canonical Global ID/resource ownership;
2. attempt delivery only through an authorized private channel;
3. if a transport cannot initiate a private conversation, keep a durable `pending_delivery` state;
4. provide a neutral instruction to open/authorize a private SG channel without leaking the private result publicly;
5. after the user opens SG, release only authorized own-result/pending-delivery data;
6. do not upgrade `accessStatus` and do not grant `ai.compose` merely because the private channel now exists.

## Access Request workflow

Any requestable denial may offer a transport-neutral Access Request.

A user may request access in natural language or through UI/API, for example:
- SG AI use;
- analytics;
- publishing;
- moderation;
- a workspace-scoped capability;
- a temporary or budget-limited grant.

Canonical AccessRequest contains at least:
- requester Global User ID;
- requested capability set;
- requested scope;
- optional reason;
- requested duration;
- optional requested budget;
- status;
- provenance/transport facts;
- created/updated timestamps.

Creating an AccessRequest MUST NOT itself grant anything.

Duplicate pending requests are deduplicated/bounded; blocked users and abuse patterns are rate-limited according to policy.

## SG decision modes

Deterministic ACS Policy Engine returns one of:
- `GRANT`
- `GRANT_LIMITED`
- `DENY`
- `ESCALATE`

`GRANT_LIMITED` may constrain duration, request count, credits, monetary budget, model tier, resource or workspace.

`ESCALATE` routes to the next authorized human/system authority. The user cannot grant a capability to themselves.

## Authority hierarchy and delegation

Canonical authority hierarchy begins with:

```text
Monarch
→ SG Access Authority
→ Project/Workspace Owner where applicable
→ Delegated Access Manager
→ User
```

This is not a blanket role inheritance chain. Each authority receives a bounded delegation envelope defining exactly what it may grant, in what scope, to whom, for how long and with what budget.

Delegated authority can never exceed its envelope. The SG itself cannot expand its own envelope beyond Monarch policy.

## Usage and budget

`ai.compose` alone does not imply unlimited spend.

Before every paid/model-backed call, ACS Usage Gate must verify applicable constraints such as:
- daily/monthly request count;
- daily/monthly credits;
- monetary ceiling;
- model tier;
- concurrency/rate constraints;
- billing scope.

Supported billing scopes must include the concepts:
- personal;
- workspace;
- project;
- Monarch;
- sponsored.

A denied or exhausted-budget request must not call AI Router.

## Temporary and conditional grants

Grants may include:
- `validFrom`;
- `expiresAt`;
- `maxUses`;
- workspace/resource conditions;
- current membership/admin requirements;
- event/time-window conditions.

Expiration/revocation is automatic and audited.

## Policy precedence

Minimum precedence:

```text
explicit DENY
> explicit scoped GRANT
> role/policy template
> default
```

Protected/privileged capabilities are deny-by-default.

## Cross-transport rule

All transports call the same ACS policy surface. A transport may contribute verified facts, e.g. Telegram admin status, Discord guild role, Web session authentication level, but no transport owns the authorization decision.

Cross-transport identity linking must preserve one Global User ID and one canonical access state while allowing transport-specific evidence and delivery constraints.

## Management surface

ACS must expose transport-neutral management operations for:
- get/list effective access;
- list/request capabilities;
- approve/modify/deny/escalate requests;
- grant/revoke;
- set budgets/constraints;
- inspect expiration;
- inspect audit.

Native SG UI, Telegram Mini App, Discord UI and API are adapters over this same service, not independent access databases.

## Audit and observability

Every access decision must be explainable from bounded evidence and policy. Audit records must cover at least:
- actor;
- target subject;
- capability;
- scope/resource;
- decision;
- policy rule/reason class;
- authority;
- prior/effective state;
- constraints/budget effect;
- timestamp/trace.

Observability must expose bounded counters such as denied AI calls, AI calls prevented before Router, pending requests, active/expired grants and budget denials without leaking secrets/private content.

## Emergency controls

Monarch-level emergency policy must be able to:
- block/freeze a user;
- revoke all non-Monarch access for a target subject;
- freeze a workspace/project access surface;
- disable paid AI usage;
- preserve audit evidence.

## Implementation stages

### ACS1.1 — Access Domain Foundation
Define versioned contracts for AccessStatus, Entitlement, CapabilityGrant, Scope, Constraint and AccessDecision.

### ACS1.2 — Identity / Access Separation
Remove automatic identity→AI-access coupling. New identity creation/linking must not imply `ai.compose`/`compose-answer`.

### ACS1.3 — Capability Registry
Create canonical versioned registry with risk class, allowed scope types, budget impact, approval class and delegatability.

### ACS1.4 — Scope Authority Model
Implement global/project/workspace/resource/own-resource grants and cross-scope isolation.

### ACS1.5 — Deterministic Policy Engine
Implement `evaluate(actor, capability, scope, resource, context)` returning allow/deny/escalate with bounded reason evidence.

### ACS1.6 — SG Default Authority
Define SG's automatic-grant envelope and Monarch-controlled policy boundaries.

### ACS1.7 — Access Request Workflow
Implement request, validation, deduplication, policy evaluation, grant/deny/escalate, notification and audit.

### ACS1.8 — Approval & Escalation
Implement authority resolution, partial approval, modified grants and denial without self-grant paths.

### ACS1.9 — Temporary / Conditional Grants
Implement expiration, max-use and condition revalidation with automatic revocation.

### ACS1.10 — AI Usage Gate
Require `ai.compose` plus active budget/model policy before AI Router. Denied requests must prove zero Router calls.

### ACS1.11 — Budget & Credits
Implement request/credit/money/model limits and personal/workspace/project/Monarch/sponsored billing scopes.

### ACS1.12 — Private Delivery Access
Implement delivery-only users, durable pending private results and own-result release without AI entitlement escalation.

### ACS1.13 — Delegation
Implement bounded delegation envelopes and non-escalation invariants.

### ACS1.14 — Workspace/Resource Authority Integration
Treat transport roles/admin facts as revocable evidence; require both ACS permission and current resource authority for protected resource actions.

### ACS1.15 — Action Gate Integration
All protected mutations/external actions must pass ACS and existing Action Gate; no direct model/transport bypass.

### ACS1.16 — Transport-Neutral Enforcement
Wire Telegram, Discord, Web, API and future native SG interfaces to the same ACS surface.

### ACS1.17 — Access Management API
Expose bounded internal/API operations for access inspection, requests, grants, revocation, approval, denial and budget management.

### ACS1.18 — Management UI
Expose the same backend through native SG UI/Mini Apps/transport UI without duplicating policy state.

### ACS1.19 — Audit & Observability
Implement decision audit, metrics, traces, secret-safe diagnostics and access-history inspection.

### ACS1.20 — Security Regression Suite
Cover default-deny AI, no `/start` privilege escalation, membership/admin non-escalation, own-result isolation, expiration, delegation envelope, zero-AI-call deny path, cross-workspace and cross-transport isolation.

### ACS1.21 — Cross-Transport E2E
Prove one Global ID/access policy across multiple transports while transport-specific facts remain bounded inputs.

### ACS1.22 — Production Live Acceptance
Prove the complete production access lifecycle with real transport users and budget/audit evidence.

## Mandatory live acceptance scenario

A critical ACS1.22 scenario is:
1. a new user belongs to a Telegram group but has never opened SG privately;
2. user participates in a test/form/other supported flow;
3. private result is persisted and not leaked into the group;
4. private delivery cannot start until Telegram permits it, so delivery remains pending;
5. user opens SG and receives only their own result;
6. user asks an ordinary AI question;
7. `ai.compose` is absent and request is denied before AI Router;
8. denial offers `Request access`;
9. AccessRequest is created without granting access;
10. SG evaluates it under deterministic policy and grants limited access, denies, or escalates;
11. if escalated, authorized authority may approve/modify/deny;
12. only after an effective grant and budget check may AI Router run;
13. all transitions are auditable.

## Completion gate

ACS1 is CLOSED only when contracts, persistence, deterministic policy, integrations, regression/E2E tests, SG 2.1 CI, production deployment and live cross-transport/access acceptance prove the required behavior. Documentation alone cannot close ACS1.

## Dependencies

ACS1 reuses and strengthens existing SG foundations:
- canonical Global Identity/Scope;
- Capability System;
- Resource Ownership & Authority;
- Action Gate;
- Owner/Monarch Security;
- Configuration/Policy;
- PostgreSQL;
- Delivery Router;
- AI Router/cost logging;
- Observability/Internal Events;
- transport adapters.

ACS1 must not create a second identity root, second Action Gate, second Credential Manager or transport-owned authorization database.

Architecture: `../architecture/SG_ACCESS_CONTROL_SYSTEM_1_0.md`.
Workflow: `../workflow/SG_ACCESS_CONTROL_SYSTEM_1_0_WORKFLOW.md`.
