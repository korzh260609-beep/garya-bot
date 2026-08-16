# SG 2.1 — SG ACCESS CONTROL SYSTEM 1.0 ARCHITECTURE

## Status
**PLANNED / NOT IMPLEMENTED.**

## Purpose
ACS1 is the single transport-independent authorization, entitlement, delegation and usage-control layer for SG. Telegram, Discord, Web, API, Email and the future native SG interface are clients of ACS, not owners of access policy.

## Authority model

```text
Monarch policy authority
        ↓
SG Access Authority / deterministic Policy Engine
        ↓
Project / Workspace authority where applicable
        ↓
Delegated Access Managers within bounded envelopes
        ↓
Users
```

SG is the default access manager. Human approval is an escalation path when deterministic policy cannot or must not grant automatically.

The Monarch can define or tighten SG's policy envelope; SG cannot expand its own authority beyond that envelope.

## Architectural separation

```text
Identity: who is this actor?
ACS: what may this actor do and under what constraints?
Resource Authority: does this actor currently control/hold authority over this target resource?
Usage/Budget: may the requested resource consumption occur?
Action Gate: may this protected action execute now?
Credential Manager: which approved credential may perform the external action?
Transport: authenticated facts + delivery only.
```

None of these responsibilities may silently absorb another.

## Request flow

```text
Transport input
→ canonical Identity / Scope resolution
→ semantic interpretation when needed
→ canonical operation/capability proposal
→ ACS entitlement + status + scoped capability evaluation
→ current Resource Authority evidence when resource-bound
→ Usage/Budget evaluation when resource-consuming
→ risk/confirmation policy
→ existing Action Gate for protected actions
→ approved Credential Manager path where external credentials are needed
→ execution/delivery
→ audit + observability
```

Denied `ai.compose` requests terminate before AI Router.

## Data model

### AccessStatus
A bounded coarse service state: `blocked`, `delivery-only`, `restricted`, `user`, `privileged`, `monarch`.

AccessStatus is not sufficient authorization by itself; effective authorization still requires capability/scope evaluation.

### Entitlement
Entitlements describe service-family eligibility, e.g. private result delivery, workspace participation or SG AI service. Entitlements do not replace capability grants.

### CapabilityRegistryEntry
Versioned registry item containing:
- canonical capability name;
- description/domain;
- risk class;
- allowed scope classes;
- whether it may incur budget;
- approval/escalation class;
- delegatability;
- default policy behavior.

### CapabilityGrant
Durable grant containing:
- subject Global User ID;
- capability;
- scope;
- explicit constraints;
- provenance and granting authority;
- valid-from/expires-at/max-use conditions;
- optional usage/billing policy binding;
- lifecycle status and audit references.

### Scope
ACS scopes are transport-neutral semantic scopes:
- global;
- project;
- workspace;
- resource;
- own-resource.

Transport resource IDs are mapped into canonical scopes/resources by existing adapters/registries.

### AccessRequest
Durable request for one or more capabilities in a specific scope, with reason/duration/budget request, provenance, status and resolution history.

### DelegationEnvelope
Defines which capabilities an authority may grant/revoke, allowed target/scopes, maximum duration, maximum budget and whether further delegation is allowed.

### UsagePolicy
Defines request/credit/money/model/rate/concurrency limits and billing scope.

## Default subject bootstrap
A newly linked ordinary Global User ID must not receive conversational AI access merely because an identity exists or a transport session started.

Target baseline:

```text
status = delivery-only
allow = delivery.private.read-own, result.read-own, access.request
deny-by-absence = ai.compose and all privileged capabilities
```

The current Telegram production resolver behavior that auto-grants `compose-answer` to a new guest is an explicit ACS migration target.

## Private result architecture
Private test/poll/form/case outcomes are resources owned/accessible according to canonical resource ownership, not according to whether a private chat already exists.

