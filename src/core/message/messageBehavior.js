// AGENT NOTE:
// SG 2.0 message behavior helpers.
// Purpose: isolate behavior runtime construction and denial response mapping from handleMessage.
// Do not add AI calls, access checks, prompt assembly, or transport logic here.

import { assertBehaviorRuntimeAllowed, buildBehaviorRuntimeContext } from "../../behavior/behaviorRuntime.js";

export function buildMessageBehaviorRuntime({ identity, text }) {
  return buildBehaviorRuntimeContext({ identity, text });
}

export function checkMessageBehavior(behaviorRuntime) {
  return assertBehaviorRuntimeAllowed(behaviorRuntime);
}

export function buildBehaviorDeniedReply({ behaviorAllowed, identity, behaviorRuntime }) {
  return {
    ok: false,
    reply: "Я не могу выполнить это действие без соблюдения правил поведения SG.",
    reason: behaviorAllowed.reason,
    missing: behaviorAllowed.missing,
    identity,
    behaviorRuntime,
  };
}
