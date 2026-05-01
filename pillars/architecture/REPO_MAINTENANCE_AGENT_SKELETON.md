# REPO_MAINTENANCE_AGENT_SKELETON.md — SG Repo Maintenance Agent

Purpose:
- Define the future RepoMaintenanceAgent skeleton.
- Separate repository maintenance/audit responsibility from RepoStateAgent.
- Prevent RepoStateAgent from becoming an oversized all-purpose project agent.
- Define the goal, meaning, boundaries, and safest implementation path.

Status: CANONICAL FUTURE SKELETON
Scope: future agent architecture and implementation planning

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/README.md`
- `pillars/architecture/AGENT_DIRECTORY_STRUCTURE.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/architecture/MODULE_MAP.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`
- `pillars/decisions/D-039_SG_GLOBAL_ENTITY_COMPONENT_ALIGNMENT.md`

---

## 1) Core idea

RepoMaintenanceAgent is a future SG agent responsible for repository consistency after changes.

It must not replace RepoStateAgent.

It must not become an autonomous code-changing bot.

Correct model:

```text
SG = global project entity
RepoStateAgent = observes current repository/project state
RepoMaintenanceAgent = checks consequences of changes and proposes required follow-up work
DiagnosticsRenderAgent = checks runtime/tests/logs/Render state
```

Incorrect model:

```text
RepoStateAgent = project map + maintenance + diagnostics + docs updater + code changer
RepoMaintenanceAgent = autonomous repo modifier
agent = separate SG identity
```

---

## 2) Why this agent is needed

RepoStateAgent is already growing in responsibility.

Current RepoStateAgent responsibilities include:

- repository scan
- project map building
- next action plan
- architecture health
- AI analysis gate
- project map persistence
- AI analysis persistence
- fast read-only project map reuse

This is useful, but it creates risk.

If more responsibilities are added to RepoStateAgent, it may become a large all-purpose agent and lose clear boundaries.

RepoMaintenanceAgent exists to prevent that.

---

## 3) Goal

The goal of RepoMaintenanceAgent:

```text
After repository changes, detect what else must be checked, synchronized, updated, tested, or snapshotted.
```

It should answer:

- Which pillars/docs may need updates?
- Which imports may be affected?
- Which tests/smoke-checks should run?
- Which module boundaries may be touched?
- Which architecture maps may be stale?
- Which snapshots/checkpoints are needed?
- Are there old references to moved/renamed files?
- Did a change violate known architecture rules?
- Did a change affect Human Mode / Technical Mode boundaries?
- Did a change affect RepoStateAgent factual-source policy?
- Did a change affect capability access or permissions?
- Did a change mix one agent into another agent?

---

## 4) Meaning for SG

RepoMaintenanceAgent is a repository consistency auditor and planner.

It helps SG keep the project coherent after changes.

It does not own SG architecture.
It does not own SG identity.
It does not decide project governance.
It does not automatically rewrite the repository.

Its value is early detection of missing follow-up work.

---

## 5) Future target path

Future group path:

```text
src/agents/repo-maintenance/
```

Preferred future agent path:

```text
src/agents/repo-maintenance/repo-maintenance-agent/
```

Recommended internal structure:

```text
src/agents/repo-maintenance/repo-maintenance-agent/
  README.md
  index.js
  RepoMaintenanceAgentService.js
  RepoMaintenanceChangeAnalyzer.js
  RepoMaintenanceImpactMapBuilder.js
  RepoMaintenanceDocsSyncPlanner.js
  RepoMaintenanceTestPlanner.js
  RepoMaintenanceSnapshotPlanner.js
  RepoMaintenanceReportBuilder.js