If delivery cannot occur because a transport cannot initiate a private conversation:
- persist the result/submission normally;
- persist `pending_delivery` or equivalent durable delivery state;
- do not leak private content to the group/public scope;
- allow a neutral transport instruction to open SG;
- on later private authentication, release only own authorized pending results;
- do not promote the subject to `user` and do not grant `ai.compose`.

## Access Request architecture
Natural language/UI/API requests are normalized into `AccessRequest` records. AI Router may assist semantic extraction but the output is only a proposal.

Policy Engine produces only deterministic outcomes:
- GRANT;
- GRANT_LIMITED;
- DENY;
- ESCALATE.

Any mutation of grants is performed by ACS service code after policy/authority checks and is audited.

## Usage/budget gate
For paid/model-backed operations, ACS evaluates effective usage policy before AI Router/tool execution. Limits may be attached at user, project, workspace or sponsored billing scope.

A granted capability plus exhausted budget is still a denial for that invocation.

## Resource Authority composition
ACS permission and Resource Authority are complementary:

```text
ACS capability allowed
AND
current resource authority allowed
AND
Action Gate allowed
```

must hold for protected resource actions.

Telegram administrator status, Discord guild roles and similar transport facts are revocable authority evidence only. They cannot grant SG-global ownership or global AI entitlement.

## Policy precedence
At minimum:

```text
explicit deny > explicit scoped grant > role/policy template > default
```

Protected capabilities are default-deny.

Policy evaluation must be deterministic, explainable and bounded by structured inputs. No keyword-specific authorization logic and no LLM-authored final access decisions are permitted.

## Delegation
Delegated access managers may only grant/revoke capabilities within their active DelegationEnvelope. A delegated manager cannot grant themselves broader access or enlarge their own delegation envelope.

## Transport neutrality
All transports call one ACS service/contract. Transport-specific UI may display access state or initiate requests, but no transport maintains an independent authorization truth.

Cross-platform Global ID linking must preserve effective access state across transports while still re-checking transport-specific authentication and resource facts.

## Management API/service surface
Canonical internal surface should include operations equivalent to:
- `getEffectiveAccess(subject, context)`;
- `evaluate(actor, capability, scope, resource, context)`;
- `listGrants(subject, scope)`;
- `requestAccess(...)`;
- `reviewAccessRequest(...)`;
- `grant(...)`;
- `revoke(...)`;
- `setUsagePolicy(...)`;
- `listAudit(...)`.

External APIs/UIs are adapters over this surface.

## Audit requirements
Every GRANT, LIMITED_GRANT, DENY, ESCALATE, REVOKE, EXPIRE and budget denial must carry reason/evidence sufficient to explain the decision without storing secret/private payloads unnecessarily.

## Security invariants
- identity creation never implies AI entitlement;
- transport session creation never implies AI entitlement;
- workspace membership/admin evidence never implies global SG entitlement;
- own-result read never implies other-result read;
- result delivery never implies `ai.compose`;
- denied AI access executes zero AI Router calls;
- budget denial executes zero paid/model-backed calls;
- explicit deny wins over weaker inherited/template allow;
- expiration/revocation takes effect without waiting for a new login;
- sensitive scheduled actions revalidate current effective access/authority at execution time;
- no model, agent, task, worker, event or transport may self-grant;
- no delegated authority may exceed its envelope;
- no ACS operation may bypass existing Owner Security, Resource Authority, Action Gate or Credential Manager.

## Relationship to existing SG layers
ACS builds on Identity/Scope, Capability System, Configuration/Policy, Resource Ownership & Authority, Owner/Monarch Security, PostgreSQL, Delivery Router, AI Router/cost logging, Action Gate and Observability.

ACS replaces neither Resource Authority nor Action Gate. It consolidates effective subject entitlement/capability/usage decisions that currently exist in partial role/grant logic and prevents transports/identity bootstrap from accidentally broadening access.

Roadmap: `../roadmap/SG_ACCESS_CONTROL_SYSTEM_1_0_PROGRAM.md`.
Workflow: `../workflow/SG_ACCESS_CONTROL_SYSTEM_1_0_WORKFLOW.md`.
