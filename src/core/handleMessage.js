// AGENT NOTE:
// SG 2.0 minimal core message handler.
// Purpose: orchestrate normalized messages through identity, access checks, behavior guardrails, prompt boundary, runtime context, and AI without putting logic into transport.
// Do not turn this into a monolith; split capabilities as soon as new responsibilities appear.

import { resolveIdentityAsync } from "../users/identityResolver.js";
import { resolveMessageRuntimeOptions } from "./runtime/messageRuntimeContextResolver.js";
import {
  buildAccessDeniedReply,
  buildBehaviorDeniedReply,
  buildEmptyTextReply,
  buildMessageBehaviorRuntime,
  buildSuccessfulMessageReply,
  callMessageAI,
  checkMessageAccess,
  checkMessageBehavior,
  extractMessageText,
} from "./message/index.js";

export async function handleMessage(context = {}) {
  const text = extractMessageText(context);
  const identity = await resolveIdentityAsync(context);

  if (!text) {
    return buildEmptyTextReply(identity);
  }

  const access = checkMessageAccess(identity);

  if (!access.allowed) {
    return buildAccessDeniedReply({ access, identity });
  }

  const behaviorRuntime = buildMessageBehaviorRuntime({ identity, text });
  const behaviorAllowed = checkMessageBehavior(behaviorRuntime);

  if (!behaviorAllowed.ok) {
    return buildBehaviorDeniedReply({ behaviorAllowed, identity, behaviorRuntime });
  }

  const runtimeOptions = await resolveMessageRuntimeOptions({ context, identity });

  const aiResult = await callMessageAI({
    identity,
    text,
    behaviorRuntime,
    explicitProjectContext: runtimeOptions.explicitProjectContext,
  });
  return buildSuccessfulMessageReply({ aiResult, identity, behaviorRuntime });
}
