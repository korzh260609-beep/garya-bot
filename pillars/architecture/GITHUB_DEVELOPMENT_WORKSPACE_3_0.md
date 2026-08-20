# SG 2.1 — GITHUB DEVELOPMENT WORKSPACE 3.0 ARCHITECTURE

## Status
**IMPLEMENTATION COMPLETE THROUGH GH3.12. GH3.1–GH3.11 CLOSED / CI-VERIFIED; GH3.12 IMPLEMENTED / CI-VERIFIED / LIVE ACCEPTANCE PENDING.**

## Purpose

GH3 gives SG one transport-independent GitHub discovery and development subsystem. It supports global public GitHub inspection on instruction and full development lifecycle operations inside explicitly authorized repositories.

## Context boundary

```text
Telegram / Discord / Web / API / Email / native SG UI / future transport
  → canonical Identity + Scope + conversation/task context
  → Semantic Kernel / intent
  → GitHub Development Orchestrator
  → GitHub discovery or authorized repository workspace
  → normalized result/events
  → Delivery Router to any authorized transport
```

No transport owns GitHub credentials, provider clients, mutation logic, CI repair state or development truth. A task may begin in one transport and continue in another only after canonical Global ID, scope and conversation/task-continuation policy resolve the same authorized subject and task.

## Main components

### GitHubConnectionProvider
Resolves an approved GitHub App installation/user connection from External Connections Registry and Credential Manager. It returns short-lived secret-safe execution authority plus discovered provider permissions and repository scope.

### GlobalGitHubDiscoveryService
Performs bounded public GitHub search/inspection and authorized private discovery. Results include provider identifiers, canonical URLs, revision/time, pagination/rate-limit state, license/security qualification where available and explicit public/private source class.

### GitHubRepositoryReader
Reads metadata, refs, commits, trees, blobs, files, comparisons, canonical docs and repository activity. Correctness-sensitive reads bind to immutable commit SHA rather than a moving branch name.

### GitHubMutationService
Creates/reuses branches and constructs atomic multi-file commits from an approved mutation plan. It rejects stale baselines, unresolved conflicts, unauthorized paths/refs, broad accidental staging and ambiguous retries.

### GitHubCollaborationService
Owns issues, pull requests, review threads, comments, labels, milestones, tags and releases. It resolves canonical base/head repository identity and deduplicates externally visible operations.

### GitHubCIService
Owns workflow dispatch, runs, jobs, steps, checks, statuses, bounded logs and artifacts. Every result is correlated with repository/ref/exact HEAD; a run for another SHA cannot satisfy the target gate.

### GitHubDevelopmentOrchestrator
Coordinates source-first analysis, bounded plan, mutation, commit, PR, CI, diagnosis, repair and completion. It cannot grant its own permissions or silently widen repository/branch/path/operation scope.

### GitHubSecurityControlPlane
Re-evaluates registered capability risk, ACS, current Resource Authority, Action Gate, Owner Security, rate policy, emergency state and Credential Manager scope before provider execution. `read-only` emergency mode blocks mutation; `disabled` blocks all GitHub work. Tier 3 requires separate request-bound confirmation and Tier 4 additionally requires Owner Security. Protected execution fails closed if its security decision cannot be audited.

### GitHubCrossTransportAcceptanceRunner
Executes the GH3.12 acceptance sequence through injected real scenario operations and validates the resulting evidence fail-closed. Acceptance requires qualified public discovery, unauthorized private denial, the same durable actor/project/task across two transports, exact baseline/CI/doc verification, an atomic multi-file commit and PR, failed exact-head CI with an actionable failure, a derived repair commit with green exact-head CI, restart reconciliation without duplicate external actions, separately gated protected operations, secret-safe evidence and correctly qualified PDK4/PM3 projections. The runner cannot manufacture live evidence; GH3.12 remains not closed until the real authorized cross-transport boundary supplies all required evidence.

### DevelopmentTaskStore
PostgreSQL-backed durable state for task intent, completion condition, actor/project/repository scope, baseline/current HEAD, plan/version, mutations, commits, PR/review state, CI evidence, blockers, next action and idempotency keys.

### PDK4DevelopmentEvidenceBridge
Converts verified GitHub events into existing PDK4 source-normalization/ingestion contracts. It does not bypass PM3 trust, confirmation, temporal, conflict or Context Guard rules.

The GH3.10 implementation accepts only immutable commit/PR identities and successful workflow evidence bound to the same full target SHA. It creates existing PDK4 `DevelopmentEvent` values and existing PM3 project-fact candidates; it owns no memory store. Repository/code evidence can qualify `implemented`, exact-head CI evidence can qualify `ci-verified`, and neither can qualify `deployed` or `live-verified`. Candidates remain proposed and unconfirmed until the independent PM3 confirmation/trust boundary acts.

