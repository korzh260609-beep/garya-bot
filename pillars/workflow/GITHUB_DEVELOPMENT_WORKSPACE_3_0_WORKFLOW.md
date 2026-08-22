# SG 2.1 — GITHUB DEVELOPMENT WORKSPACE 3.0 WORKFLOW

## Status
**IMPLEMENTATION COMPLETE THROUGH GH3.12. GH3.1–GH3.11 CLOSED / CI-VERIFIED; GH3.12 IMPLEMENTED / CI-VERIFIED / LIVE ACCEPTANCE PENDING. GDE1–GDE6 PLANNED / NOT IMPLEMENTED.**

No GH3 or GDE stage is CLOSED from documentation alone.

## Global implementation rule

For every GH3/GDE stage:

```text
verify dev/sg2.1-semantic exact HEAD and exact-head SG 2.1 CI
→ inspect code, tests and all affected canonical docs
→ preserve agreed product intent and existing SG boundaries
→ implement one bounded stage
→ add deterministic, security and restart/idempotency tests where applicable
→ run local checks
→ obtain exact-head CI evidence
→ perform live acceptance where required
→ synchronize roadmap/architecture/workflow/current status
```

`main` is not used as SG 2.1 implementation truth. SG 2.0 may be inspected only as historical evidence/pattern input and cannot silently override SG 2.1 architecture.

## GH3 stage workflow

### GH3.1 — Domain Contract & Capability Registry
Define contracts and scoped capability names. Prove transport neutrality, explicit repository/ref/revision identity, bounded completion conditions and default-deny protected operations.

Implemented in code and deterministic tests. Closed on exact HEAD `243bb8835f65ba51cb9bd1e31ce599f4a5d25d5c` by SG 2.1 CI #8553 `SUCCESS`.

### GH3.2 — GitHub App Authentication & Connection Binding
Implement short-lived installation authentication through Credential Manager/Connections Registry. Test token caching/expiry, repository selection, permission discovery, rotation/failure and secret redaction.

Implemented with deterministic tests for connection-first denial, private-key isolation, JWT installation-token exchange, expiry-aware cache, rotation invalidation, repository selection, provider permissions, health and secret-safe results. Closed on exact HEAD `310aaf6b25ead13d3cb9ee32e0cf836b682aef30` by SG 2.1 CI #8555 `SUCCESS`.

### GH3.3 — Global Public GitHub Discovery
Implement bounded global public search and authorized private discovery. Test pagination, rate limits, no-result/partial-result qualification, provenance/currentness, license visibility, injection-resistant result handling and no mutation.

Implemented with deterministic coverage for public/private separation, pagination/result bounds, rate limits, incomplete results, release repository scope, documentation/license qualification, provenance/currentness and secret-safe authorized discovery. Closed on exact HEAD `74c4ade02eed94ca7be809c46a1e485ecf6f8a30` by SG 2.1 CI #8559 `SUCCESS`.

### GH3.4 — Repository Read & Analysis
Implement exact-revision reads for repository/code/history/PR/review/issue/CI facts. Test moving-branch versus immutable-SHA behavior, missing permission, deleted refs, large/truncated data and cross-repository isolation.

Implemented with deterministic coverage for moving-ref resolution, immutable-SHA mismatch, GitHub App authorization, permission/ref failures, repository isolation, bounded trees/files, diffs, reviews, checks, workflow jobs and artifact metadata. Closed on exact implementation HEAD `652d79d159fce06ef94dc960b7a58278a99dbdb8` by SG 2.1 CI #8563 `SUCCESS`.

### GH3.5 — Branch, File & Atomic Commit Operations
Implement branch/ref validation and atomic multi-file commits. Test create/edit/move/delete, stale HEAD, non-fast-forward, protected branch, unrelated work preservation, idempotent retry and rollback evidence.

