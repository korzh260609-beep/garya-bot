// scripts/smokeLivingSGSourceResultEnvelopeControlledSwitch.js
// ============================================================================
// Smoke — Living SG Source Result Envelope Controlled Switch
//
// Verifies source evidence switch:
// - when sourceResultEnvelope exists, old legacy SOURCE RESULT system message
//   is not passed forward;
// - when envelope is missing, legacy sourceResultSystemMessage can still be
//   used as fallback;
// - RepoStateAgent is allowed only through the controlled fastReadOnly source
//   path guarded by Living SG read-only planning;
// - no executor, write authority, AI forcing, direct scan, or slash command path
//   is introduced by the switch.
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sourceFlow = readFileSync("src/bot/handlers/chat/sourceFlow.js", "utf8");

assert.ok(
  sourceFlow.includes("const legacySourceResultSystemMessage = sourceContextText"),
  "sourceFlow must keep legacy source result system message as a named fallback"
);

assert.ok(
  sourceFlow.includes("const sourceResultSystemMessage = sourceResultEnvelope\n    ? null\n    : legacySourceResultSystemMessage;"),
  "sourceFlow must suppress legacy sourceResultSystemMessage when envelope exists"
);

assert.ok(
  sourceFlow.includes("sourceResultEvidenceMode = sourceResultEnvelope"),
  "sourceFlow must expose source result evidence mode diagnostics"
);

assert.ok(
  sourceFlow.includes("\"source_result_envelope\""),
  "sourceFlow must identify envelope evidence mode"
);

assert.ok(
  sourceFlow.includes("\"legacy_source_result_system_message\""),
  "sourceFlow must identify legacy fallback evidence mode"
);

assert.ok(
  sourceFlow.includes("legacySourceResultSystemMessage,"),
  "sourceFlow must return legacySourceResultSystemMessage for diagnostics/fallback visibility"
);

assert.ok(
  sourceFlow.includes("RepoStateAgentService"),
  "controlled switch may use RepoStateAgentService for the approved fastReadOnly source path"
);
assert.ok(
  sourceFlow.includes("fastReadOnly: true"),
  "RepoStateAgent source path must remain fastReadOnly"
);
assert.ok(
  sourceFlow.includes("requireFreshProjectMap: true"),
  "RepoStateAgent source path must require fresh project map"
);
assert.ok(
  sourceFlow.includes("canChangeState === false"),
  "RepoStateAgent source path must remain behind read-only Living gate"
);

assert.ok(
  !sourceFlow.includes("canAuthorizeWrite: true"),
  "controlled switch must not authorize repo writes"
);
assert.ok(
  !sourceFlow.includes("canExecute: true"),
  "controlled switch must not create executable provider result"
);
assert.ok(
  !sourceFlow.includes("allowRealAi: true"),
  "controlled switch must not enable real AI"
);
assert.ok(
  !sourceFlow.includes("forceAiAnalysis: true"),
  "controlled switch must not force AI analysis"
);
assert.ok(
  !sourceFlow.includes("runScan("),
  "controlled switch must not call repo scan directly"
);
assert.ok(
  !sourceFlow.includes("/" + "command"),
  "controlled switch must not add slash-command routing"
);

console.log("Smoke Living SG Source Result Envelope Controlled Switch — OK");
