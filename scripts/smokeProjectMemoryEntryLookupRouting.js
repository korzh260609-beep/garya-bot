import assert from "node:assert/strict";

import { runDiagnosticsCheck } from "../src/diagnostics/diagnosticsRunner.js";

async function runCase(text, expectedPrNumber) {
  let capturedInput = null;

  const result = await runDiagnosticsCheck({
    text,
    intent: {
      domain: "diagnostics",
      action: "inspect",
      capability: "project_memory_entry_lookup",
    },
  }, {
    isMonarch: true,
    latestUserText: text,
    intent: {
      domain: "diagnostics",
      action: "inspect",
      capability: "project_memory_entry_lookup",
    },
    skipDiagnosticsObservation: true,
    runDiagnosticsChecksFn: async (input) => {
      capturedInput = input;
      return [];
    },
  });

  assert.equal(result.type, "sg_diagnostics_check");
  assert.equal(result.observation.skipped, true);
  assert.equal(result.runtimeObservation.skipped, true);
  assert.equal(capturedInput.prNumber, expectedPrNumber);
  assert.deepEqual(capturedInput.checks, ["project_memory_entry_lookup"]);
}

await runCase("СГ, выполни project_memory_entry_lookup для PR #321", 321);
await runCase("СГ, выполни project_memory_entry_lookup с prNumber=321", 321);

console.log("smokeProjectMemoryEntryLookupRouting: ok");