Implemented with deterministic coverage for exact-baseline branch create/reuse, atomic create/update/move/delete, expected-blob conflicts, stale HEAD, non-fast-forward denial, unrelated tree preservation, idempotent retry and rollback evidence. Closed on exact implementation HEAD `4a6c0d6194557b37cd7b9e0cdaad666168f5fc42` by SG 2.1 CI #8567 `SUCCESS`.

### GH3.6 — Collaboration Operations
Implement PR/review/issue/tag/release services. Test canonical base/head resolution, duplicate prevention, ambiguous retry, authorization tiers and separate approval for protected/destructive operations.

Implemented with deterministic coverage for canonical PR base/head identity, duplicate and ambiguous retry handling, bounded review reads, idempotent replies, approved review-thread resolution, issue labels/milestones, exact tag targets, release identity and separate release approval. Closed on exact implementation HEAD `d20fa069d6004c9d433c0a14d930fd57432bfaef` by SG 2.1 CI #8571 `SUCCESS`.

### GH3.7 — Actions/Checks & CI Repair Loop
Implement workflow dispatch and exact-head run/job/step/log/artifact inspection. Test failure localization, external/missing checks, bounded repair attempts, another-SHA rejection, rerun idempotency and completion-condition enforcement.

Implemented with deterministic coverage for exact-head run/job inspection, stale-ref dispatch denial, dispatch deduplication, bounded rerun attempts, another-SHA rejection, first actionable job/step localization and bounded redacted logs. Closed on exact implementation HEAD `9db540f14a79a2016c7a4916b4c3303d8a609bd3` by SG 2.1 CI #8575 `SUCCESS`.

### GH3.8 — Transport-Neutral Orchestrator
Wire one internal GH3 service into transport-independent semantic intent/capability handling. Telegram, Discord, Web/API and native UI adapters may format input/output only. Prove equivalent task creation/status/resume behavior through at least two transports.

Implemented with deterministic coverage for structured semantic routing, actor/project ownership, idempotent creation, status/resume behavior and equivalent Telegram/Web API results through one internal service. Durable persistence/restart reconciliation remains GH3.9 scope. Closed on exact implementation HEAD `1005fe8cbc510c23ebb30fd4a326cf47d43e95a4` by SG 2.1 CI #8579 `SUCCESS` on Node.js 22.

### GH3.9 — Durable Task State & Restart Continuity
Persist/reload/reconcile task state. Test process restart during plan, after commit, while CI runs, after failed CI and before delivery; prove no duplicate commit/PR/comment/workflow dispatch.

Implemented with PostgreSQL task/checkpoint/version/idempotency state and deterministic restart coverage for authority recheck, live GitHub reconciliation, scope/repository divergence and suppression of completed external actions. Closed on exact implementation/fix HEAD `5c2d69d179d58f3d89d8708f914395405c1e8f5c` by SG 2.1 CI #8585 `SUCCESS` on Node.js 22.

### GH3.10 — PM3/PDK4 Integration
Route verified source events through existing PDK4/PM3 contracts. Test provenance, idempotency, temporal updates, conflict visibility, no raw-secret storage and no false promotion from implemented/CI to deployed/live.

Implemented with deterministic commit/PR/workflow normalization through the existing PDK4 event and PM3 project-fact candidate contracts. Coverage proves immutable provenance, stable source-event replay identity for existing PM3 idempotency, exact-head CI qualification, proposed/unconfirmed PM3 projection, cross-project rejection and fail-closed denial of self-confirmation or repository/CI-to-deployment/runtime promotion.

Closed on exact implementation HEAD `127b9435d19c845e00c74d88cc4a8b975968c7f0` by SG 2.1 CI #8589 `SUCCESS` on Node.js 22.

### GH3.11 — Security, Audit & Emergency Controls
Test ACS/Resource Authority/Action Gate/Credential Manager composition, actor/repository/branch/path isolation, public versus private access, prompt-injection resistance, cost/rate bounds, audit/redaction and emergency read/write disable controls.

