# TEST_REPORT

SG full repo state agent result after workspace command execution.

---

Task ID: `repo-state-agent-check-47`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-28T10:11:25.518Z`
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
files: 967
modules: 67
dependencies: 790
projectMap: yes
projectMapModules: 67
projectMapLinks: 72
scanRunId: 30
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
shouldAnalyze: no
aiForceAnalysis: yes
allowRealAi: no
realAiBlocked: yes
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
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 967,
  "modulesCount": 67,
  "dependenciesCount": 790,
  "scanRunId": 30,
  "aiAnalysis": {
    "enabled": true,
    "skipped": true,
    "reason": "repo_state_agent_real_ai_blocked_without_allow_real_ai",
    "forceAiAnalysis": true,
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
    "shouldAnalyze": false,
    "reason": "project_map_unchanged",
    "projectMapSignature": "{\"commandLikeFiles\":[{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/013_chat_messages_user_idempotency_index.js\"},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/031_command_invocations_table.js\"},{\"extension\":\".js\",\"layer\":\"database\",\"moduleKey\":\"migrations\",\"path\":\"migrations/047_fix_repo_state_ai_analysis_signature_index.js\"},{\"extension\":\".js\",\"layer\":\"entrypoint\",\"moduleKey\":\"index.js\",\"path\":\"index.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/roles.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/checks/structure.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/diagnostics.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"diagnostics\",\"path\":\"diagnostics/report.js\"},{\"extension\":\".js\",\"layer\":\"other\",\"moduleKey\":\"docs\",\"path\":\"docs/legacy/commands.legacy.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commandDispatcher.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/commands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/constants/privateOnlyCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicyCoverage.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/commandPolicySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/intentActionRouterSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentBoundarySelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/diagnostics/meaningIntentRouterIntegrationSelfTest.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchAgentWorkspaceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCapabilitiesCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchCryptoDevCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDecisionDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchIdentityCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchLegacyLocalCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMemoryDiagnosticsCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchMetaDebugCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchPriceCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProfileModeCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemoryConfirmedCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectMemorySessionCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchProjectRepoCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchRecallCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchRenderBridgeCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchSourcesCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchSystemInfoCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/dispatchers/dispatchTaskCommands.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"path\":\"src/bot/handlers/agentWorkspaceDiag.js\"},{\"extension\":\".js\",\"layer\":\"transport\",\"moduleKey\":\"src/bot\",\"pa…
```
