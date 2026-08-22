# SG 2.1 — GitHub Development Execution Completion

## Status

**PLANNED / NOT IMPLEMENTED.**

This document extends the existing GitHub Development Workspace 3.0 (`GH3`) program. It does not create a second GitHub subsystem, semantic router, capability registry, authorization layer, Action Gate, CI service, task store, memory store or transport-specific execution path.

The purpose of this extension is to close the remaining runtime gap between the SG-wide semantic/canonical pipeline and the already implemented GH3 development execution stack, so that a natural-language instruction such as `реализуй LA1` can resolve into an authoritative development action and continue through repository mutation, validation, commit, push and exact-HEAD CI verification.

Canonical dependency chain:

```text
Natural-language request
→ Semantic Resolution
→ Canonical Semantic Model
→ Canonical GitHub/Development Action
→ Development Target Resolver
→ Existing Capability System
→ Existing GitHub Security Control Plane / Action Gate
→ Existing GH3 Development Orchestrator
→ Existing GH3 repository/write/CI services
→ Deterministic post-condition verification
→ Human-readable result
```

## Non-negotiable implementation rules

- Reuse `SEMANTIC_DETERMINISTIC_EXECUTION.md`; do not create phrase/regex routing for development commands.
- Reuse `GITHUB_DEVELOPMENT_WORKSPACE_3_0.md` and its GH3 services; do not create a second GitHub executor.
- Reuse the existing Capability System, ACS, Resource Authority, Action Gate, Credential Manager, Owner Security and GitHub Security Control Plane.
- Reuse the existing GH3 repository reader, atomic commit service, collaboration service, CI repair service, durable development task store and development orchestrator.
- Reuse existing exact-HEAD CI evidence rules. A green run for another SHA cannot satisfy the target.
- `main` is not the SG 2.1 working branch unless separately and explicitly authorized by current policy. Development work must remain inside the resolved authoritative branch scope.
- AI/model output may interpret intent, inspect code and assist planning/diagnosis through approved routing, but cannot itself grant GitHub authority, claim a write succeeded, claim CI is green or redefine repository/branch truth.
- Success requires provider/runtime post-condition evidence.

---

## GDE1 — Canonical GitHub Actions + Development Target Resolver

**Status: CLOSED / CI-VERIFIED.**

Implementation evidence:

- the global Canonical Semantic Model owns one bounded `github.*` action vocabulary;
- the existing GH3 meaning interpreter emits `github.development.execute` or the matching bounded read action and structured target facts, without granting authority;
- `githubDevelopmentTargetResolver` binds only to authoritative project/repository/branch context, reads the target through the existing GH3 repository reader, captures the immutable baseline HEAD, validates structured project/stage evidence and fails closed on missing or ambiguous scope;
- transport metadata is excluded from target identity;
- targeted contract, equivalence, ambiguity, non-`main`, exact-HEAD and no-phrase-routing regressions are covered by `tests/githubDevelopmentTargetResolver.test.js` and `tests/githubDevelopmentMeaningInterpreter.test.js`.

Closure evidence: exact implementation HEAD `2eac3632e2f99398c41a65dd81a5a446d4b04d4a`, SG 2.1 CI #8747 `SUCCESS` (Run ID `32564308591`).

### Goal

Bind natural-language development requests to the existing SG-wide Canonical Semantic Model and resolve an exact GitHub development target.

### Required implementation

Add bounded canonical development actions for the existing semantic pipeline, including at minimum:

```text
github.repository.inspect
github.code.search
github.file.read
github.file.create
github.file.update
github.file.delete
github.development.plan
github.development.execute
github.test.run
github.commit.create
github.push.execute
github.ci.verify
github.pr.inspect
github.pr.create
github.issue.inspect
github.issue.create
```

The semantic layer resolves meaning once. After canonicalization, action selection and authoritative execution are deterministic.

Resolve the target into bounded structured fields:

```text
repository
branch
baseline HEAD
project/block/stage scope
file/path scope where applicable
issue/PR/workflow/job identity where applicable
completion condition
```

Examples:

```text
"реализуй LA1"
→ action: github.development.execute
→ scope: LA1

"исправь этот баг"
→ action: github.development.execute
→ scope: resolved current development defect

"проверь CI"
→ action: github.ci.verify
→ target: exact current HEAD
```

### Required behavior

- Existing conversation/project context may supply repository and branch when already authoritative.
- Ambiguous repository, branch or development target must fail closed or request clarification.
- The resolver must inspect canonical docs, current code and current task/project context rather than infer implementation scope from keywords alone.
- Equivalent meaning from Telegram, Web/API, Discord, Email or future native SG UI must produce the same canonical development action except transport/delivery metadata.

### Acceptance

