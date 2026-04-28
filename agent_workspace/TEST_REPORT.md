# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-check-36`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T09:10:58.316Z`
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
scanRunId: 26
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: no
aiReused: no
aiDryRun: no
tokensSpent: yes
aiSource: real_ai
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
  "scanRunId": 26,
  "aiAnalysis": {
    "enabled": true,
    "skipped": false,
    "promptChars": 21333,
    "analysis": {
      "moduleDescriptions": [
        {
          "module": "index.js",
          "description": "Main runtime entrypoint wiring bootstrap, bot/http/core initialization, AI, project memory and jobs."
        },
        {
          "module": "src/bot",
          "description": "Largest transport layer for Telegram/chat command handling, routing, dispatchers, handlers, permissions, rate limiting and diagnostics."
        },
        {
          "module": "src/core",
          "description": "Core domain logic centered on memory, recall, behavior, diagnostics and shared decision support services."
        },
        {
          "module": "src/agentWorkspace",
          "description": "Agent workspace subsystem for command execution, diagnostics, reporting, GitHub/repo actions and render control."
        },
        {
          "module": "src/decision",
          "description": "Decision-related module with its own entrypoint; likely encapsulates decision workflows separate from transport."
        },
        {
          "module": "src/http",
          "description": "HTTP server and webhook/debug routes, including repo-state and render-log endpoints."
        },
        {
          "module": "src/repoStateCollector",
          "description": "Collects repository structure/dependency/module maps via GitHub/tree scanning and repository persistence."
        },
        {
          "module": "src/simpleAgents",
          "description": "Simple agent implementations; includes repo-state agent, AI analyzer, change detector and webhook handler."
        },
        {
          "module": "src/integrations/render",
          "description": "Render-specific integration bridge, normalization, config and state storage."
        },
        {
          "module": "src/db",
          "description": "Database access/support layer used by bootstrap and bot-adjacent flows."
        },
        {
          "module": "migrations",
          "description": "Large migration history covering schema evolution for memory, tasks, identities, webhook dedupe and repo-state analysis."
        },
        {
          "module": "pillars",
          "description": "Project governance/architecture/contracts documentation acting as operational and coding rules source."
        }
      ],
      "filePurposes": [
        {
          "file": "index.js",
          "purpose": "Primary application startup/orchestration entrypoint."
        },
        {
          "file": "ai.js",
          "purpose": "AI access layer using model configuration and core services."
        },
        {
          "file": "db.js",
          "purpose": "Shared database bootstrap/access facade."
        },
        {
          "file": "projectMemory.js",
          "purpose": "Entry facade for project-memory features backed by DB and src/projectMemory."
        },
        {
          "file": "src/http/server.js",
          "purpose": "Starts HTTP server and mounts webhook/debug routes."
        },
        {
          "file": "src/http/repoStateAgentRoute.js",
          "purpose": "HTTP route exposing repo-state agent functionality."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateAgentAiAnalyzer.js",
          "purpose": "AI-based analyzer for repository project maps."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js",
          "purpose": "Builds condensed project map for repo-state analysis."
        },
        {
          "file": "src/repoStateCollector/RepoStateCollectorService.js",
          "purpose": "Coordinates repository state collection/scanning."
        },
        {
          "file": "src/bot/commandDispatcher.js",
          "purpose": "Central dispatcher for bot commands."
        },
        {
          "file": "src/bot/messageRouter.js",
          "purpose": "Routes incoming messages/intents to handlers."
        },
        {
          "file": "src/agentWorkspace/AgentWorkspaceCommandRunner.js",
          "purpose": "Executes parsed workspace commands with control flow/timeouts."
        },
        {
          "file": "src/agentWorkspace/AgentWorkspaceReportService.js",
          "purpose": "Builds or serves workspace diagnostic/report outputs."
        },
        {
          "file": "src/integrations/render/RenderBridge.js",
          "purpose": "Bridge for Render platform event/log integration."
        }
      ],
      "architectureProblems": [
        {
          "problem": "Transport layer dominates system size",
          "evidence": "src/bot has 342 files, including 234 handlers and 58 router files, suggesting very high fragmentation and orchestration complexity."
        },
        {
          "problem": "Weak layer boundaries around bot module",
          "evidence": "moduleLinks show src/bot depending directly on core, db, http, jobs, media, integrations, projectMemory, decision, logging, repo, agentWorkspace and external modules."
        },
        {
          "problem": "Mixed root-level and src-level architecture",
          "evidence": "Root files like ai.js, db.js, projectMemory.js, core/, sources.js coexist with src/* modules, increasing indirection and ambiguity."
        },
        {
          "problem": "Documentation-governed architecture may drift from code",
          "evidence": "Large pillars documentation set plus massive codebase size; no explicit evidence in project map of enforcement beyond diagnostics/self-tests."
        },
        {
          "problem": "Potential overlap between repo-state subsystems",
          "evidence": "Both src/repoStateCollector and src/simpleAgents/repoStateAgent handle repo-state concerns, risking duplicated …
```
