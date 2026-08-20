# SG 2.1 — GITHUB DEVELOPMENT WORKSPACE 3.0 PROGRAM

## Status
**IMPLEMENTATION COMPLETE THROUGH GH3.12. GH3.1–GH3.11 CLOSED / CI-VERIFIED; GH3.12 IMPLEMENTED / CI-VERIFIED / LIVE ACCEPTANCE PENDING.**

GitHub Development Workspace 3.0 (`GH3`) is the canonical transport-neutral program that lets SG inspect GitHub globally and perform complete, durable development work in explicitly authorized repositories.

GH3 is an internal SG capability. Telegram, Discord, Web, API, Email, the future native SG interface and later transports are clients of the same development service; no transport owns GitHub logic, credentials, task state or authorization policy.

Documentation does not prove implementation. GH3 remains open until code, exact-HEAD CI, restart continuity and required live GitHub acceptance satisfy the gates below.

## Product outcome

An authorized user can issue a natural-language development instruction through any supported transport, for example:

```text
Finish HS6 on the authorized development branch and continue until exact-head CI is green.
```

SG must then be able to:

- resolve the same `global_user_id`, project and durable development task across transports;
- verify the current repository, branch, exact HEAD, canonical docs and CI before mutation;
- inspect code/history/PRs/issues/checks/workflows and prepare a bounded work plan;
- create or reuse an authorized working branch;
- create, edit, move and delete files and form an atomic multi-file commit;
- create/update a pull request, inspect reviews and address authorized feedback;
- dispatch and inspect GitHub Actions, retrieve bounded logs/artifacts and identify the first actionable failure;
- iterate code/test/CI until the declared completion condition is satisfied or a real policy/authority/evidence blocker exists;
- persist progress and resume safely after SG/worker/transport restart without duplicate commits, PRs or external actions;
- synchronize Project Memory 3.0 / PDK4 only through their existing trusted-evidence contracts.

## Two GitHub scopes

### Global GitHub Discovery

On explicit instruction, SG may search and inspect the public GitHub corpus for repositories, code, commits, issues, pull requests, users/organizations, releases, licenses, documentation, activity and implementation patterns.

Global discovery is read-only by default. Public search results are external evidence with provenance/currentness, not automatically trusted project truth and not permission to copy or mutate anything.

Private or restricted GitHub data is visible only through an explicitly connected and authorized account/app installation with sufficient provider permissions.

### Authorized Repository Workspace

State-changing work is limited to repositories, branches, operations and credentials authorized by canonical SG policy. A GitHub connection or app installation does not itself grant an SG actor permission to use it.

Effective execution requires the composition of:

```text
Identity/Scope
AND ACS capability/entitlement
AND current Resource Authority
AND Action Gate/risk policy
AND approved Credential Manager binding
AND provider permission
```

## Canonical stage order

### GH3.1 — Domain Contract & Capability Registry
Define transport-neutral repository, ref, revision, development-task, proposed-change, mutation-plan, CI-run and completion-condition contracts. Register bounded read/search/write/PR/CI/release/administration capabilities without creating blanket authorization.

Implementation evidence: `src/githubDevelopment/githubDevelopmentContract.js`, `src/githubDevelopment/githubCapabilityRegistry.js` and `tests/githubDevelopmentContract.test.js`. The registry defines names/risk/default policy only; it does not grant actor authority or claim provider execution is available.

Closure evidence: exact HEAD `243bb8835f65ba51cb9bd1e31ce599f4a5d25d5c`, SG 2.1 CI #8553 `SUCCESS`.

### GH3.2 — GitHub App Authentication & Connection Binding
Implement short-lived GitHub App installation authentication, approved repository selection, credential isolation/rotation, permission discovery and fail-closed connection health. Raw keys/tokens never enter prompts, memory or ordinary telemetry.

Implementation evidence: `src/githubDevelopment/githubAppConnectionProvider.js` and `tests/githubAppConnectionProvider.test.js`. The provider composes the existing External Connections Registry and Credential Manager, creates bounded short-lived installation tokens inside the secret callback, enforces installation-selected repositories and discovered provider permissions, supports cache invalidation on rotation, and records explicit connection health.

Closure evidence: exact HEAD `310aaf6b25ead13d3cb9ee32e0cf836b682aef30`, SG 2.1 CI #8555 `SUCCESS`.

### GH3.3 — Global Public GitHub Discovery
Implement bounded public repository/code/commit/issue/PR/user/release/documentation search with pagination, rate-limit handling, provenance, freshness, license visibility and result qualification. Private discovery requires explicit authorized connection scope.

Implementation evidence: `src/githubDevelopment/globalGitHubDiscoveryService.js` and `tests/globalGitHubDiscoveryService.test.js`. Public discovery is read-only and secret-free; authorized private discovery must pass through GH3.2. Results are bounded, provenance/currentness/rate-limit qualified, marked as untrusted external data and never promoted to Project Memory automatically.

Closure evidence: exact HEAD `74c4ade02eed94ca7be809c46a1e485ecf6f8a30`, SG 2.1 CI #8559 `SUCCESS`.