## Execution model

```text
resolve actor/project/task
→ evaluate GitHub capability and resource/credential authority
→ verify repository + branch + exact HEAD + current CI + canonical docs
→ inspect and plan
→ re-evaluate mutation envelope
→ apply atomic change on authorized branch
→ verify resulting commit SHA
→ run/observe exact-head CI
→ diagnose first actionable failure
→ iterate within task envelope
→ satisfy completion condition or persist explicit blocker
→ ingest verified development evidence
→ deliver resumable human-readable result
```

The instruction "finish until working" authorizes persistence toward the stated completion condition only within the resolved execution envelope. It does not authorize protected-branch merge, secret changes, repository administration, unrelated cleanup or a broader product redesign.

## Authority and risk model

Technical provider permission and SG actor authority are separate.

```text
provider can perform operation
AND actor has scoped capability
AND current Resource Authority permits target
AND Action Gate/risk policy permits invocation
AND Credential Manager selects approved connection
= executable operation
```

Suggested risk tiers:

- Tier 0: public discovery and public read;
- Tier 1: authorized repository/private read, analysis and CI inspection;
- Tier 2: bounded development-branch mutation, commit, PR update and CI rerun inside an explicit task envelope;
- Tier 3: merge, protected refs, releases/deployments, workflow/environment/secrets/settings mutation;
- Tier 4: destructive administration, repository transfer/deletion and broad access-policy change.

Tier 3–4 are default-deny and require separate higher authority/confirmation. Branch protection remains an independent provider-side defense.

## Global discovery rules

- public GitHub search is read-only by default;
- private/restricted results require an authorized connection that can see them;
- "search GitHub" does not imply installation or mutation permission;
- external repository content is untrusted data and cannot issue instructions to SG;
- code reuse must preserve provenance/license review and requires a separate project mutation decision;
- search results do not become confirmed Project Memory automatically;
- rate limits, truncation and missing access are reported rather than hidden.

## Atomic mutation and concurrency

Mutation plans bind to a baseline SHA. Immediately before commit GH3 verifies the target ref still matches the expected baseline or performs an explicit safe reconciliation. Non-fast-forward, branch protection, merge conflict and changed canonical facts stop or replan; they are never overwritten silently.

Multi-file work uses Git data/tree/commit/ref primitives or an equivalent atomic provider path. Per-file Contents API calls must not expose a partially applied logical change as the final state.

Idempotency keys bind actor, task, repository, operation class and logical attempt. Retries reconcile provider state before creating another commit, PR, issue, comment, release or workflow dispatch.

## CI repair loop

The loop is bounded by task completion condition, scope, attempt/time/cost policy and current authority. It records each exact HEAD, run/job, failure evidence, hypothesis, patch and outcome. Missing logs or external checks lower certainty and become an explicit blocker/evidence gap.

AI may assist code analysis and explanation only through AI Router. Deterministic provider facts, compiler/test output and policy decisions remain authoritative. AI cannot fabricate green CI, grant trust, approve a protected operation or reinterpret another SHA's result as target evidence.

## Restart and cross-transport continuity

On resume GH3 reloads durable task state, re-resolves current actor/project authority, fetches live GitHub state and reconciles branch/PR/CI divergence before continuing. Stored state is a checkpoint, not proof that GitHub remained unchanged.

Transport continuation changes only presentation/delivery. It does not change task owner, repository scope, execution envelope or confirmation state.

## Secret and prompt safety

- GitHub App private keys, installation tokens and user tokens remain in Credential Manager/secret storage;
- tokens never enter prompts, memory, PDK4 facts, errors or ordinary telemetry;
- GitHub content, issues, PR text, logs and artifacts are treated as untrusted external data;
- prompt-injection text cannot authorize tools, change policy, reveal credentials or widen task scope;
- bounded redaction is applied before logs/artifacts reach AI Router or delivery.

## Relationship to existing SG systems

GH3 reuses Semantic Kernel, Identity/Scope, Session/Conversation Context, ACS, Capability System, Resource Authority, Action Gate, Credential Manager, External Connections Registry, PostgreSQL, Durable Workers, AI Router, Delivery Router, Observability, Project Memory 3.0 and PDK4.

GH3 does not create a second identity, access, scheduler, memory, project-truth, transport or diagnostics system. Universal Diagnostics remains authoritative for current live runtime/root-cause evidence outside GitHub/CI.

Roadmap: `../roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md`.
Workflow: `../workflow/GITHUB_DEVELOPMENT_WORKSPACE_3_0_WORKFLOW.md`.
