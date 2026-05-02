// scripts/smokeLivingSGSourceResultEnvelopeSoftWiring.js
// ============================================================================
// Smoke — Living SG Source Result Envelope Soft Wiring
//
// Verifies the safe soft-wiring contract without executing source runtime:
// - sourceFlow adapts already-existing sourceCtx.sourceResult into envelope;
// - sourceFlow returns sourceResultEnvelope;
// - chatAiOrchestrationFlow passes sourceResultEnvelope to buildChatMessages;
// - old sourceResultSystemMessage remains present, preserving manual precedence.
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceFlow = readFileSync("src/bot/handlers/chat/sourceFlow.js", "utf8");
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
  "sourceFlow must expose envelope only when adapter result is ok"
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
  sourceFlow.includes("sourceResultSystemMessage = sourceContextText"),
  "sourceFlow must preserve old sourceResultSystemMessage path"
);

assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultEnvelope,"),
  "chatAiOrchestrationFlow must destructure sourceResultEnvelope from source flow"
);
assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultSystemMessage,"),
  "chatAiOrchestrationFlow must keep sourceResultSystemMessage"
);
assert.ok(
  chatAiOrchestrationFlow.includes("sourceResultEnvelope,\n    longTermMemorySystemMessage"),
  "chatAiOrchestrationFlow must pass sourceResultEnvelope into buildChatMessages"
);

assert.ok(
  !sourceFlow.includes("RepoStateAgent"),
  "soft wiring must not connect RepoStateAgent runtime"
);
assert.ok(
  !sourceFlow.includes("executor"),
  "soft wiring must not add executor logic in sourceFlow"
);
assert.ok(
  !chatAiOrchestrationFlow.includes("RepoStateAgent"),
  "soft wiring must not connect RepoStateAgent runtime in orchestration"
);
assert.ok(
  !chatAiOrchestrationFlow.includes("executor"),
  "soft wiring must not add executor logic in orchestration"
);

console.log("Smoke Living SG Source Result Envelope Soft Wiring — OK");
