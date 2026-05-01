// scripts/smokeAiTemperaturePayload.js
// ============================================================================
// AI TEMPERATURE PAYLOAD SMOKE CHECK
//
// Purpose:
// - prevent 400 "Unsupported parameter: temperature" for GPT-5 response models;
// - verify the helper logic by checking source-level contract without API calls.
// ============================================================================

import fs from "node:fs";

function assertIncludes(name, haystack, needle) {
  if (!haystack.includes(needle)) {
    throw new Error(`AI temperature smoke check failed: ${name} missing ${needle}`);
  }
}

function assertRegex(name, haystack, regex) {
  if (!regex.test(haystack)) {
    throw new Error(`AI temperature smoke check failed: ${name} did not match ${regex}`);
  }
}

const source = fs.readFileSync(new URL("../ai.js", import.meta.url), "utf-8");

assertIncludes("isGpt5Model helper", source, "function isGpt5Model(model)");
assertIncludes("resolveTemperatureForModel helper", source, "function resolveTemperatureForModel(model, temperature)");
assertRegex(
  "gpt-5 model detection",
  source,
  /return \/^gpt-5\(\?:\[\.\-\]\|\$\)\/i\.test\(String\(model \|\| ""\)\.trim\(\)\);/
);
assertRegex(
  "temperature disabled for gpt-5",
  source,
  /if \(isGpt5Model\(model\)\) \{\s*return undefined;\s*\}/s
);
assertRegex(
  "runResponsesCreate uses resolved temperature",
  source,
  /const resolvedTemperature = resolveTemperatureForModel\(model, temperature\);[\s\S]*typeof resolvedTemperature === "number" \? \{ temperature: resolvedTemperature \} : \{\}/
);

console.log("OK: GPT-5 temperature payload guard is present.");
