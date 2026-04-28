# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `run-project-semantic-map-001`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T18:31:38.517Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test command

```text
RUN_REPO_STATE_AGENT
```

## Result

- `REPO_STATE_AGENT_OK_DRY_RUN`

## Technical map

```text
ok: yes
persisted: yes
repo: korzh260609-beep/garya-bot
branch: main
files: 976
modules: 67
dependencies: 790
projectMap: yes
projectMapSchemaVersion: 6
projectMapModules: 67
projectMapLinks: 72
semanticMap: yes
semanticMapSchemaVersion: 5
semanticMapModules: 67
semanticMapTaskRoutingHints: 7
semanticMapTaskSafetyGates: 6
semanticMapRecommendedReadOrder: 19
semanticMapBoundaryRules: 4
semanticMapRiskHints: 3
nextActionPlan: yes
nextActionPlanSchemaVersion: 1
nextActionPlanImmediateChecks: 3
nextActionPlanSuggestedNextSteps: 4
nextActionPlanBlockedActions: 4
nextActionPlanRecommendedReadOrder: 19
architectureHealth: yes
architectureHealthSchemaVersion: 1
architectureHealthScore: 39
architectureHealthStatus: high_risk
architectureHealthFindings: 5
architectureHealthRecommendedFocus: 5
scanRunId: 45
error: -
```

## Semantic AI map

```text
aiEnabled: yes
aiSkipped: yes
aiReused: no
aiDryRun: yes
tokensSpent: no
aiSource: dry_run
aiReason: repo_state_agent_real_ai_blocked_without_allow_real_ai
shouldAnalyze: yes
aiForceAnalysis: no
allowRealAi: no
realAiBlocked: yes
blockReason: missing_allow_real_ai
aiModel: -
aiUsedFallback: no
aiInputTokens: -
aiOutputTokens: -
aiTotalTokens: -
aiPricingConfigured: no
aiEstimatedCostUsd: -
originalShouldAnalyze: yes
promptChars: -
signatureLength: 24970
hasAnalysis: yes
```

## Raw compact

```json
{
  "ok": true,
  "persisted": true,
  "resultStatus": "REPO_STATE_AGENT_OK_DRY_RUN",
  "blocked": true,
  "blockReason": "missing_allow_real_ai",
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 976,
  "modulesCount": 67,
  "dependenciesCount": 790,
  "scanRunId": 45,
  "projectMapSchemaVersion": 6,
  "semanticMap": {
    "schemaVersion": 5,
    "generatedBy": "deterministic_semantic_map_v5",
    "tokensSpent": false,
    "modulePurposes": 67,
    "taskRoutingHints": 7,
    "taskSafetyGates": 6,
    "recommendedReadOrder": 19,
    "boundaryRules": 4,
    "riskHints": 3
  },
  "nextActionPlan": {
    "schemaVersion": 1,
    "generatedBy": "deterministic_next_action_plan_v1",
    "tokensSpent": false,
    "immediateChecks": 3,
    "suggestedNextSteps": 4,
    "blockedActions": 4,
    "recommendedReadOrder": 19
  },
  "architectureHealth": {
    "schemaVersion": 1,
    "generatedBy": "deterministic_architecture_health_v1",
    "tokensSpent": false,
    "score": 39,
    "status": "high_risk",
    "findings": 5,
    "recommendedFocus": 5,
    "counters": {
      "findings": 5,
      "critical": 0,
      "high": 3,
      "medium": 2,
      "low": 0,
      "info": 0,
      "taskRoutingHints": 7,
      "taskSafetyGates": 6,
      "recommendedReadOrder": 19
    }
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
    "reason": "repo_state_agent_real_ai_blocked_without_allow_real_ai",
    "forceAiAnalysis": false,
    "allowRealAi": false,
    "analysis": {
      "dryRun": true,
      "safetyGate": true,
      "summary": "Real AI blocked by safety gate. No tokens were spent."
    },
    "aiDryRun": true,
    "tokensSpent": false,
    "aiSource": "dry_run"
  },
  "aiMeta": {
    "shouldAnalyze": true,
    "reason": "project_map_changed",
    "projectMapSignature": "{\"commandLikeFiles\":[{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/013_chat_messages_user_idempotency_index.js\"},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/031_command_invocations_table.js\"},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/047_fix_repo_state_ai_analysis_signature_index.js\"},{\"extension\":\".js\",\"layer\":\"diagnostics\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/roles.js\"},{\"extension\":\".js\",\"layer\":\"diagnostics\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/structure.js\"},{\"extension\":\".js\",\"layer\":\"diagnostics\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/diagnostics.js\"},{\"extension\":\".js\",\"layer\":\"diagnostics\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/report.js\"},{\"extension\":\".js\",\"layer\":\"docs\",\"moduleKey\":\"docs\",\"path\":\"docs/legacy/commands.legacy.js\"},{\"extension\":\".js\",\"layer\":\"entrypoint\",\"moduleKey\":\"index.js\",\"path\":\"index.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commandDispatcher.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/constants/privateOnlyCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicyCoverage.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/intentActionRouterSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentBoundarySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentRouterIntegrationSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchAgentWorkspaceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCapabilitiesCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCryptoDevCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchIdentityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchLegacyLocalCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMetaDebugCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchPriceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProfileModeCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispat…
```