### GH3.4 — Repository Read & Analysis
Read repository metadata, refs, immutable file/tree/blob content, diffs, commit history, canonical docs, issues, pull requests, reviews, checks, workflow runs/jobs and artifacts. Repository facts are verified at an immutable revision when correctness depends on exact state.

Implementation evidence: `src/githubDevelopment/githubRepositoryReadAnalysisService.js` and `tests/githubRepositoryReadAnalysisService.test.js`. Moving refs are resolved once to a full commit SHA; tree, file, history, checks and workflow facts then bind to that immutable revision. Public and authorized-private reads remain separate, private access passes through GH3.2, repository identity is fail-closed, output is bounded and provider content remains untrusted external data.

Closure evidence: exact implementation HEAD `652d79d159fce06ef94dc960b7a58278a99dbdb8`, SG 2.1 CI #8563 `SUCCESS`.

### GH3.5 — Branch, File & Atomic Commit Operations
Create/reuse authorized branches; create/edit/move/delete files; construct one reviewable atomic multi-file commit through Git data primitives; detect stale HEAD/non-fast-forward conflicts; preserve unrelated changes; and provide a reversible audit record.

Implementation evidence: `src/githubDevelopment/githubAtomicCommitService.js` and `tests/githubAtomicCommitService.test.js`. Authorized branches are created or reused only at an exact baseline. File create/update/move/delete operations validate the immutable baseline tree and expected blob identities, build one derived tree, create one commit with an idempotency trailer and update the branch without force. Stale heads, non-fast-forward updates and path/blob conflicts fail closed; unrelated tree entries remain inherited and the result contains bounded rollback/audit evidence.

Closure evidence: exact implementation HEAD `4a6c0d6194557b37cd7b9e0cdaad666168f5fc42`, SG 2.1 CI #8567 `SUCCESS`.

### GH3.6 — Pull Requests, Reviews, Issues, Releases & Tags
Create/update PRs, read canonical review threads, apply authorized fixes, reply/resolve only when authorized, manage issues/labels/milestones and create authorized tags/releases. Duplicate PRs/releases and ambiguous retries fail closed.

Implementation evidence: `src/githubDevelopment/githubCollaborationService.js` and `tests/githubCollaborationService.test.js`. The service binds PR identity to the canonical repository/base/head tuple, marks mutations with idempotency keys, bounds review evidence, requires current scoped capabilities/provider permissions for every operation and requires separate approval for review-thread resolution and release creation. Issue labels/milestones, tag targets and release identity are validated; duplicate-safe retries reuse exact provider state while conflicts and ambiguous matches fail closed.

Closure evidence: exact implementation HEAD `d20fa069d6004c9d433c0a14d930fd57432bfaef`, SG 2.1 CI #8571 `SUCCESS`.

### GH3.7 — GitHub Actions, Checks & CI Repair Loop
Dispatch authorized workflows, inspect runs/jobs/steps/logs/artifacts/checks/statuses, correlate them with exact HEAD, classify the first actionable failure, patch and rerun until the explicit completion condition is met. A green run on another revision is not evidence for the target HEAD.

Implementation evidence: `src/githubDevelopment/githubActionsCIRepairService.js` and `tests/githubActionsCIRepairService.test.js`. Workflow inspection, dispatch, failed-job rerun and failure localization are bound to one full target SHA. Dispatch verifies the live branch head and deduplicates the logical attempt; reruns reject another revision and enforce bounded attempts. Logs are bounded, redacted and remain untrusted external data.

Closure evidence: exact implementation HEAD `9db540f14a79a2016c7a4916b4c3303d8a609bd3`, SG 2.1 CI #8575 `SUCCESS`.

### GH3.8 — Transport-Neutral Development Orchestrator
Expose one internal development service to Telegram, Discord, Web, API, Email, the future native SG interface and later transports. Transports carry authenticated actor/context and render results; they do not implement GitHub behavior.

Implementation evidence: `src/githubDevelopment/githubDevelopmentOrchestrator.js` and `tests/githubDevelopmentOrchestrator.test.js`. The internal service owns structured create/status/resume operations and semantic-command routing while transport adapters supply only canonical identity, scope, trace and presentation. Task ownership is bound to verified Global ID and project scope, transport metadata cannot widen authority, exact retries are idempotent and Telegram/Web API acceptance proves equivalent behavior. Durable PostgreSQL state and restart reconciliation remain GH3.9 scope.

Closure evidence: exact implementation HEAD `1005fe8cbc510c23ebb30fd4a326cf47d43e95a4`, SG 2.1 CI #8579 `SUCCESS` on Node.js 22.

### GH3.9 — Durable Development Task State & Restart Continuity
Persist task intent, actor/project/repository scope, branch, baseline/current HEAD, mutation plan, changed paths, commits, PR, CI runs/jobs, failure analysis, approvals, idempotency keys, completion condition and next action. Resume from verified GitHub state after restart and reconcile divergence before continuing.

