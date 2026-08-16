# SG 2.1 Semantic

This branch is the active development and production source for SG 2.1.

- Repository: `korzh260609-beep/garya-bot`
- Working/deployment branch: `dev/sg2.1-semantic`
- `main` is not the SG 2.1 working branch.

## Current canonical status

**Canonical current-status index: `pillars/roadmap/CURRENT_STATUS.md`.**

Status statements in this README describe the current active branch. Historical checkpoints, `old/` and `archive/` documents remain historical evidence and must not override newer code/CI/live evidence. Large roadmap/program documents remain authoritative for requirements and acceptance contracts, but an old lifecycle label inside them does not override the current-status index plus stronger implementation/CI/live evidence.

Evidence priority for current-state claims:

`live runtime evidence → current HEAD/CI → production wiring + tests → current evidence/status docs → README/roadmap prose → historical/superseded docs`.

When sources conflict, SG must qualify the conflict instead of presenting stale documentation as current implementation truth.

### Core / numbered blocks

- Blocks 0–16.17 — implemented; their recorded acceptance state remains as documented in the corresponding roadmap/evidence files.
- **Block 16.18 — Monarch Control / Owner Security — IMPLEMENTED / WIRED / CI-VERIFIED; formal block closure is still pending explicit acceptance sign-off.**
  - canonical Monarch Global ID binding exists;
  - owner-only capability policy exists;
  - Owner Security is composed before the ordinary Action Gate;
  - fail-closed owner mismatch/unconfigured behavior, lockdown, rate limiting and audit exist;
  - this does not replace or weaken Identity, Scope, Resource Authority or Action Gate.
- **Block 17 — Render Deployment — production web runtime has live deployment evidence; formal closure remains dependent on the complete Block 17 acceptance checklist/evidence set.**
- Blocks 18–19 — completed / acceptance-verified according to their canonical roadmap/evidence.

### Cross-cutting programs

- Memory 2.0 M1–M9 — **CLOSED**.
- Project Memory 3.0 PM3.1–PM3.12 — **CLOSED**.
- Project Development Knowledge 4.0 PDK4.1–PDK4.12 — **CLOSED / CI-verified**.
- **PDK4.13 — LIVE ACCEPTANCE / NOT CLOSED.**
  - production GitHub repository read is implemented and credential-bound;
  - current branch HEAD, recursive tree, recent commits, changed files and bounded relevant file content are read with GET-only repository access;
  - production `repository-analyze` uses the live read service;
  - capability output is composed into a user-facing answer rather than exposed as a tool status;
  - repository evidence and final response-composition input are bounded to prevent `INPUT_TOO_LARGE`;
  - live Telegram acceptance has confirmed a substantive repository-derived answer;
  - PDK4.13 remains open until its full production acceptance/closure criteria are explicitly satisfied.
- Telegram Workspace Manager:
  - TWM1.1–TWM1.11 have implementation/evidence records in the repository;
  - TWM1.12 has advanced through real production/live acceptance and is not a future-only “NEXT” stage;
  - TWM1.13 Mini App is implemented and live-exercised for the confirmed management flows;
  - **TWM1.14 and TWM1.15 are implementation/live-acceptance work in progress and remain NOT CLOSED.**
  - lifecycle labels in the original large TWM program saying TWM1.12 is next or TWM1.13–1.15 are merely planned are superseded for current-state reporting; their detailed requirements/gates remain valid.
- SG Access Control System 1.0 — **PLANNED / NOT IMPLEMENTED** unless newer code/CI/live evidence explicitly supersedes that state.

## Requirements

- Node.js 22
- npm 10+

## Start / verification

```bash
npm ci
npm test
npm run check
npm start
npm run start:worker
```

Production AI remains reachable only through the SG AI Router and explicit production policy. Secrets must stay in the deployment credential/secret boundary and must not be committed or exposed through ordinary diagnostics or model context.

## Current production architecture

Canonical request path:

`Platform Input → Transport Adapter → Identity/Scope → Context/Settings/Language/Temporal layers → Semantic Kernel → Decision Engine → Resource Authority where required → Owner Security where owner-sensitive → Action Gate → Capability/Domain Runtime → Response composition → Delivery → Observability`.

Core invariants:

- AI is an execution/reasoning component; SG owns decisions and system identity.
- No production model provider is called directly outside AI Router.
- Identity/roles/grants/owner authority cannot be created from wording, usernames, display names or AI inference.
- Resource Authority and Action Gate remain mandatory where applicable.
- Owner Security only tightens privileged execution; it does not bypass existing gates.
- Repository analysis is read-only unless a separately authorized mutation capability is explicitly introduced and gated.
- Current-state claims must respect provenance/currentness; historical or superseded facts remain qualified.

## Active status documents

- `pillars/roadmap/CURRENT_STATUS.md` — canonical current-state index; read this before interpreting older lifecycle labels in large program documents.
- `pillars/roadmap/16_18_MONARCH_CONTROL_OWNER_SECURITY.md`
- `pillars/architecture/MONARCH_OWNER_SECURITY.md`
- `pillars/roadmap/17_RENDER_DEPLOYMENT.md`
- `pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_0_PROGRAM.md`
- `pillars/roadmap/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`
- `pillars/architecture/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING.md`
- `pillars/workflow/PROJECT_DEVELOPMENT_KNOWLEDGE_4_13_LIVE_PRODUCTION_WIRING_WORKFLOW.md`
- `pillars/roadmap/TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md` — requirements/history; current lifecycle labels are qualified by `CURRENT_STATUS.md` where they conflict.
- `pillars/roadmap/TELEGRAM_WORKSPACE_MANAGER_1_15_COMMUNITY_OPERATIONS_PROGRAM.md` — requirements; current implementation/live state is qualified by `CURRENT_STATUS.md` where the older header conflicts.
- `pillars/roadmap/SG_ACCESS_CONTROL_SYSTEM_1_0_PROGRAM.md`
- `docs/checkpoints/SG2.1_2026-08-15_1946.md` — immutable historical rollback/live checkpoint.
- `evidence/LIVE_RUNTIME_BASELINES.md`
- `evidence/PDK4_13_LIVE_CONTINUOUS_INGESTION_PROBE_2026-08-16.md`

Detailed architecture, decisions, module boundaries, security rules, acceptance criteria and historical evidence remain under `pillars/`, `evidence/` and `docs/checkpoints/`.