Implemented with one current-state security preflight before credential use or provider execution. Deterministic coverage proves read-only/full emergency disable, mutation versus read authority, rate/ACS/authority/gate denial, Tier 3 separate confirmation, Tier 4 Owner Security, fail-closed audit availability and secret-safe audit evidence.

Closed on exact implementation HEAD `8c34eb87a3c3d5f55e85818ead2ae13e3387c668` by SG 2.1 CI #8591 `SUCCESS` on Node.js 22.

### GH3.12 — Live Cross-Transport Acceptance
Use an explicitly authorized GitHub test boundary to prove:

1. instructed global public discovery returns qualified evidence;
2. unauthorized private repository access fails closed;
3. an authorized development task begins through one transport;
4. SG verifies exact HEAD/CI/docs before mutation;
5. SG creates an atomic multi-file commit and PR on an authorized branch;
6. CI fails, SG obtains real logs, repairs the cause and reaches green exact-head CI;
7. SG/worker restart occurs mid-task and resume creates no duplicates;
8. the same task is continued/read through another authorized transport/native API surface;
9. protected merge/admin actions remain separately gated;
10. verified outcomes enter PDK4/PM3 with correct provenance and lifecycle qualification.

Implementation now provides `src/githubDevelopment/githubCrossTransportAcceptance.js` plus `tests/githubCrossTransportAcceptance.test.js`. The runner executes the canonical acceptance sequence through injected real-boundary operations; the validator fails closed on cross-SHA CI, missing private denial, same-transport continuation, duplicate external actions after restart, missing protected-operation gating, secret material and false PM3/deployed/live promotion. Deterministic coverage also proves the complete ordered scenario and exact actor/project/task continuity.

Implementation/CI evidence: exact implementation HEAD `11bca7313b84265f093e615121707165c55d07a5`, SG 2.1 CI #8593 `SUCCESS` on Node.js 22.

GH3.12 remains **NOT CLOSED** until a real authorized GitHub boundary plus two real SG transport/API surfaces provide the required live evidence. The deterministic acceptance runner is deliberately unable to self-assert that evidence.

---

## GDE implementation workflow

GDE is the runtime semantic-to-execution completion extension on top of the existing GH3 stack. Detailed product requirements are defined in `../roadmap/GITHUB_DEVELOPMENT_EXECUTION_COMPLETION.md`.

### GDE1 — Canonical GitHub Actions + Development Target Resolver

**CLOSED / CI-VERIFIED** at exact implementation HEAD `2eac3632e2f99398c41a65dd81a5a446d4b04d4a`, SG 2.1 CI #8747 `SUCCESS` (Run ID `32564308591`).

Implementation order:

```text
inspect current semantic contract and Canonical Semantic Model
→ define bounded canonical GitHub/development actions
→ extend semantic normalization without phrase/regex execution routing
→ implement deterministic Development Target Resolver
→ bind repository/branch/baseline/scope/completion condition
→ add semantic-equivalence and ambiguity tests
→ run check
→ exact-head CI
→ synchronize docs/status
```

Closure requires proof that requests such as `реализуй LA1`, `исправь этот баг` and `проверь CI` resolve into bounded canonical development actions and targets independent of transport.

### GDE2 — Existing Capability Binding + Runtime Self-Knowledge

**CLOSED / CI-VERIFIED** at exact implementation HEAD `4008554ad2015d8e499e07cba45364d29cb4bfac`, SG 2.1 CI #8751 `SUCCESS` (Run ID `32564921207`).

Implementation order:

```text
map canonical actions to existing GH3 capabilities
→ read current ACS / Resource Authority / Credential / provider permission / emergency state
→ compose with existing GitHub Security Control Plane
→ expose deterministic capability result to Self Knowledge / response composition
→ reject model-only capability claims
→ add false-no-access regression tests
→ run check
→ exact-head CI
```

