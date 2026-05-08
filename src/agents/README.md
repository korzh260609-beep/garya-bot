# SG Agents

SG agents are bounded instruments of the SG global project entity.

Rules:
- agents are not separate SG entities;
- everything related to SG agents must live under `src/agents/`;
- each agent must have a clear responsibility boundary;
- each agent must live in its own direct folder under `src/agents/`;
- agent folders must stay simple and must not mix responsibilities;
- Render diagnostics, GitHub Actions diagnostics, repo intelligence, repo maintenance, and user/product agents must not be mixed;
- shared code belongs in `src/agents/shared/`, not inside a specific agent;
- new agent logic must start as a skeleton before config and runtime logic are added.

Current SG 2.0 agent folders:
- `render-agent/` — Render logs, deploys, status, and env readiness diagnostics documentation for the current Render logs bridge;
- `github-actions-agent/` — GitHub Actions runs, jobs, steps, artifacts, and PR/check status skeleton;
- `shared/` — shared workspace/runtime helpers, not an agent.

Current SG 2.0 status:
- Render logs collection is the currently working agent-related flow;
- the working Render logs flow still runs through `src/tools/`, `src/tasks/`, `src/integrations/`, and `src/runtime/` and must not be moved during cleanup;
- RenderAgent has a top-level documentation folder under `src/agents/render-agent/`;
- GitHubActionsAgent skeleton is intentionally preserved;
- inactive `runtime-diagnostics/` skeleton was removed during cleanup.
