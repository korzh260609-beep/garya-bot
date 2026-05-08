# SG Agents

SG agents are bounded instruments of the SG global project entity.

Rules:
- agents are not separate SG entities;
- everything related to SG agents must live under `src/agents/`;
- each agent must have a clear responsibility boundary;
- each agent must live in its own direct folder under `src/agents/`;
- agent folders must stay simple and must not mix responsibilities;
- Render logs and Render env inventory must remain separated unless the Monarch explicitly merges them later;
- GitHub Actions diagnostics must not be mixed with Render logic;
- repo registry collection must stay read-only for repository contents and write only its latest workspace report;
- repo commit watcher stores only latest state and must not duplicate full GitHub commit history;
- shared code may be added later only when it is genuinely shared by at least two agents;
- new agent logic must start as a skeleton before config and runtime logic are added.

Current SG 2.0 agent folders:
- `render-agent/` — Render logs, deploys, status, and env readiness diagnostics documentation for the current Render logs bridge;
- `render-env-agent/` — simple Render env inventory collector; writes one sanitized latest JSON report;
- `repo-registry-agent/` — simple repository folder/file registry collector; writes one latest JSON report;
- `repo-commit-watcher-agent/` — simple commit watcher and intent-based commit search agent; triggers repo registry updates after new commits and reads GitHub history on demand;
- `github-actions-agent/` — GitHub Actions runs, jobs, steps, artifacts, and PR/check status skeleton.

Current SG 2.0 status:
- Render logs collection is the existing working agent-related flow;
- Render env inventory collection is added as a simple agent under `src/agents/render-env-agent/`;
- Render env inventory writes to `runtime/render/latest/latest-render-env.json`;
- Render env inventory shows env names and non-secret values; secret values stay hidden by exact name, suffix, or value pattern;
- repo registry collection is added as a simple agent under `src/agents/repo-registry-agent/`;
- repo registry collection writes to `runtime/repo/latest/latest-repo-registry.json`;
- repo commit watcher collection is added as a simple agent under `src/agents/repo-commit-watcher-agent/`;
- repo commit watcher writes only latest commit state to `runtime/repo/latest/latest-commit-state.json`;
- repo commit search reads GitHub history on demand and does not store full commit history in runtime;
- the working Render logs flow still runs through `src/tools/`, `src/tasks/`, `src/integrations/`, and `src/runtime/` and must not be moved during cleanup;
- GitHubActionsAgent skeleton is intentionally preserved;
- inactive runtime/repo/shared skeletons were removed during cleanup.