Implementation evidence: `src/persistence/migrations/914_github_development_tasks.sql`, `src/githubDevelopment/postgresGitHubDevelopmentTaskStore.js` and `tests/githubDevelopmentRestartContinuity.test.js`. Versioned PostgreSQL checkpoints retain the complete task plus bounded progress, idempotency keys and next action. Resume reloads durable state, rechecks actor/project authority, reconciles live repository identity/state and suppresses already completed external actions. Optimistic version conflicts and scope/repository divergence fail closed.

Closure evidence: exact implementation/fix HEAD `5c2d69d179d58f3d89d8708f914395405c1e8f5c`, SG 2.1 CI #8585 `SUCCESS` on Node.js 22.

### GH3.10 — PM3/PDK4 Trusted Development Evidence Integration
Normalize verified GitHub outcomes into existing PDK4/PM3 ingestion contracts. GH3 must not create a parallel project-memory store, self-confirm model output, or claim deployed/live state from repository/CI evidence alone.

Implementation evidence: `src/githubDevelopment/githubTrustedDevelopmentEvidenceIntegration.js` and `tests/githubTrustedDevelopmentEvidenceIntegration.test.js`. Verified immutable commits and PR heads become code-qualified PDK4 events; only successful workflows bound to the same full target SHA become CI-qualified events. Every PM3 projection remains a deterministic `proposed`/unconfirmed candidate, reuses existing PDK4/PM3 ingestion and idempotency contracts, and rejects model self-confirmation, cross-project sink results, PM3 promotion and repository/CI claims of deployed or live-verified state.

Closure evidence: exact implementation HEAD `127b9435d19c845e00c74d88cc4a8b975968c7f0`, SG 2.1 CI #8589 `SUCCESS` on Node.js 22.

### GH3.11 — Authorization, Risk Tiers, Audit & Emergency Controls
Apply ACS, Resource Authority, Action Gate, Owner Security, Credential Manager, budgets/rate limits, audit and emergency disable controls. Read-only authorized work may run automatically; bounded dev-branch mutation may run under an explicit task execution envelope; protected branch merge and repository administration require separate higher-risk authority/confirmation.

Implementation evidence: `src/githubDevelopment/githubSecurityControlPlane.js` and `tests/githubSecurityControlPlane.test.js`. One fail-closed preflight composes registered capability risk, ACS, current Resource Authority, Action Gate, optional Owner Security, bounded rate policy, emergency `normal`/`read-only`/`disabled` modes and callback-confined Credential Manager use. Tier 3 requires separate request-bound confirmation; Tier 4 additionally requires Owner Security. Protected execution is blocked when security audit is unavailable, and audit evidence is secret-redacted.

Closure evidence: exact implementation HEAD `8c34eb87a3c3d5f55e85818ead2ae13e3387c668`, SG 2.1 CI #8591 `SUCCESS` on Node.js 22.

### GH3.12 — Cross-Transport E2E & Live Acceptance
Prove global public discovery, authorized private-repository isolation, multi-file commit, PR/review flow, exact-HEAD CI repair, restart/transport continuation, stale-head reconciliation, denial paths, secret safety, idempotency and PM3/PDK4 evidence ingestion against a real authorized GitHub test boundary.

Implementation evidence: `src/githubDevelopment/githubCrossTransportAcceptance.js` and `tests/githubCrossTransportAcceptance.test.js`. The acceptance runner executes the canonical twelve-step scenario through injected real boundary operations; the validator rejects incomplete or cross-SHA evidence, same-transport continuation, restart duplicates, missing private denial, unsafe protected-operation authorization, secret-shaped evidence and false PM3/deployment/live promotion. It requires an atomic multi-file commit, PR bound to the mutation SHA, failed exact-head CI with an actionable failure, a derived repair commit, green exact-head CI, durable restart reconciliation and the same actor/project/task across two distinct transports.

Implementation/CI evidence: exact implementation HEAD `11bca7313b84265f093e615121707165c55d07a5`, SG 2.1 CI #8593 `SUCCESS` on Node.js 22.

GH3.12 is implemented and CI-verified but is **not CLOSED** until the acceptance runner is supplied with evidence from a real authorized GitHub boundary and two real authorized SG transport/API surfaces satisfying every live gate.

## Minimum capability families

- `github.discovery.public.read`
- `github.repository.read`
- `github.code.search`
- `github.branch.create`
- `github.contents.write`
- `github.commit.create`
- `github.pull-request.read`
- `github.pull-request.write`
- `github.review.read`
- `github.review.write`
- `github.issue.read`
- `github.issue.write`
- `github.actions.read`
- `github.actions.dispatch`
- `github.actions.rerun`
- `github.release.write`
- `github.repository.admin`

These capabilities are scoped grants, not one "full access" switch. `github.repository.admin`, protected-branch mutation, merge, secret/environment mutation, destructive deletion and repository transfer remain high-risk and default-deny unless explicitly authorized.

## Completion rule

GH3 is complete only when GH3.1–GH3.12 are implemented, exact-head CI is green, canonical documentation is synchronized and live acceptance proves that SG can safely complete and resume real development work through more than one transport while also performing bounded global GitHub discovery.

Architecture: `../architecture/GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`.
Workflow: `../workflow/GITHUB_DEVELOPMENT_WORKSPACE_3_0_WORKFLOW.md`.
