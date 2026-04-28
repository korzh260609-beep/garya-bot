# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-ai-dry-run-after-real-ai-rollback-33`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T08:50:53.211Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test command

```text
RUN_REPO_STATE_AGENT
```

## Result

- `REPO_STATE_AGENT_OK`

## Technical map

```text
ok: yes
persisted: yes
repo: korzh260609-beep/garya-bot
branch: main
files: 966
modules: 67
dependencies: 790
projectMap: yes
projectMapModules: 67
projectMapLinks: 72
scanRunId: 25
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: no
aiReused: no
aiReason: project_map_unchanged
shouldAnalyze: no
aiForceAnalysis: yes
originalShouldAnalyze: no
promptChars: 21333
signatureLength: 24390
hasAnalysis: yes
```

## Raw compact

```json
{
  "ok": true,
  "persisted": true,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 966,
  "modulesCount": 67,
  "dependenciesCount": 790,
  "scanRunId": 25,
  "aiAnalysis": {
    "enabled": true,
    "skipped": false,
    "promptChars": 21333,
    "analysis": {
      "moduleDescriptions": [
        {
          "module": "index.js",
          "description": "Main application bootstrap that wires HTTP server, bot/core startup, AI/project memory, and jobs."
        },
        {
          "module": "src/bot",
          "description": "Largest transport layer for Telegram-style command/message routing, dispatchers, handlers, policies, diagnostics, and guard/rate-limit logic."
        },
        {
          "module": "src/core",
          "description": "Core behavior and memory domain containing recall, memory classification, diagnostics, and related orchestration services."
        },
        {
          "module": "src/decision",
          "description": "Decision subsystem with its own entrypoint, likely used for intent/decision flows outside raw transport handling."
        },
        {
          "module": "src/agentWorkspace",
          "description": "Agent workspace automation for command parsing/execution, diagnostics, reports, GitHub/repo-state actions, and Render control."
        },
        {
          "module": "src/repoStateCollector",
          "description": "Repository scanning and project-map collection utilities: tree reading, module/dependency scanning, GitHub access, and persistence."
        },
        {
          "module": "src/simpleAgents",
          "description": "Small agent framework focused on repo-state analysis, change detection, webhook handling, map building, and state storage."
        },
        {
          "module": "src/http",
          "description": "HTTP server and debug/webhook routes, including repo-state agent and render log ingest endpoints."
        },
        {
          "module": "src/integrations/render",
          "description": "Render integration bridge with config, normalization, and state store for external platform events."
        },
        {
          "module": "src/db + migrations",
          "description": "Database access layer and a substantial migration history covering memory, identities, tasks, webhooks, and repo-state analysis."
        },
        {
          "module": "pillars",
          "description": "Architecture/governance knowledge base documenting module contracts, risks, ownership, data flow, and behavior rules."
        },
        {
          "module": "root legacy helpers",
          "description": "Top-level ai.js, db.js, projectMemory.js, sources.js, and core/ wrappers suggest compatibility or legacy entry adapters around src modules."
        }
      ],
      "filePurposes": [
        {
          "file": "index.js",
          "purpose": "Primary runtime entrypoint."
        },
        {
          "file": "ai.js",
          "purpose": "AI access/config wrapper tied to modelConfig and core."
        },
        {
          "file": "db.js",
          "purpose": "Shared database bootstrap/adapter used by multiple areas."
        },
        {
          "file": "projectMemory.js",
          "purpose": "Root facade into project memory subsystem."
        },
        {
          "file": "src/http/server.js",
          "purpose": "Starts HTTP routes/server."
        },
        {
          "file": "src/http/repoStateAgentRoute.js",
          "purpose": "Exposes repo-state agent endpoint."
        },
        {
          "file": "src/agentWorkspace/AgentWorkspaceCommandRunner.js",
          "purpose": "Executes parsed workspace commands."
        },
        {
          "file": "src/agentWorkspace/AgentWorkspaceRepoStateActions.js",
          "purpose": "Connects workspace operations with repo-state workflows."
        },
        {
          "file": "src/repoStateCollector/RepoStateCollectorService.js",
          "purpose": "Coordinates repository state scanning/collection."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateAgentService.js",
          "purpose": "Main service for repo-state AI analysis flow."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js",
          "purpose": "Builds compact project map from collected repo state."
        },
        {
          "file": "src/bot/commandDispatcher.js",
          "purpose": "Routes incoming commands to dispatcher groups."
        },
        {
          "file": "src/bot/messageRouter.js",
          "purpose": "Routes general inbound messages."
        },
        {
          "file": "src/bot/dispatchers/*",
          "purpose": "Feature-specific command dispatch split by domain."
        },
        {
          "file": "src/core/MemoryService.js",
          "purpose": "Central memory operations/service layer."
        },
        {
          "file": "src/core/RecallEngine.js",
          "purpose": "Recall/retrieval logic for memory subsystem."
        },
        {
          "file": "src/integrations/render/RenderBridge.js",
          "purpose": "Receives/adapts Render platform events."
        },
        {
          "file": "migrations/*",
          "purpose": "Schema evolution for growing operational domains."
        }
      ],
      "architectureProblems": [
        {
          "problem": "Bot/transport module is oversized and highly central",
          "evidence": "342 transport files, including 234 handlers and many dispatchers; module links show src/bot depending on core, db, decision, services, projectMemory, integrations, jobs, http, media, agentWorkspace, etc.",
          "impact": "High coupling, harder onboarding/testing, risky changes."
        },
        {
          "problem": "Boundary leakage between layers and mixed naming",
          "evidence": "Entrypoint and module links reference src/transport, src/sources, src/users, src/vision, but loaded m…
```