Deterministic tests prove semantic equivalence, target resolution, ambiguity handling, exact repository/branch binding and no regex/phrase-only development routing.

---

## GDE2 — Existing Capability Binding + Runtime Self-Knowledge

**Status: CLOSED / CI-VERIFIED.**

Implementation evidence:

- every bounded canonical GitHub action maps only to capability names already registered by GH3;
- `githubCapabilityBindingService` composes the existing GH3 Capability Registry, GitHub Security Control Plane and provider connection boundary without granting authority or executing a repository mutation;
- assessment uses current ACS grants, Resource Authority, Action Gate, emergency mode, credential/connection state, selected-repository scope and provider permissions;
- production GitHub status responses consume the deterministic assessment and expose its bounded runtime Self Knowledge fact;
- model statements and local `.git` availability are excluded from capability truth;
- exact blocker regressions cover missing connection/provider permission, ACS/Resource Authority/Action Gate denial, confirmation, emergency mode and repository installation scope.

Closure evidence: exact implementation HEAD `4008554ad2015d8e499e07cba45364d29cb4bfac`, SG 2.1 CI #8751 `SUCCESS` (Run ID `32564921207`).

### Goal

Make SG determine whether it can perform a requested GitHub operation from real connected capabilities and current authority instead of model assumptions.

### Required implementation

Map canonical GitHub actions to the existing GH3 capability families and current provider/runtime state, including at minimum:

```text
github.discovery.public.read
github.repository.read
github.code.search
github.branch.create
github.contents.write
github.commit.create
github.pull-request.read
github.pull-request.write
github.review.read
github.review.write
github.issue.read
github.issue.write
github.actions.read
github.actions.dispatch
github.actions.rerun
github.release.write
github.repository.admin
```

Capability answers must be derived from:

```text
registered capability
+ actor ACS grant
+ current Resource Authority
+ current connection/credential state
+ provider permission
+ Action Gate / risk policy
+ emergency mode
```

### Required behavior

SG must not answer `у меня нет доступа к GitHub` or `я не могу выполнить изменения` merely because the language model lacks a local `.git` workspace.

If execution is unavailable, SG must return the actual blocker, for example:

```text
missing GitHub connection
missing provider permission
actor capability denied
repository outside authorized installation scope
branch mutation denied
Action Gate confirmation required
emergency read-only mode
```

### Acceptance

Regression tests prove that:

- read capability is reported when actually available;
- write capability is reported only when all current gates permit it;
- local filesystem/git availability is not confused with GitHub API/provider execution capability;
- false `no GitHub access` answers are rejected when the authoritative capability path is available;
- AI text cannot self-grant or self-deny capability contrary to deterministic runtime state.

---

## GDE3 — Canonical-to-GH3 Execution Bridge + Change Set

**Status: CLOSED / CI-VERIFIED.**

Implementation evidence:

- `githubCanonicalExecutionBridge` accepts only resolved `github.development.execute` plus a successful current GDE2 capability assessment;
- it creates a bounded execution envelope and logical change set, revalidates the exact branch HEAD through the existing GH3 repository reader, then delegates create/resume to the existing `GitHubDevelopmentOrchestrator`;
- the existing GH3 development-task contract now durably retains the bounded development plan in its task JSON state;
- deterministic task identity makes retry transport-neutral and duplicate-safe while lifecycle status may advance;
- stale HEAD, conflicting paths, empty mutation sets, missing post-conditions, unavailable capability and unsupported canonical actions fail closed before orchestrator mutation.

Closure evidence: exact implementation HEAD `479d5f5495d0ca107d3e59b1230922276b34fad0`, SG 2.1 CI #8755 `SUCCESS` (Run ID `32565617361`).

### Goal

Connect `github.development.execute` and related canonical actions to the already implemented GH3 development services.

### Required implementation

Introduce only a bridge/binding layer between the Canonical Semantic Model and the existing `GitHubDevelopmentOrchestrator`.

The bridge must pass a bounded execution envelope containing:

```text
actor/global_user_id
project scope
repository
branch
baseline HEAD
canonical action
development target
completion condition
allowed operation classes
trace/provenance
```

The GH3 orchestrator remains the execution owner.

Before mutation, build a deterministic development plan and logical change set describing:

```text
files to read
files to create
files to modify
files to delete
tests to add/change
docs to update
migrations if required
expected post-conditions
```

### Required behavior

- Do not create a second mutation service.
- Use the existing GH3 repository reader for source inspection.
- Use the existing GH3 atomic commit service for multi-file repository mutation.
- Use the existing GH3 security control plane before protected/provider operations.
- Use the existing durable development task state for resumability/idempotency.
- Revalidate baseline HEAD immediately before mutation; HEAD drift must stop or explicitly replan, never silently overwrite.

### Acceptance