```

Optional shared bridges:

```text
src/agents/shared/bridges/repoStateAgentBridge.js
src/agents/shared/bridges/diagnosticsRenderAgentBridge.js
```

---

## 6) Separation from RepoStateAgent

RepoStateAgent should answer:

```text
What is currently in the repository/project?
```

RepoMaintenanceAgent should answer:

```text
Given a change, what must be checked or updated because of it?
```

RepoStateAgent produces facts/state.

RepoMaintenanceAgent consumes facts/state and produces maintenance recommendations.

RepoMaintenanceAgent may use RepoStateAgent output through a bridge/adapter.

It must not copy RepoStateAgent logic into its own folder.

---

## 7) Separation from DiagnosticsRenderAgent

DiagnosticsRenderAgent should answer:

```text
What is happening in runtime, tests, diagnostics, and Render logs?
```

RepoMaintenanceAgent should answer:

```text
Which tests/diagnostics should be requested after a repo change?
```

RepoMaintenanceAgent may request or recommend diagnostics.

It should not own RenderBridge, Render logs, deploy inspection, or runtime log parsing.

---

## 8) Operating modes

### V1 — read-only report

Allowed:
- inspect changed files / commit / diff metadata
- compare with architecture/module maps
- produce a maintenance report

Forbidden:
- modify files
- create commits
- change runtime
- update pillars automatically

Output:

```text
Repo Maintenance Report
- changed areas
- impacted modules
- docs likely affected
- tests/smoke-checks recommended
- risks
- snapshot recommendation
```

---

### V2 — report + checklist

Allowed:
- everything from V1
- produce a concrete checklist of follow-up actions

Output:

```text
Follow-up checklist
1. update file X
2. run smoke Y
3. check workflow Z
4. create snapshot if green
```

---

### V3 — draft diff plan

Allowed:
- produce proposed diff plan
- name exact files and sections to change

Forbidden:
- directly apply changes without Monarch approval

---

### V4 — prepare patch / PR draft

Allowed:
- prepare patch/diff/PR draft after explicit approval

Forbidden:
- merge PR
- deploy
- modify production automatically

---

### V5 — controlled apply after explicit Monarch command

Allowed only if explicitly approved later:
- apply selected low-risk maintenance edits

Still forbidden by default:
- autonomous repo-wide changes
- architecture changes without accepted decision
- runtime changes without gate
- changing SG identity/governance rules

---

## 9) Inputs

Possible future inputs:

- commit SHA
- changed files list
- diff summary
- PR number
- current RepoStateAgent project map
- current architecture maps
- active workflow files
- module docs
- CI status
- latest DiagnosticsRenderAgent summary

---

## 10) Outputs

Required future output shape:

```text
repoMaintenanceReport = {
  changedFiles,
  impactedModules,
  impactedPillars,
  requiredDocsUpdates,
  recommendedTests,
  recommendedDiagnostics,
  riskLevel,
  riskReasons,
  snapshotNeeded,
  blockingIssues,
  suggestedNextActions
}
```

Human-readable output should be simple:

```text
Что изменилось
Что может сломаться
Что нужно проверить
Что нужно обновить
Можно ли делать snapshot
```

---

## 11) Hard boundaries

RepoMaintenanceAgent must NOT:

- become RepoStateAgent
- become DiagnosticsRenderAgent
- become SG itself
- own SG decisions/governance
- auto-edit code by default
- auto-edit pillars by default
- create hidden runtime behavior
- connect Human Mode runtime
- build Global SemanticRouter
- bypass permission gates
- bypass CODE_OUTPUT rules
- use old RepoIndex as current factual repo truth
- hide one agent inside another agent folder

---

## 12) Best implementation path

Implementation must follow:

```text
skeleton -> config -> logic
```

Recommended steps:

1. Create folder skeleton under `src/agents/repo-maintenance/repo-maintenance-agent/`.
2. Add README and service stub.
3. Add config with feature flag.
4. Add read-only report builder.
5. Add bridge to RepoStateAgent output.
6. Add changed-files analyzer.
7. Add docs-impact planner.
8. Add tests/smoke-check planner.
9. Add snapshot recommendation planner.
10. Add smoke test.
11. Only later add PR/diff generation behind explicit gate.

---

## 13) Feature flags

Future config should include:

```text
REPO_MAINTENANCE_AGENT_ENABLED=false
REPO_MAINTENANCE_AGENT_MODE=report_only
REPO_MAINTENANCE_AGENT_ALLOW_DIFF=false
REPO_MAINTENANCE_AGENT_ALLOW_WRITE=false
```

Default must be safe:

```text
enabled=false
mode=report_only
writes=false
```

---

## 14) Relationship to agents directory structure

Future canonical agent layout:

```text
src/agents/
  repo-intelligence/
    repo-state-agent/
  repo-maintenance/
    repo-maintenance-agent/
  runtime-diagnostics/
    diagnostics-render-agent/
  user-product/
  shared/
    bridges/
```

RepoMaintenanceAgent must get its own folder.
It must not be placed inside RepoStateAgent or AgentWorkspace.

---

## 15) Final rule

RepoMaintenanceAgent exists to keep repository evolution coherent.

It should reduce chaos after changes.

It should not create a new source of uncontrolled changes.

Start as read-only auditor.

Grow only through explicit gates.