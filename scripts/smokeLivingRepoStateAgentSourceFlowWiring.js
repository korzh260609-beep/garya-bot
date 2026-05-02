// scripts/smokeLivingRepoStateAgentSourceFlowWiring.js
// ============================================================================
// Smoke — Living RepoStateAgent Source Flow Wiring
//
// Verifies controlled runtime wiring after resolver extraction:
// - chat orchestration passes livingSGPlan into sourceFlow;
// - sourceFlow delegates RepoStateAgent work to dedicated resolver;
// - dedicated resolver may use RepoStateAgent only through fastReadOnly
//   read-only path;
// - resolver adapts RepoStateAgent result through Living providerResult and
//   sourceResultEnvelope adapters;
// - write/executor/Technical Mode paths remain absent.
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceFlow = readFileSync("src/bot/handlers/chat/sourceFlow.js", "utf8");
const resolver = readFileSync(
  "src/bot/handlers/chat/livingRepoStateAgentSourceResolver.js",
  "utf8"
);
const chatAiOrchestrationFlow = readFileSync(
  "src/bot/handlers/chat/chatAiOrchestrationFlow.js",
  "utf8"
);

assert.ok(
  chatAiOrchestrationFlow.includes("resolveChatSourceFlow({\n    effective,\n    livingSGPlan,"),
  "chat AI orchestration must pass livingSGPlan into sourceFlow"
);

assert.ok(
  sourceFlow.includes("resolveLivingRepoStateAgentEnvelope"),
  "sourceFlow must delegate controlled RepoStateAgent source work to resolver"
);
assert.ok(
  !sourceFlow.includes("RepoStateAgentService"),
  "sourceFlow must not instantiate/import RepoStateAgentService directly after resolver extraction"
);
assert.ok(
  !sourceFlow.includes("adaptRepoStateAgentResultToLivingProviderResult"),
  "sourceFlow must not adapt RepoStateAgent results directly after resolver extraction"
);

assert.ok(
  resolver.includes("import { RepoStateAgentService }"),
  "resolver must import RepoStateAgentService for controlled fastReadOnly source path"
);
assert.ok(
  resolver.includes("adaptRepoStateAgentResultToLivingProviderResult"),
  "resolver must adapt RepoStateAgent result to Living providerResult"
);
assert.ok(
  resolver.includes("adaptLivingRepoSourceProviderResult"),
  "resolver must adapt providerResult to sourceResultEnvelope"
);
assert.ok(
  resolver.includes("fastReadOnly: true"),
  "RepoStateAgent must be called only in fastReadOnly mode"
);
assert.ok(
  resolver.includes("requireFreshProjectMap: true"),
  "RepoStateAgent source path must require fresh project map"
);
assert.ok(
  resolver.includes("repoFullName: \"korzh260609-beep/garya-bot\""),
  "RepoStateAgent source path must target the controlled project repo"
);
assert.ok(
  resolver.includes("branch: \"main\""),
  "RepoStateAgent source path must target main branch for freshness check"
);
assert.ok(
  resolver.includes("canChangeState === false"),
  "RepoStateAgent source path must require read-only Living gate"
);
assert.ok(
  resolver.includes("livingSGPlan?.intentPlan?.intentKind === \"project_thinking\""),
  "RepoStateAgent source path must require project_thinking intent"
);
assert.ok(
  resolver.includes("repo_state_agent_source_result_envelope"),
  "resolver must expose RepoStateAgent source result evidence mode"
);

for (const checked of [sourceFlow, resolver]) {
  assert.ok(
    !checked.includes("canAuthorizeWrite: true"),
    "source path must not authorize repo writes"
  );
  assert.ok(
    !checked.includes("canExecute: true"),
    "source path must not create executable repo provider result"
  );
  assert.ok(
    !checked.includes("allowRealAi: true"),
    "source path must not enable real AI analysis"
  );
  assert.ok(
    !checked.includes("forceAiAnalysis: true"),
    "source path must not force AI analysis"
  );
  assert.ok(
    !checked.includes("runScan("),
    "source path must not call repo scan directly"
  );
  assert.ok(
    !checked.includes("/" + "command"),
    "source path must not add command/slash routing"
  );
}

console.log("Smoke Living RepoStateAgent source flow wiring — OK");