Tests prove that canonical `development.execute` reaches the existing GH3 orchestrator, creates one bounded task/change set, respects branch/repository scope, rejects stale HEAD, and does not create duplicate commits or parallel execution state.

---

## GDE4 — Validation + Commit + Push Lifecycle

**Status: CLOSED / CI-VERIFIED.**

Implementation evidence:

- `githubChangeSetValidationService` performs bounded deterministic pre-commit checks and supports project-approved syntax/test/contract/migration/architecture check adapters;
- `githubValidatedCommitLifecycle` revalidates baseline HEAD, validates before mutation, authorizes contents/commit through the existing GH3 Security Control Plane, commits through the existing Atomic Commit Service and verifies the authorized branch points to the created SHA;
- the existing production GitHub execution service uses this lifecycle when the GH3 security plane is composed;
- validation failure, stale HEAD, `main`, Action Gate denial, secret/conflict content and false push success fail closed;
- retry remains delegated to existing atomic idempotency behavior.

Closure evidence: exact implementation HEAD `dec36c2f6ba140a5429c56db9f0c1f6b68c51ec4`, SG 2.1 CI #8759 `SUCCESS` (Run ID `32566233727`).

### Goal

Turn a development action into a verified repository change rather than stopping after code generation or analysis.

### Required implementation

For an authorized development task, execute the lifecycle:

```text
inspect
→ plan
→ mutate
→ validate
→ commit
→ update authorized branch
→ verify resulting commit SHA
```

Validation must use the project-approved deterministic checks applicable to the changed scope, including where relevant:

```text
syntax/module load
unit tests
targeted regression tests
contract tests
migration tests
npm run check
architecture invariants
```

Commit creation must bind to the logical change set and exact baseline/current HEAD.

Push/branch update must verify:

```text
target repository
authorized branch
expected baseline/current HEAD
no unexpected ref drift
commit SHA created by the task
branch protection / current authority
```

### Required behavior

- Failed validation cannot be reported as successful implementation.
- Commit/push must follow existing Action Gate/security policy.
- The implementation must not silently switch to `main` or another branch.
- Multi-file logical changes must remain atomic through existing GH3 mutation primitives.
- A provider success response must be followed by post-condition verification against the resulting repository state.

### Acceptance

Tests cover create/update/delete/multi-file changes, validation failure, stale branch, wrong branch, Action Gate denial, exact resulting SHA verification and idempotent retry.

---

## GDE5 — Exact-HEAD CI Completion + Failure Recovery Loop

**Status: CLOSED / CI-VERIFIED.**

Implementation evidence:

- `githubExactHeadCICompletionService` reuses the existing GH3 Actions CI repair service for exact-SHA inspection and first actionable failure evidence;
- final states are explicit: `SUCCESS`, `FAILURE`, `RUNNING`, `NOT_FOUND`, `CANCELLED`, `BLOCKED`;
- repair commits must derive from the failed exact HEAD, remain in the same task envelope and are bounded by the task completion-attempt policy;
- each repair SHA is inspected anew; another-SHA CI evidence and invalid repair ancestry fail closed;
- successful completion can checkpoint exact-head evidence through the existing durable task store.

Closure evidence: exact implementation HEAD `c69ac1007c61f78f4bad4d52171fecbf564e8445`, SG 2.1 CI #8763 `SUCCESS` (Run ID `32567164437`).

### Goal

Make `реализуй/исправь/заверши` capable of reaching a declared working completion condition instead of stopping after push.

### Required implementation

After branch update:

```text
resolve new exact HEAD
→ find/observe CI for that exact SHA
→ inspect run/jobs/steps/checks
→ classify first actionable failure
→ obtain bounded/redacted evidence
→ repair within the same task envelope
→ validate
→ create derived repair commit
→ update branch
→ verify CI again on the new exact HEAD
```

Use the existing GH3 CI service/repair loop. Do not introduce a second workflow monitor.

Supported final states must be explicit, for example:

```text
SUCCESS
FAILURE
RUNNING
NOT_FOUND
CANCELLED
BLOCKED
```

### Required behavior

- Never claim `всё зелёное` without exact-HEAD evidence.
- A CI run for another SHA is invalid evidence.
- Repair attempts are bounded by existing task scope, cost/time/attempt policy and current authority.
- Missing logs/external checks produce an explicit evidence gap/blocker rather than invented diagnosis.
- Restart/resume must reconcile live GitHub state before another mutation or rerun.

### Acceptance

Regression tests cover failed exact-HEAD CI, actionable failure localization, repair commit, green derived HEAD, cross-SHA rejection, missing logs, restart continuity and bounded retry exhaustion.

---

## GDE6 — Full GitHub Platform Operations + Audit + Regression + Canonical Sync

