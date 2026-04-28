# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-status-semantics-check-57`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T11:12:34.119Z`
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
files: 968
modules: 67
dependencies: 790
projectMap: yes
projectMapSchemaVersion: 3
projectMapModules: 67
projectMapLinks: 72
semanticMap: yes
semanticMapSchemaVersion: 1
semanticMapModules: 67
semanticMapBoundaryRules: 4
semanticMapRiskHints: 3
scanRunId: 35
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: yes
aiReused: yes
aiDryRun: no
tokensSpent: no
aiSource: reused_previous
aiReason: project_map_unchanged
shouldAnalyze: no
aiForceAnalysis: no
allowRealAi: no
realAiBlocked: no
blockReason: -
aiModel: -
aiUsedFallback: no
aiInputTokens: -
aiOutputTokens: -
aiTotalTokens: -
aiPricingConfigured: no
aiEstimatedCostUsd: -
originalShouldAnalyze: no
promptChars: -
signatureLength: 24390
hasAnalysis: yes
```

## Raw compact

```json
{
  "ok": true,
  "persisted": true,
  "resultStatus": "REPO_STATE_AGENT_OK",
  "blocked": false,
  "blockReason": null,
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 968,
  "modulesCount": 67,
  "dependenciesCount": 790,
  "scanRunId": 35,
  "projectMapSchemaVersion": 3,
  "semanticMap": {
    "schemaVersion": 1,
    "generatedBy": "deterministic_semantic_map_v1",
    "tokensSpent": false,
    "modulePurposes": 67,
    "boundaryRules": 4,
    "riskHints": 3
  },
  "aiUsage": {
    "model": null,
    "usedFallback": false,
    "inputTokens": null,
    "outputTokens": null,
    "totalTokens": null,
    "estimatedUsd": null,
    "pricingConfigured": false
  },
  "aiAnalysis": {
    "enabled": true,
    "skipped": true,
    "reused": true,
    "analysis": {
      "riskLevel": "high",
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
      "recommendations": [
        {
          "recommendation": "Define and enforce dependency direction: transport -> application/services -> core -> db/integrations; reduce direct src/bot links to infra modules."
        },
        {
          "recommendation": "Create feature slices or bounded contexts inside src/bot and collapse trivial handlers/routers where possible to reduce file explosion."
        },
        {
          "recommendation": "Move root-level runtime facades (ai.js, db.js, projectMemory.js, core/, sources.js) under src/ or document them as explicit public adapters."
        },
        {
          "recommendation": "Clarify ownership split between src/repoStateCollector and src/simpleAgents/repoStateAgent with a thin contract between collection and analysis."
        },
        {
          "recommendation": "Add automated architecture checks for moduleLinks against pillars/architecture docs to catch drift early."
        },
        {
          "recommendation": "Review whether debug/http routes should be isolated from production server startup to reduce accidental exposure and coupling."
        }
      ],
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
    …
```
