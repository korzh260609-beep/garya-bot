import assert from "node:assert/strict";

import { runDiagnosticsCheck } from "../src/diagnostics/diagnosticsRunner.js";

const CHECK_NAME = "project_memory_entry_lookup";

async function runCase(text, expectedPrNumber) {
  let capturedInput = null;

  const result = await runDiagnosticsCheck({
    text,
    checks: [CHECK_NAME],
    intent: {
      domain: "diagnostics",
      action: "inspect",
      checks: [CHECK_NAME],
    },
  }, {
    isMonarch: true,
    latestUserText: text,
    intent: {
      domain: "diagnostics",
      action: "inspect",
      checks: [CHECK_NAME],
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
  assert.deepEqual(capturedInput.checks, [CHECK_NAME]);
}

await runCase("СГ, выполни project_memory_entry_lookup для PR #321", 321);
await runCase("СГ, выполни project_memory_entry_lookup с prNumber=321", 321);

console.log("smokeProjectMemoryEntryLookupRouting: ok");