**Status: IMPLEMENTED / LOCAL TESTS VERIFIED / EXACT-HEAD CI PENDING.**

Implementation evidence:

- the canonical GitHub vocabulary and existing capability bindings now cover repository/discovery/branch/issue/PR/review/workflow/release and durable-continuation operations;
- `githubPlatformOperationsService` dispatches only to the existing GH3 reader, discovery, atomic commit, collaboration, CI, development bridge, task store and security control plane;
- follow-up development actions restore actor/project/repository/branch/HEAD context from the existing durable task state and fail closed on scope mismatch;
- protected/default branch switching, missing exact HEAD, current-authority denial, duplicate identity and unverified mutation results fail closed;
- every operation records bounded actor/action/repository/ref/HEAD/path/identity/security/post-condition/trace/idempotency/timestamp evidence through the injected audit sink;
- regression tests cover the supported canonical surface, durable continuity, security denial, `main` protection, exact-HEAD evidence and false-success prevention.

GDE6 must not be described as CLOSED until SG 2.1 CI succeeds on the exact implementation HEAD.

### Goal

Complete the general GitHub working surface around repository development while keeping one GH3 authority/execution stack.

### Required implementation

Wire canonical semantic actions to the already implemented GH3 collaboration/branch/CI services for:

```text
repository inspection
global/public discovery
authorized private discovery
branch inspection/create/reuse/compare
issues read/create/update/close where authorized
pull requests read/create/update
review inspection and authorized response
workflow/run/job/log/artifact inspection
failed-job/workflow rerun where authorized
tags/releases only under existing higher-risk policy
```

Add development-context continuity for natural-language follow-ups such as:

```text
"продолжай следующий этап"
"исправь упавший CI"
"сделай commit и push"
"проверь уже зелёный?"
```

Continuity must resolve from durable task/project/repository/branch/HEAD state, not from model guesswork.

Every externally visible GitHub operation must retain bounded audit/provenance evidence, including:

```text
requesting actor
canonical action
repository
branch/ref
old HEAD
new HEAD
changed paths/operation class
commit/PR/issue/workflow identity where applicable
security/gate result
CI/post-condition result
trace/idempotency key
timestamp
```

### Required regression scenarios

Positive:

```text
"найди LA1"
"реализуй LA1"
"исправь этот баг"
"добавь тест"
"обнови README"
"сделай commit"
"сделай commit и push"
"проверь CI"
"исправь упавший CI"
"продолжай следующий этап"
```

Negative/security:

```text
no write to unauthorized repository
no silent switch to main/protected branch
no mutation without current authority
no execution after HEAD drift without reconciliation
no duplicate commit/PR/workflow action on retry
no false GitHub-access denial when capability is available
no false success/green-CI claim without post-condition evidence
no second semantic router
no second GitHub executor
no second authorization/gate/task/memory stack
```

Synchronize affected canonical architecture/roadmap/workflow/status documentation only after implementation evidence exists. Documentation must distinguish `planned`, `implemented`, `ci-verified`, `live-accepted`, `deployed` and `live-verified` where applicable.

### Acceptance

GDE6 closes only when canonical natural-language requests can use the existing GH3 services consistently across supported transports, audit/provenance is complete, regression/security tests are green, exact-HEAD CI evidence is recorded and canonical docs are synchronized.

---

## End-state execution model

```text
User instruction
→ Semantic Resolution
→ Canonical Semantic Model
→ canonical GitHub/development action
→ Development Target Resolver
→ current capability/authority resolution
→ repository/branch/exact-HEAD preflight
→ bounded development plan/change set
→ existing GitHub Security Control Plane / Action Gate
→ existing GH3 Development Orchestrator
→ existing GH3 reader/mutation/collaboration/CI services
→ deterministic validation
→ commit / authorized branch update
→ exact-HEAD CI
→ bounded repair loop if required
→ verified completion or explicit blocker
→ PDK4/PM3 evidence through existing bridge
→ human-readable result
```

## Completion rule

This extension is complete only when GDE1–GDE6 are implemented and exact-HEAD CI verified, and the live acceptance requirements that depend on a real authorized GitHub boundary are satisfied through the existing GH3.12 acceptance contract.

Until then, SG must not describe itself as having complete end-to-end natural-language GitHub development execution merely because individual GH3 services exist.

Related canonical documents:

- `../architecture/SEMANTIC_DETERMINISTIC_EXECUTION.md`
- `../architecture/GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`
- `GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md`
- `../workflow/GITHUB_DEVELOPMENT_WORKSPACE_3_0_WORKFLOW.md`
- `../architecture/CAPABILITY_SYSTEM.md`
- `../architecture/DECISION_AND_ACTION_GATE.md`
- `../architecture/SELF_KNOWLEDGE.md`
