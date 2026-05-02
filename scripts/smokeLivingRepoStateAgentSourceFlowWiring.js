// scripts/smokeLivingRepoStateAgentSourceFlowWiring.js
// ============================================================================
// Smoke — Living RepoStateAgent Source Flow Wiring
//
// Verifies controlled runtime wiring:
// - chat orchestration passes livingSGPlan into sourceFlow;
// - sourceFlow may use RepoStateAgent only through fastReadOnly read-only path;
// - sourceFlow adapts RepoStateAgent result through Living providerResult and
//   sourceResultEnvelope adapters;
// - write/executor/Technical Mode paths remain absent.
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceFlow = readFileSync("src/bot/handlers/chat/sourceFlow.js", "utf8");
const chatAiOrchestrationFlow = readFileSync(
  "src/bot/handlers/chat/chatAiOrchestrationFlow.js",
  "utf8"
);

assert.ok(
  chatAiOrchestrationFlow.includes("resolveChatSourceFlow({\n    effective,\n    livingSGPlan,"),
  "chat AI orchestration must pass livingSGPlan into sourceFlow"
);

assert.ok(
  sourceFlow.includes("import { RepoStateAgentService }"),
  "sourceFlow must import RepoStateAgentService for controlled fastReadOnly source path"
);
assert.ok(
  sourceFlow.includes("adaptRepoStateAgentResultToLivingProviderResult"),
  "sourceFlow must adapt RepoStateAgent result to Living providerResult"
);
assert.ok(
  sourceFlow.includes("adaptLivingRepoSourceProviderResult"),
  "sourceFlow must adapt providerResult to sourceResultEnvelope"
);
assert.ok(
  sourceFlow.includes("fastReadOnly: true"),
  "RepoStateAgent must be called only in fastReadOnly mode"
);
assert.ok(
  sourceFlow.includes("requireFreshProjectMap: true"),
  "RepoStateAgent source path must require fresh project map"
);
assert.ok(
  sourceFlow.includes("repoFullName: \"korzh260609-beep/garya-bot\""),
  "RepoStateAgent source path must target the controlled project repo"
);
assert.ok(
  sourceFlow.includes("branch: \"main\""),
  "RepoStateAgent source path must target main branch for freshness check"
);
assert.ok(
  sourceFlow.includes("canChangeState === false"),
  "RepoStateAgent source path must require read-only Living gate"
);
assert.ok(
  sourceFlow.includes("livingSGPlan?.intentPlan?.intentKind === \"project_thinking\""),
  "RepoStateAgent source path must require project_thinking intent"
);
assert.ok(
  sourceFlow.includes("repo_state_agent_source_result_envelope"),
  "sourceFlow must expose RepoStateAgent source result evidence mode"
);

assert.ok(
  !sourceFlow.includes("canAuthorizeWrite: true"),
  "sourceFlow must not authorize repo writes"
);
assert.ok(
  !sourceFlow.includes("canExecute: true"),
  "sourceFlow must not create executable repo provider result"
);
assert.ok(
  !sourceFlow.includes("allowRealAi: true"),
  "sourceFlow must not enable real AI analysis"
);
assert.ok(
  !sourceFlow.includes("forceAiAnalysis: true"),
  "sourceFlow must not force AI analysis"
);
assert.ok(
  !sourceFlow.includes("runScan("),
  "sourceFlow must not call repo scan directly"
);
assert.ok(
  !sourceFlow.includes("/" + "command"),
  "sourceFlow must not add command/slash routing"
);

console.log("Smoke Living RepoStateAgent source flow wiring — OK");
