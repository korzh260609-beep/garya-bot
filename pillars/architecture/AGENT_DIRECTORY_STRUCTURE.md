# AGENT_DIRECTORY_STRUCTURE.md — SG Agent Directory Structure

Purpose:
- Define the future canonical folder structure for SG agents.
- Make agents visible and understandable for the Monarch.
- Prevent mixing one agent inside another agent's folder.
- Group agents by meaning/responsibility so the repository tree stays readable.

Status: CANONICAL FUTURE RULE
Scope: future agent/module refactors and new agent creation

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/README.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/architecture/MODULE_MAP.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`
- `pillars/architecture/REPO_MAINTENANCE_AGENT_SKELETON.md`

---

## 1) Core rule

All SG agents must eventually be placed under one clear agents directory.

Preferred future structure:

```text
src/agents/
  repo-intelligence/
    repo-state-agent/

  repo-maintenance/
    repo-maintenance-agent/

  runtime-diagnostics/
    diagnostics-render-agent/

  user-product/
    future-agents/

  shared/
    bridges/
```

Each agent must have its own folder.

One agent must not be hidden inside another agent's folder.

Agents must be grouped by meaning/responsibility, not by historical accident.

---

## 2) SG-level model

SG is the global project entity and orchestrator.

Agents are bounded SG components/instruments.

Correct model:

```text
SG
├─ Repo Intelligence Agents
├─ Repo Maintenance Agents
├─ Runtime / Diagnostics Agents
├─ User / Product Agents
└─ Shared Bridges
```

Incorrect model:

```text
agent inside agent inside agent
RepoStateAgent contains all project agents
Diagnostics agent contains repo-state logic directly
agent = separate SG
```

---

## 3) Agent groups by meaning

### 3.1 Repo Intelligence Agents

Meaning:

```text
Understand what currently exists in the repository/project.
```

Future group path:

```text
src/agents/repo-intelligence/
```

Current known agent:

```text
RepoStateAgent
```

Current path:

```text
src/simpleAgents/repoStateAgent/
```

Future target path:

```text
src/agents/repo-intelligence/repo-state-agent/
```

Purpose:
- repository/project map
- project state
- architecture health
- next action plan
- factual repo/project state

Boundary:
- must not become maintenance agent
- must not become diagnostics/render agent
- must not become all-purpose project agent

---

### 3.2 Repo Maintenance Agents

Meaning:

```text
After repository changes, detect what else must be checked, synchronized, updated or snapshotted.
```

Future group path:

```text
src/agents/repo-maintenance/
```

Future known agent:

```text
RepoMaintenanceAgent
```

Future target path:

```text
src/agents/repo-maintenance/repo-maintenance-agent/
```

Purpose:
- changed files analysis
- impacted module detection
- docs/pillars synchronization planning
- import/checklist planning
- smoke-test planning
- snapshot recommendation
- architecture consistency checks
- stale reference detection

Boundary:
- starts as read-only auditor/planner
- must not auto-change code by default
- must not auto-change pillars by default
- must not replace RepoStateAgent
- must not own runtime diagnostics

---

### 3.3 Runtime / Diagnostics Agents

Meaning:

```text
Check what is happening in runtime, tests, deploys and Render logs.
```

Future group path:

```text
src/agents/runtime-diagnostics/
```

Current known logical agent:

```text
AgentWorkspace Diagnostic / Render Agent
```

Current paths:

```text
src/agentWorkspace/
agent_workspace/
```

Future target path:

```text
src/agents/runtime-diagnostics/diagnostics-render-agent/
```

Purpose:
- diagnostic command execution
- Render logs/deploys/services/status reports
- runtime health visibility
- read-only diagnostic reports
- controlled workspace commands

Boundary:
- must not contain RepoStateAgent logic directly
- must not become repo maintenance agent
- must not own project architecture decisions

---

### 3.4 User / Product Agents

Meaning:

```text
Future agents for user-facing product tasks and domain workflows.
```

Future group path:

```text
src/agents/user-product/
```

Possible future agents:

```text
document-agent
news-agent
business-agent
crypto-agent
file-intake-agent
task-planning-agent
```

Boundary:
- not current priority
- must not be mixed with repo/project infrastructure agents
- must follow capability access and user permissions

---

### 3.5 Shared Bridges

Meaning:

```text
Explicit adapters between agents so agents do not live inside each other.
```

Future path:

```text
src/agents/shared/bridges/
```

Examples:

```text
repoStateAgentBridge.js
diagnosticsRenderAgentBridge.js
repoMaintenanceAgentBridge.js
```

Rules:
- shared code must be genuinely shared
- shared code must not become a hidden third agent
- shared code must not own SG decisions or identity
- agent-to-agent calls must go through clear bridges/adapters when boundaries matter

---

## 4) Current known agents

### RepoStateAgent

Current path:

```text
src/simpleAgents/repoStateAgent/
```

Future group:

```text
repo-intelligence
```

Future target:

```text
src/agents/repo-intelligence/repo-state-agent/
```

Role:

```text
RepoStateAgent = what exists in the project/repository now.
```

---

### AgentWorkspace Diagnostic / Render Agent

Current paths:

```text
src/agentWorkspace/
agent_workspace/
```

Future group:

```text
runtime-diagnostics
```

Future target:

```text
src/agents/runtime-diagnostics/diagnostics-render-agent/
```

Role:

```text
DiagnosticsRenderAgent = what happens in runtime/Render/tests/logs.
```

---

### RepoMaintenanceAgent

Current path:

```text
not implemented yet
```

Future group:

```text
repo-maintenance
```

Future target:

```text
src/agents/repo-maintenance/repo-maintenance-agent/
```

Role:

```text
RepoMaintenanceAgent = what must be checked/updated after repository changes.
```

---

## 5) Visibility rule for Monarch

The folder structure must be understandable by looking at the repository tree.

Bad structure:

```text
src/agentWorkspace/
  ...diagnostics files
  AgentWorkspaceRepoStateActions.js
