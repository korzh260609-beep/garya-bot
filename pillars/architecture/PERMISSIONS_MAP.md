# PERMISSIONS_MAP.md — SG Permissions Map

Purpose:
- Define the canonical high-level permissions and access-control map of SG.
- Show where permission decisions belong and how they relate to modules and actions.
- Reduce privilege drift and scattered access logic.

Status: CANONICAL
Scope: high-level permissions and access-control architecture

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`
- `pillars/architecture/README.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`

---

## 0) Why this file exists

`MODULE_MAP.md` defines module ownership.  
`DATA_FLOW.md` defines how information moves.

This file defines:

- where permission decisions belong
- what kinds of actions require access checks
- how permission logic must stay centralized
- how access to SG components differs from authority over SG itself

Without this map, access control tends to spread invisibly.

---

## 0.1) SG entity rule for permissions

SG is the global project entity.

Permissions grant access to actions, components, surfaces, data, or operations of SG.

Permissions must not accidentally grant ownership over SG’s identity, architecture, decisions, memory policy, or project experience.

Correct model:

```text
SG = global project entity
permission = bounded right to use/control a specific SG surface or action
component access ≠ authority to redefine SG
```

Incorrect model:

```text
access to component = authority over SG itself
admin command access = right to change SG architecture
external agent access = ownership of SG decisions/memory/identity
```

---

## 1) Core principle

Permission logic must be:

- explicit
- centralized enough to review
- action-oriented
- deny-safe
- separated from unrelated module logic
- compatible with SG entity integrity

A feature working correctly is not enough.

It must also be clear:
- who may use it
- who may not
- where that decision is enforced
- whether the permission affects a component only or SG governance itself

---

## 2) Canonical permission boundary

Primary ownership of permission decisions belongs to:

Users / Access module

Canonical decision shape:

- resolve user/access subject
- resolve role/effective access state
- evaluate `can(user, action, context?)`
- enforce allow/deny before protected behavior proceeds

Hard rule:
- protected behavior must not rely on vague assumptions like
  “this command is obviously admin-only”
- permission by convention is not enough
- component-level access must not imply architecture/governance authority

---

## 3) High-level role map

Current conceptual role map in SG includes:

- `guest`
- `citizen`
- `vip` (where introduced in runtime/policy)
- `monarch`
- system/internal privileged paths where explicitly defined

Important note:
- this file is a high-level map
- exact runtime role availability may depend on current stage and implementation
- if runtime and docs diverge, verified runtime + canonical pillars win

### 3.1 Monarch role

The monarch is the ultimate project owner and decision source for SG governance, architecture, and privileged project-level direction.

Monarch-level authority may include:
- approving architecture changes
- approving accepted decisions
- approving privileged access changes
- controlling project governance surfaces
- approving runtime connection of sensitive capabilities
- approving changes that affect SG identity or component boundaries

Even for monarch operations, implementation must remain explicit, logged where appropriate, and compatible with pillars.

### 3.2 Non-monarch roles

Non-monarch roles may receive bounded access to SG features or components.

They must not receive authority to modify SG identity, architecture, core decisions, source-of-truth policies, or project governance unless a future accepted decision explicitly defines such delegation.

---

## 4) Permission categories

### 4.1 Public/low-risk usage
Examples:
- ordinary chat interaction
- basic informational commands
- bounded non-sensitive feature usage

Expectation:
- may be available broadly depending on current policy/stage
- still may pass through access logic where needed

---

### 4.2 Role-gated feature usage
Examples:
- advanced feature access
- user-tier-limited commands
- special report/task surfaces
- elevated continuity/memory features

Expectation:
- role/plan/feature limits may apply
- access decision must remain centralized

---

### 4.3 Sensitive operational usage
Examples:
- admin/operator commands
- repo inspection surfaces
- diagnostics surfaces
- source management/testing surfaces
- role/grant-related commands
- Human Mode project/repo surfaces
- Technical Mode diagnostics surfaces

Expectation:
- explicit access checks required
- denial must remain reviewable

---

### 4.4 High-risk privileged usage
Examples:
- monarch-only controls
- project-structure/governance-affecting actions
- grant/revoke/elevated admin operations
- sensitive runtime inspection or control surfaces
- Human Mode runtime connection for repo/project work
- RepoStateAgent live factual runner access where sensitive
- accepted decision / pillar modification

Expectation:
- explicit privileged gating required
- hidden bypasses are critical bugs

---

### 4.5 Entity/governance authority
Examples:
- changing what SG is or is not
- changing Human Mode / Technical Mode boundaries
- changing RepoStateAgent source-of-truth policy
- changing architecture ownership
- changing accepted decisions
- changing core project governance

Expectation:
- monarch-only by default
- must be fixed in pillars/decisions when architectural
- cannot be inferred from ordinary feature/admin access

---

## 5) Permission-to-module map

### 5.1 Bot
Permission questions:
- may this user invoke this command/surface?
- may this path proceed to protected handler logic?
- is this Human Mode or Technical Mode behavior?

Rule:
- Bot may call access checks
- Bot must not invent long-term permission policy locally
- Bot access does not grant authority over SG itself

---

### 5.2 Transport
Permission questions:
- usually not owned here

Rule:
- Transport may help identify context
- Transport must not replace the access layer
- Transport identity does not equal SG identity

---

### 5.3 Memory
Permission questions:
- may this context read/write happen for this user/flow?
- may memory-sensitive surfaces be used?
- may this user access project memory or only personal memory?

Rule:
- Memory policy and access interaction may exist
- but core access decision ownership still stays centralized
- memory access does not allow rewriting pillars or accepted decisions

---

### 5.4 Sources
Permission questions:
- may this user access/test/manage this source?
- may diagnostics or source admin surfaces be used?

Rule:
- source-specific restrictions may exist
- permission ownership still remains centralized
- source access does not allow inventing facts or bypassing source-first policy

---

### 5.5 Repo
Permission questions:
- may this user inspect this repo surface?
- may this path/file/scope be fetched?
- may this request use RepoStateAgent-backed factual state?

Rule:
- Repo applies guarded path policy
- Users / Access determines whether the actor is allowed to use the surface
- Human Mode project/repo access must be explicitly gated

Important distinction:
- repo path filtering is not the same thing as user permission policy
- repo inspection permission is not repo mutation permission
- repo facts access is not authority to change SG architecture

---

### 5.6 Tasks
Permission questions:
- may this user create/run/inspect this task?
- may recurring or sensitive tasks be triggered?

Rule:
- task execution surfaces must not assume permission by default
- privileged task operations require explicit checks
- task automation must not become autonomous governance action

---

### 5.7 Logging / Diagnostics
Permission questions:
- may this user view this diagnostic surface?
- how sensitive is the diagnostic payload?

Rule:
- diagnostics may require stronger access than ordinary feature usage
- access to visibility surfaces must remain explicit
- diagnostics visibility does not grant decision authority

---

### 5.8 Project Memory
Permission questions:
- may this user read/update project-specific continuity state?
- which project-aware surfaces are role-limited?

Rule:
- Project Memory may hold sensitive continuity context
- access must not be assumed implicitly
- Project Memory cannot override pillars, decisions, or verified repo/runtime state

---

### 5.9 File-Intake
Permission questions:
- may this user use this intake/extraction surface?
- are certain file-processing paths restricted?

Rule:
- extraction modality rules are not permission rules
- permission gating still belongs centrally

---

### 5.10 AI Routing
Permission questions:
- may this feature/user invoke AI here?
- is this AI path cost/risk-sensitive enough to require stronger gating?

Rule:
- AI Routing enforces centralized AI-call discipline
- but user permission/governance about usage still belongs to the access layer
- external AI/model access does not grant SG identity or decision ownership

---

## 6) Action-oriented permission model

Permissions should prefer action names, not vague feature feelings.

Examples of action shape:
- `command.use`
- `repo.inspect`
- `repo.fetch_sensitive`
- `repo_state_agent.run`
- `human_mode.project_repo.use`
- `technical_mode.diagnostics.use`
- `source.test`
- `source.manage`
- `task.create`
- `task.run`
- `diagnostics.view`
- `grant.manage`
- `project_memory.write`
- `pillar.modify`
- `decision.accept`
- `architecture.modify`

Important note:
- this file does not force exact current runtime action strings
- it fixes the principle that permissions should be action-oriented and reviewable

---

## 7) Deny-safe rule

When access is ambiguous:

- do not silently allow privileged behavior
- do not rely on “probably okay”
- make denial/failure explicit enough to review

A denied protected action is safer than a silently mis-granted one.

For entity/governance-sensitive behavior, ambiguity must fail closed.

---

## 8) Hidden-bypass patterns to treat as critical risk

The following patterns are dangerous:

- handler-local role exceptions
- transport-level privilege assumptions
- repo/admin/diagnostic surfaces reachable without explicit central checks
- implicit trust because “only monarch uses this for now”
- local feature code deciding privileged access by convenience
- project/governance-affecting behavior without clear privileged gate
- component access being treated as permission to redefine SG
- external AI/tool access being treated as ownership of SG decisions or project experience
- Human Mode repo/project work bypassing monarch/private or future project-level permission gates
- Technical Mode diagnostics leaking into normal user-facing Human Mode without gate

These patterns may feel convenient,
but they destroy reviewability.

---

## 9) Relationship to identity

Identity and permissions are related but not identical.

Identity answers:
- who is this subject?

Permissions answer:
- what may this subject do?

Cross-platform identity linking does not automatically mean cross-platform permission clarity unless access logic explicitly resolves it.

Do not conflate these layers.

SG entity identity is also separate from user identity:
- SG remains the global project entity.
- Users may access SG surfaces according to permissions.
- No user role except monarch-governed authority may change SG identity/governance.

---

## 10) Relationship to governance

Permission logic does not override canonical governance.

That means:
- if canonical pillars say an action is restricted, runtime access logic must respect that
- convenience must not silently widen privilege
- monarch-only or stage-gated restrictions are not optional implementation details
- accepted decisions and entity rules constrain permission design

---

## 11) When this file must be updated

Update this file when:

- a new high-risk surface becomes canonical
- role model changes materially
- a new permission category appears
- a new module gains important protected surfaces
- a previous permission assumption is proven wrong
- Human Mode / Technical Mode access boundaries change
- RepoStateAgent factual runner access changes
- a permission can affect SG entity/governance boundaries

Do not update this file for every tiny command.

This is a high-level permissions map, not an exhaustive runtime ACL dump.

---

## 12) Final rule

A system is not permission-safe just because it has role checks somewhere.

A system is permission-safe when:
- protected actions are explicit
- checks are centralized enough to review
- hidden bypasses are treated as bugs
- privilege does not spread by convenience
- component access does not become authority over SG itself