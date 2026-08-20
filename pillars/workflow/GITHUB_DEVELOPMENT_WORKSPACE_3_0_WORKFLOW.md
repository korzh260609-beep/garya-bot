# SG 2.1 — GITHUB DEVELOPMENT WORKSPACE 3.0 WORKFLOW

## Status
**PLANNED / NOT IMPLEMENTED.**

No GH3 stage is CLOSED from documentation alone.

## Global implementation rule

For every GH3 stage:

```text
verify dev/sg2.1-semantic exact HEAD and exact-head SG 2.1 CI
→ inspect code, tests and all affected canonical docs
→ preserve agreed product intent and existing SG boundaries
→ implement one bounded stage
→ add deterministic, security and restart/idempotency tests
→ run local checks
→ obtain exact-head CI evidence
→ perform live acceptance where required
→ synchronize roadmap/architecture/workflow/current status
```

`main` is not used as SG 2.1 implementation truth. SG 2.0 may be inspected only as historical evidence/pattern input and cannot silently override SG 2.1 architecture.

## Stage workflow

### GH3.1 — Domain Contract & Capability Registry
Define contracts and scoped capability names. Prove transport neutrality, explicit repository/ref/revision identity, bounded completion conditions and default-deny protected operations.

### GH3.2 — GitHub App Authentication & Connection Binding
Implement short-lived installation authentication through Credential Manager/Connections Registry. Test token caching/expiry, repository selection, permission discovery, rotation/failure and secret redaction.

### GH3.3 — Global Public GitHub Discovery
Implement bounded global public search and authorized private discovery. Test pagination, rate limits, no-result/partial-result qualification, provenance/currentness, license visibility, injection-resistant result handling and no mutation.

### GH3.4 — Repository Read & Analysis
Implement exact-revision reads for repository/code/history/PR/review/issue/CI facts. Test moving-branch versus immutable-SHA behavior, missing permission, deleted refs, large/truncated data and cross-repository isolation.

### GH3.5 — Branch, File & Atomic Commit Operations
Implement branch/ref validation and atomic multi-file commits. Test create/edit/move/delete, stale HEAD, non-fast-forward, protected branch, unrelated work preservation, idempotent retry and rollback evidence.

### GH3.6 — Collaboration Operations
Implement PR/review/issue/tag/release services. Test canonical base/head resolution, duplicate prevention, ambiguous retry, authorization tiers and separate approval for protected/destructive operations.

### GH3.7 — Actions/Checks & CI Repair Loop
Implement workflow dispatch and exact-head run/job/step/log/artifact inspection. Test failure localization, external/missing checks, bounded repair attempts, another-SHA rejection, rerun idempotency and completion-condition enforcement.

### GH3.8 — Transport-Neutral Orchestrator
Wire one internal GH3 service into transport-independent semantic intent/capability handling. Telegram, Discord, Web/API and native UI adapters may format input/output only. Prove equivalent task creation/status/resume behavior through at least two transports.

### GH3.9 — Durable Task State & Restart Continuity
Persist/reload/reconcile task state. Test process restart during plan, after commit, while CI runs, after failed CI and before delivery; prove no duplicate commit/PR/comment/workflow dispatch.

### GH3.10 — PM3/PDK4 Integration
Route verified source events through existing PDK4/PM3 contracts. Test provenance, idempotency, temporal updates, conflict visibility, no raw-secret storage and no false promotion from implemented/CI to deployed/live.

### GH3.11 — Security, Audit & Emergency Controls
Test ACS/Resource Authority/Action Gate/Credential Manager composition, actor/repository/branch/path isolation, public versus private access, prompt-injection resistance, cost/rate bounds, audit/redaction and emergency read/write disable controls.

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

## Closure evidence

Each stage records:

- exact starting and resulting HEAD;
- changed code/tests/docs;
- local commands and results;
- exact-head CI run/job evidence;
- live evidence when required;
- remaining limitations/blockers;
- synchronized lifecycle status.

GH3 closes only after all twelve stages satisfy their gates. Partial implementation must remain explicitly qualified and cannot be described as full GitHub development capability.

Roadmap: `../roadmap/GITHUB_DEVELOPMENT_WORKSPACE_3_0_PROGRAM.md`.
Architecture: `../architecture/GITHUB_DEVELOPMENT_WORKSPACE_3_0.md`.
