// scripts/smokeLivingSGSourceResultEnvelopeControlledSwitch.js
// ============================================================================
// Smoke — Living SG Source Result Envelope Controlled Switch
//
// Verifies Variant B source evidence switch:
// - when sourceResultEnvelope exists, old legacy SOURCE RESULT system message
//   is not passed forward;
// - when envelope is missing, legacy sourceResultSystemMessage can still be
//   used as fallback;
// - no source execution, repo-read runtime, executor, or slash command path is
//   introduced by the switch.
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
  !sourceFlow.includes("RepoStateAgent"),
  "controlled switch must not connect RepoStateAgent runtime"
);
assert.ok(
  !sourceFlow.includes("executor"),
  "controlled switch must not add executor logic"
);
assert.ok(
  !sourceFlow.includes("slash"),
  "controlled switch must not add slash-command routing"
);

console.log("Smoke Living SG Source Result Envelope Controlled Switch — OK");
