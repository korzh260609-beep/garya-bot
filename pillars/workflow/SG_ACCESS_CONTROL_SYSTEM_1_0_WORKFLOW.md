# SG 2.1 — SG ACCESS CONTROL SYSTEM 1.0 WORKFLOW

## Status
**PLANNED / NOT IMPLEMENTED.**

ACS1 is implemented as a transport-neutral security/control program. No stage is CLOSED from documentation alone.

## Global implementation rule
For every ACS1 stage:

```text
verify current dev/sg2.1-semantic HEAD and SG 2.1 CI
→ inspect existing identity/access/capability/resource-authority/action-gate/cost code
→ define/adjust canonical contract
→ persistence/migration where needed
→ deterministic policy/service implementation
→ wire before paid/protected execution
→ regression/security tests
→ CI
→ cross-transport/live acceptance where required
→ documentation synchronization
```

`main` is not authoritative for SG 2.1 state and is not used for implementation.

## ACS1.1 — Access Domain Foundation
**PLANNED.**

Define canonical AccessStatus, Entitlement, CapabilityRegistryEntry, CapabilityGrant, Scope/own-resource, Constraint, AccessDecision, AccessRequest, DelegationEnvelope and UsagePolicy contracts.

Acceptance:
- contracts are transport-neutral;
- protected capabilities default-deny;
- no contract implies access from identity existence alone.

## ACS1.2 — Identity / Access Separation
**PLANNED.**

Remove automatic conversational AI entitlement from identity/bootstrap paths. Migrate the current production Telegram new-guest behavior that auto-grants `compose-answer`.

Target baseline for a new ordinary subject:
- identity exists;
- `delivery-only` status;
- own private delivery/result access;
- access-request ability;
- no `ai.compose`.

Mandatory regression:
- new user `/start`/first login does not invoke or grant AI;
- membership in a Telegram/Discord/Web workspace does not grant global AI;
- denied ordinary question results in zero AI Router calls.

## ACS1.3 — Capability Registry
**PLANNED.**

Build one versioned registry for SG capabilities with risk, allowed scopes, budget impact, approval/escalation class and delegation metadata. Existing capability names are mapped rather than duplicated.

## ACS1.4 — Scope Authority Model
**PLANNED.**

Implement effective global/project/workspace/resource/own-resource capability resolution with strict isolation.

Acceptance includes cross-workspace and own-vs-other resource denial.

## ACS1.5 — Deterministic Policy Engine
**PLANNED.**

Implement `evaluate(actor, capability, scope, resource, context)` returning bounded ALLOW/DENY/ESCALATE decisions plus reason/evidence.

AI/model output may propose semantic intent/capability but never determines the final access decision.

## ACS1.6 — SG Default Access Authority
**PLANNED.**

Make SG the default access manager inside a Monarch-defined policy envelope.

Implement automatic GRANT / GRANT_LIMITED / DENY where policy is sufficient and ESCALATE only where higher human authority is required.

## ACS1.7 — Access Request Workflow
**PLANNED.**

Implement durable request → validate → deduplicate → evaluate → grant/deny/escalate → notify → audit.

Natural language, UI and API requests normalize into the same AccessRequest contract.

## ACS1.8 — Approval & Escalation
**PLANNED.**

Implement authority-chain resolution, partial approval, modified grants, denial and escalation. Human approval is an escalation path, not the default control path.

## ACS1.9 — Temporary / Conditional Grants
**PLANNED.**

Implement `validFrom`, `expiresAt`, `maxUses` and bounded conditions such as active membership/current admin authority where applicable. Expiration/revocation must take effect without a new login.

## ACS1.10 — AI Usage Gate
**PLANNED.**

Place access and usage evaluation before AI Router for every chargeable/model-backed request.

Mandatory invariant:

```text
ai.compose denied OR budget denied
→ zero AI Router calls
→ deterministic local denial/request-access response
```