```

Reason:
- it makes RepoStateAgent look like part of AgentWorkspace
- it hides agent boundaries from the Monarch

Better structure:

```text
src/agents/repo-intelligence/repo-state-agent/
src/agents/repo-maintenance/repo-maintenance-agent/
src/agents/runtime-diagnostics/diagnostics-render-agent/
src/agents/shared/bridges/
```

---

## 6) Adapter / bridge rule

If one agent needs to call another agent, the integration must be clearly marked as a bridge/adapter.

Allowed:

```text
src/agents/shared/bridges/repoStateAgentBridge.js
```

or inside the caller:

```text
src/agents/runtime-diagnostics/diagnostics-render-agent/bridges/repoStateAgentBridge.js
```

Forbidden:

```text
diagnostics agent folder contains repo-state agent logic directly
repo-state agent folder contains diagnostics/render logic directly
repo-maintenance agent copies repo-state agent internals
```

---

## 7) No immediate runtime refactor by this file

This file does not authorize moving runtime files immediately.

Current paths may remain until a separate approved refactor block.

Future refactor must be done safely:

1. skeleton plan
2. file move plan
3. import map
4. compatibility wrappers if needed
5. smoke tests
6. CI green
7. snapshot

---

## 8) SG entity rule

Agents are components/instruments of SG.

Agents are not separate SG entities.

Correct model:

```text
SG = global project entity
agent = bounded component/instrument of SG
```

Incorrect model:

```text
agent = separate SG
agent folder = owner of SG identity/governance
```

---

## 9) Final rule

Future agents must be easy to see, easy to understand, and separated by responsibility.

Every new SG agent must get its own folder under the canonical agents area.

No new agent should be placed inside another agent's folder.

Canonical responsibility split:

```text
RepoStateAgent = sees current project/repository state.
RepoMaintenanceAgent = checks consequences of repository changes.
DiagnosticsRenderAgent = checks runtime/tests/Render/logs.
SG = orchestrator and global project entity.
```