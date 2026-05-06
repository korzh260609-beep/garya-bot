# SG Agents

SG agents are bounded instruments of the SG global project entity.

Rules:
- agents are not separate SG entities;
- each agent must have a clear responsibility boundary;
- each agent must live in its own direct folder under `src/agents/`;
- agent folders must stay simple and must not mix responsibilities;
- Render diagnostics, GitHub Actions diagnostics, repo intelligence, repo maintenance, and user/product agents must not be mixed;
- shared code belongs in `src/agents/shared/`, not inside a specific agent;
- new agent logic must start as a skeleton before config and runtime logic are added.

Current SG 2.0 agent folders:
- `render-agent/` — Render logs, deploys, status, and env readiness diagnostics;
- `github-actions-agent/` — GitHub Actions runs, jobs, steps, artifacts, and PR/check status;
- `shared/` — shared workspace/runtime helpers, not an agent;
- `runtime-diagnostics/` — legacy compatibility area during migration.

Current SG 2.0 status:
- Agent Layer skeleton started;
- RenderAgent has a top-level folder and temporarily wraps the older DiagnosticsRenderAgent implementation;
- GitHubActionsAgent skeleton has its own top-level folder;
- legacy runtime-diagnostics paths remain until a later cleanup PR.
