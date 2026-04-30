# AGENT_DIRECTORY_STRUCTURE.md — SG Agent Directory Structure

Purpose:
- Define the future canonical folder structure for SG agents.
- Make agents visible and understandable for the Monarch.
- Prevent mixing one agent inside another agent's folder.

Status: CANONICAL FUTURE RULE
Scope: future agent/module refactors and new agent creation

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/README.md`
- `pillars/architecture/CODE_OWNERSHIP_MAP.md`
- `pillars/architecture/MODULE_MAP.md`
- `pillars/architecture/SG_CAPABILITY_ACCESS.md`

---

## 1) Core rule

All SG agents must eventually be placed under one clear agents directory.

Preferred future structure:

```text
src/agents/
  repo-state-agent/
    README.md
    index.js
    ...agent files

  diagnostics-render-agent/
    README.md
    index.js
    ...agent files
```

Each agent must have its own folder.

One agent must not be hidden inside another agent's folder.

---

## 2) Current known agents

Current logical agents:

```text
RepoStateAgent
```

Current path:

```text
src/simpleAgents/repoStateAgent/
```

Purpose:
- repository/project map
- project state
- architecture health
- next action plan

---

```text
AgentWorkspace Diagnostic / Render Agent
```

Current paths:

```text
src/agentWorkspace/
agent_workspace/
```

Purpose:
- diagnostic command execution
- Render logs/deploys/services/status reports
- read-only diagnostic reports
- controlled workspace commands

---

## 3) Future target structure

Future target:

```text
src/agents/repo-state-agent/
src/agents/diagnostics-render-agent/
```

Optional shared support layer:

```text
src/agents/shared/
```

Rules:
- shared code must be genuinely shared
- shared code must not become a hidden third agent
- shared code must not own SG decisions or identity

---

## 4) Visibility rule for Monarch

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
src/agents/repo-state-agent/
src/agents/diagnostics-render-agent/
src/agents/shared/bridges/
```

---

## 5) Adapter / bridge rule

If one agent needs to call another agent, the integration must be clearly marked as a bridge/adapter.

Allowed:

```text
src/agents/shared/bridges/repoStateAgentBridge.js
```

or inside the caller:

```text
src/agents/diagnostics-render-agent/bridges/repoStateAgentBridge.js
```

Forbidden:

```text
diagnostics agent folder contains repo-state agent logic directly
repo-state agent folder contains diagnostics/render logic directly
```

---

## 6) No immediate runtime refactor by this file

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

## 7) SG entity rule

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

## 8) Final rule

Future agents must be easy to see, easy to understand, and separated by responsibility.

Every new SG agent must get its own folder under the canonical agents area.

No new agent should be placed inside another agent's folder.