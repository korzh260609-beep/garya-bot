// AGENT NOTE:
// SG 2.0 minimal core message handler.
// Purpose: orchestrate normalized messages through identity, access checks, behavior guardrails, prompt boundary, and AI without putting logic into transport.
// Do not turn this into a monolith; split capabilities as soon as new responsibilities appear.

import { resolveIdentity } from "../users/identityResolver.js";
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
  const identity = resolveIdentity(context);

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

  const aiResult = await callMessageAI({ identity, text, behaviorRuntime });
  return buildSuccessfulMessageReply({ aiResult, identity, behaviorRuntime });
}