Closure requires proof that SG reports actual deterministic blockers and never claims lack of GitHub access merely because no local `.git` workspace exists.

### GDE3 — Canonical-to-GH3 Execution Bridge + Change Set

**IMPLEMENTED / LOCAL TESTS VERIFIED / EXACT-HEAD CI PENDING.**

Implementation order:

```text
resolve canonical development action
→ construct bounded execution envelope
→ call existing GitHubDevelopmentOrchestrator
→ inspect through existing repository reader
→ construct bounded development plan/change set
→ re-check baseline HEAD
→ execute through existing GH3 mutation path
→ persist/reconcile through existing development task store
→ add idempotency/stale-head tests
→ run check
→ exact-head CI
```

Closure requires proof that `github.development.execute` reaches existing GH3 services without a parallel executor or duplicate task state.

### GDE4 — Validation + Commit + Push Lifecycle

Implementation order:

```text
apply authorized change set
→ run required deterministic validation
→ stop on validation failure
→ create exact change-set-bound commit
→ verify target branch and current HEAD
→ update authorized branch through existing atomic mutation path
→ verify resulting commit SHA/post-condition
→ add wrong-branch/validation/action-gate/retry tests
→ run full check
→ exact-head CI
```

Closure requires proof that successful implementation means a verified repository change, not only generated code or an attempted provider call.

### GDE5 — Exact-HEAD CI Completion + Failure Recovery Loop

Implementation order:

```text
resolve resulting exact HEAD
→ observe CI for same SHA
→ reject another-SHA evidence
→ localize first actionable failure
→ obtain bounded/redacted logs/evidence
→ repair within current task envelope
→ validate
→ create repair commit
→ verify new exact HEAD CI
→ reconcile restart/resume
→ enforce bounded attempts/time/cost
→ add recovery/cross-SHA/restart tests
→ exact-head CI
```

Closure requires proof that `всё зелёное` is emitted only from successful CI evidence for the exact resulting HEAD.

### GDE6 — Full GitHub Platform Operations + Audit + Regression + Canonical Sync

Implementation order:

```text
wire canonical actions to existing GH3 collaboration/branch/CI services
→ support issues/PR/reviews/branches/workflows through same authority path
→ connect durable development-context continuation
→ complete audit/provenance for all external operations
→ add positive natural-language regression suite
→ add security/negative regression suite
→ run full check
→ exact-head CI
→ perform live acceptance where required
→ synchronize architecture/roadmap/workflow/status
```

Closure requires proof that the same canonical execution model handles repository development and broader GitHub platform operations without transport-specific logic or parallel execution stacks.

## GDE mandatory regression set

Positive examples:

```text
найди LA1
реализуй LA1
исправь этот баг
добавь тест
обнови README
сделай commit
сделай commit и push
проверь CI
исправь упавший CI
продолжай следующий этап
```

Negative/security examples:

```text
no write to unauthorized repository
no silent switch to main/protected branch
no mutation without current authority
no execution after HEAD drift without reconciliation
no duplicate commit/PR/workflow action on retry
no false GitHub-access denial when deterministic capability is available
no success/green claim without post-condition evidence
no second semantic router
no second GitHub executor
no second authorization/gate/task/memory system
```

## Closure evidence

Each GH3/GDE stage records:

- exact starting and resulting HEAD;
- changed code/tests/docs;
- local commands and results;
- exact-head CI run/job evidence;
- live evidence when required;
- remaining limitations/blockers;
- synchronized lifecycle status.

GH3 closes only after all twelve GH3 stages satisfy their gates. GDE closes only after GDE1–GDE6 satisfy their own semantic-to-execution gates. Partial implementation must remain explicitly qualified and cannot be described as full natural-language GitHub development capability.

Roadmap: `../roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md`.
Execution completion extension: `../roadmap/GITHUB_DEVELOPMENT_EXECUTION_COMPLETION.md`.
Architecture: `../architecture/GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`.