## ACS1.11 — Budget, Credits & Billing Scope
**PLANNED.**

Support bounded request/credit/USD/model-tier/rate/concurrency policies with billing scopes such as personal/workspace/project/monarch/sponsored.

## ACS1.12 — Private Delivery & Own-Result Access
**PLANNED.**

Implement durable private-result delivery independent of general AI access.

Critical scenario:
1. user participates in a group test/form/poll flow;
2. no private conversation exists;
3. result is stored and private delivery remains pending;
4. public/group scope receives no private result;
5. user later authenticates privately;
6. user receives only their own pending result;
7. no `ai.compose` is granted as a side effect.

## ACS1.13 — Delegation
**PLANNED.**

Implement bounded DelegationEnvelope semantics. A delegate cannot grant themselves more authority, broaden scopes/budgets or re-delegate unless explicitly permitted.

## ACS1.14 — Workspace / Transport Role Integration
**PLANNED.**

Treat Telegram admin status, Discord guild roles and similar facts only as current resource/transport evidence. They never create SG-global ownership or conversational entitlement automatically.

## ACS1.15 — Resource Authority Integration
**PLANNED.**

Require both ACS capability and existing Resource Authority for protected resource operations. Preserve fresh re-checks for revocable authority.

## ACS1.16 — Action Gate Integration
**PLANNED.**

Ensure protected state/external mutations pass ACS/authority evaluation before existing Action Gate. No parallel gate or direct model→action path is introduced.

## ACS1.17 — Transport-Neutral Enforcement
**PLANNED.**

Wire the same ACS service to Telegram, Discord, Web, API, Email and future native SG interfaces. Cross-platform Global ID linking preserves access state without weakening transport authentication/resource checks.

## ACS1.18 — Access Management Service/API
**PLANNED.**

Expose canonical internal operations for effective access, grants, requests, reviews, revoke, usage policy and audit. Transport/UI endpoints adapt this surface; they do not own policy.

## ACS1.19 — Management UI
**PLANNED.**

Provide access management in the future native SG interface and applicable Mini Apps/UIs: users, effective capabilities, budgets, pending requests, temporary grants, revoke and audit.

## ACS1.20 — Audit & Observability
**PLANNED.**

Record grant/limited-grant/deny/escalate/revoke/expire/budget-deny decisions with bounded evidence and reason. Add operational metrics including blocked AI calls and avoided AI spend without leaking secret/private payloads.

## ACS1.21 — Security Regression Suite
**PLANNED.**

Required coverage:
- new identity has no AI by default;
- `/start`/login does not grant AI;
- workspace membership/admin does not grant global AI;
- own-result cannot read another user's result;
- delivery does not grant AI;
- explicit deny precedence;
- expiration/revocation immediate effect;
- delegation envelope cannot be exceeded;
- budget denial produces zero paid/model calls;
- cross-workspace isolation;
- same Global ID has coherent access across transports.

## ACS1.22 — Cross-Transport E2E
**PLANNED.**

Prove one Global User ID across at least two transports uses one ACS truth while preserving transport-specific authentication/resource facts.

## ACS1.23 — Production / Live Acceptance
**PLANNED.**

Critical live scenario:
1. previously unknown user exists in a workspace but never opened SG privately;
2. participates in a private-result flow;
3. private result is retained without public leakage;
4. user opens SG and receives own result only;
5. ordinary AI question is denied before AI Router;
6. SG offers/creates an AccessRequest;
7. SG automatically evaluates within policy or escalates;
8. grant/limited grant enables only approved capabilities/limits;
9. revocation/expiry immediately stops future use;
10. audit and budget evidence match actual execution.

ACS1 is CLOSED only when code, persistence, tests, CI, cross-transport enforcement and required live acceptance are complete.

## Security rule
No ACS stage may weaken Identity, Owner/Monarch Security, Resource Authority, Action Gate, Credential Manager, Memory privacy/isolation, AI Router accounting or existing transport authentication.
