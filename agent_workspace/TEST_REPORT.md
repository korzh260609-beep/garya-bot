# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-real-ai-retry-after-signature-index-fix-31`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T08:31:30.818Z`
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
scanRunId: 24
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: no
aiReused: no
aiReason: project_map_changed
shouldAnalyze: yes
aiForceAnalysis: yes
originalShouldAnalyze: yes
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
  "scanRunId": 24,
  "aiAnalysis": {
    "enabled": true,
    "skipped": false,
    "promptChars": 21333,
    "analysis": {
      "moduleDescriptions": [
        {
          "module": "index.js",
          "description": "Main application bootstrap; wires startup into bot/http/core/jobs and legacy root helpers."
        },
        {
          "module": "src/bot",
          "description": "Largest transport layer for Telegram-style command/message routing, dispatchers, handlers, router logic, rate/permission guards, and diagnostics."
        },
        {
          "module": "src/core",
          "description": "Core business logic centered on memory, recall, behavior, diagnostics, and long-term context handling."
        },
        {
          "module": "src/decision",
          "description": "Decision-related subsystem with its own entrypoint; likely separates reasoning/decision workflows from transport."
        },
        {
          "module": "src/agentWorkspace",
          "description": "Agent workspace orchestration for commands, diagnostics, GitHub/render interactions, reporting, and repo-state actions."
        },
        {
          "module": "src/repoStateCollector",
          "description": "Collects repository tree/module/dependency state and persists project-map style data."
        },
        {
          "module": "src/simpleAgents",
          "description": "Contains lightweight agents, notably repo-state analysis/build/change-detection/webhook handling."
        },
        {
          "module": "src/http",
          "description": "HTTP server and debug/webhook routes, including repo-state and render-log ingestion endpoints."
        },
        {
          "module": "src/integrations/render",
          "description": "Render integration bridge, normalization, config, and state storage."
        },
        {
          "module": "src/db",
          "description": "Database access helpers/repositories beneath app services."
        },
        {
          "module": "migrations",
          "description": "Large migration history covering schema, memory, webhook dedupe, command invocations, repo-state, and identity evolution."
        },
        {
          "module": "pillars",
          "description": "Project governance/architecture/contracts documentation used as operating rules and module references."
        }
      ],
      "filePurposes": [
        {
          "file": "index.js",
          "purpose": "Primary runtime entrypoint."
        },
        {
          "file": "ai.js",
          "purpose": "AI integration facade tied to model config and core logic."
        },
        {
          "file": "db.js",
          "purpose": "Root database bootstrap/access module."
        },
        {
          "file": "projectMemory.js",
          "purpose": "Root adapter into project memory subsystem."
        },
        {
          "file": "src/http/server.js",
          "purpose": "Starts HTTP server and mounts routes."
        },
        {
          "file": "src/http/repoStateAgentRoute.js",
          "purpose": "HTTP route for repo-state agent requests."
        },
        {
          "file": "src/repoStateCollector/RepoStateCollectorService.js",
          "purpose": "Main service for collecting repository state/project map."
        },
        {
          "file": "src/repoStateCollector/RepoModuleScanner.js",
          "purpose": "Scans repository modules."
        },
        {
          "file": "src/repoStateCollector/RepoDependencyScanner.js",
          "purpose": "Scans repository dependencies/links."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateAgentAiAnalyzer.js",
          "purpose": "AI analyzer over collected project-map data."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateProjectMapBuilder.js",
          "purpose": "Builds normalized project-map for repo-state agent."
        },
        {
          "file": "src/simpleAgents/repoStateAgent/RepoStateAgentService.js",
          "purpose": "Coordinates repo-state analysis workflow."
        },
        {
          "file": "src/agentWorkspace/AgentWorkspaceCommandRunner.js",
          "purpose": "Executes parsed agent workspace commands."
        },
        {
          "file": "src/bot/commandDispatcher.js",
          "purpose": "Top-level command dispatch orchestration."
        },
        {
          "file": "src/bot/messageRouter.js",
          "purpose": "Routes incoming messages/intents to handlers."
        },
        {
          "file": "src/bot/dispatchers/dispatchProjectMemoryCommands.js",
          "purpose": "Project-memory-related command dispatch."
        }
      ],
      "architectureProblems": [
        {
          "problem": "Transport module is oversized",
          "evidence": "src/bot has 342 files, including 234 handlers and many dispatchers/routers.",
          "impact": "High change cost, hard ownership, risk of inconsistent command behavior."
        },
        {
          "problem": "Layer boundaries are blurred",
          "evidence": "module links show src/bot depending on core, db, jobs, http, integrations, projectMemory, services, agentWorkspace, and external modules directly.",
          "impact": "Tight coupling and difficult isolated testing/refactoring."
        },
        {
          "problem": "Mixed legacy/root-level and src-based architecture",
          "evidence": "root files like ai.js, db.js, projectMemory.js, core, sources.js coexist with src/* modules and are linked from index.js.",
          "impact": "Ambiguous dependency direction and duplicated bootstrap patterns."
        },
        {
          "problem": "Documentation-governed architecture may drift from code",
          "evidence": "pillars contains many critical governance/contract…
```
