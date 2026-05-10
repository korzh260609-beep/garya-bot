// AGENT NOTE:
// CLI runner for Observation Trigger Dispatch Agent.
// Intended for bounded GitHub Actions event dispatch only.
// Do not add timers, Telegram integration, AI calls, memory writes, raw logs, raw provider IDs, autonomous behavior, or mutations here.

import { runObservationTriggerDispatchAgent } from "./observationTriggerDispatchAgent.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

const eventType = normalizeText(process.env.OBSERVATION_DISPATCH_EVENT_TYPE);

try {
  const result = await runObservationTriggerDispatchAgent({ eventType });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result?.ok ? 0 : 1);
} catch (error) {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
