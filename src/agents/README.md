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
- shared code may be added later only when it is genuinely shared by at least two agents;
- new agent logic must start as a skeleton before config and runtime logic are added.

Current SG 2.0 agent folders:
- `render-agent/` — Render logs, deploys, status, and env readiness diagnostics documentation for the current Render logs bridge;
- `render-env-agent/` — simple Render env inventory collector; writes one sanitized latest JSON report;
- `github-actions-agent/` — GitHub Actions runs, jobs, steps, artifacts, and PR/check status skeleton.

Current SG 2.0 status:
- Render logs collection is the existing working agent-related flow;
- Render env inventory collection is added as a simple agent under `src/agents/render-env-agent/`;
- Render env inventory writes to `runtime/render/latest/latest-render-env.json`;
- Render env inventory must show env names and safe allowlisted values only; secret or unknown values stay hidden;
- the working Render logs flow still runs through `src/tools/`, `src/tasks/`, `src/integrations/`, and `src/runtime/` and must not be moved during cleanup;
- GitHubActionsAgent skeleton is intentionally preserved;
- inactive runtime/repo/shared skeletons were removed during cleanup.
