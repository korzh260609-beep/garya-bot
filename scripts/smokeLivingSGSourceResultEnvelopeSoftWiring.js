// scripts/smokeLivingSGSourceResultEnvelopeSoftWiring.js
// ============================================================================
// Smoke — Living SG Source Result Envelope Soft Wiring
//
// Verifies the safe source-result envelope wiring contract after resolver split:
// - sourceFlow adapts already-existing sourceCtx.sourceResult into envelope;
// - sourceFlow delegates controlled RepoStateAgent fastReadOnly path to resolver;
// - sourceFlow returns sourceResultEnvelope;
// - chatAiOrchestrationFlow passes sourceResultEnvelope to buildChatMessages;
// - legacy sourceResultSystemMessage remains available as fallback diagnostics;
// - no write/executor/AI-forcing/direct-scan path is introduced.
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
  sourceFlow.includes("adaptLegacySourceResultToEnvelope"),
  "sourceFlow must import/use the legacy source result envelope adapter"
);
assert.ok(
  sourceFlow.includes("sourceResultEnvelopeAdapterResult = adaptLegacySourceResultToEnvelope"),
  "sourceFlow must create adapter result from existing sourceCtx/sourceResult"
);
assert.ok(
  sourceFlow.includes("sourceResultEnvelopeAdapterResult?.ok === true"),
  "sourceFlow must expose legacy envelope only when adapter result is ok"
);
assert.ok(
  sourceFlow.includes("resolveLivingRepoStateAgentEnvelope"),
  "sourceFlow must delegate controlled RepoStateAgent work to resolver"
);
assert.ok(
  resolver.includes("adaptRepoStateAgentResultToLivingProviderResult"),
  "resolver must adapt controlled RepoStateAgent result to Living providerResult"
);
assert.ok(
  resolver.includes("adaptLivingRepoSourceProviderResult"),
  "resolver must adapt controlled providerResult into sourceResultEnvelope"
);
assert.ok(
  resolver.includes("fastReadOnly: true"),
  "controlled RepoStateAgent path must be fastReadOnly"
);
assert.ok(
  resolver.includes("requireFreshProjectMap: true"),
  "controlled RepoStateAgent path must require fresh project map"
);
assert.ok(
  resolver.includes("canChangeState === false"),
  "controlled RepoStateAgent path must require read-only Living gate"
);
assert.ok(
  sourceFlow.includes("sourceResultEnvelope,"),
  "sourceFlow return object must include sourceResultEnvelope"
);
assert.ok(
  sourceFlow.includes("sourceResultEnvelopeAdapterResult,"),
  "sourceFlow return object must include adapter diagnostics"
);
assert.ok(
  sourceFlow.includes("legacySourceResultSystemMessage = sourceContextText"),
  "sourceFlow must preserve legacy source result system message as fallback diagnostics"
);
assert.ok(
  sourceFlow.includes("sourceResultSystemMessage = sourceResultEnvelope"),
  "sourceFlow must control whether legacy sourceResultSystemMessage is passed forward"
);

assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultEnvelope,"),
  "chatAiOrchestrationFlow must destructure sourceResultEnvelope from source flow"
);
assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultSystemMessage,"),
  "chatAiOrchestrationFlow must keep sourceResultSystemMessage fallback input"
);
assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultEnvelope,\n    longTermMemorySystemMessage"),
  "chatAiOrchestrationFlow must pass sourceResultEnvelope into buildChatMessages"
);
assert.ok(
  chatAiOrchestrationFlow.includes("livingRepoStateAgentSource"),
  "chatAiOrchestrationFlow must expose controlled RepoStateAgent source diagnostics"
);

for (const checked of [sourceFlow, resolver]) {
  assert.ok(
    !checked.includes("canAuthorizeWrite: true"),
    "source result envelope wiring must not authorize repo writes"
  );
  assert.ok(
    !checked.includes("canExecute: true"),
    "source result envelope wiring must not create executable provider result"
  );
  assert.ok(
    !checked.includes("allowRealAi: true"),
    "source result envelope wiring must not enable real AI"
  );
  assert.ok(
    !checked.includes("forceAiAnalysis: true"),
    "source result envelope wiring must not force AI analysis"
  );
  assert.ok(
    !checked.includes("runScan("),
    "source result envelope wiring must not call repo scan directly"
  );
  assert.ok(
    !checked.includes("/" + "command"),
    "source result envelope wiring must not add slash-command routing"
  );
}
assert.ok(
  !sourceFlow.includes("RepoStateAgentService"),
  "sourceFlow must not instantiate/import RepoStateAgentService directly after resolver split"
);
assert.ok(
  !chatAiOrchestrationFlow.includes("RepoStateAgentService"),
  "orchestration must not instantiate or import RepoStateAgentService directly"
);
assert.ok(
  !chatAiOrchestrationFlow.includes("from \"../../../simpleAgents/repoStateAgent"),
  "orchestration must not import RepoStateAgent modules directly"
);
assert.ok(
  !chatAiOrchestrationFlow.includes("executor"),
  "source result envelope wiring must not add executor logic in orchestration"
);

console.log("Smoke Living SG Source Result Envelope Soft Wiring — OK");
