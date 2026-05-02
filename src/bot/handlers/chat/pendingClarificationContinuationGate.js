// src/bot/handlers/chat/pendingClarificationContinuationGate.js
// ============================================================================
// Pending Clarification Continuation Gate
//
// Purpose:
// - prevent old pending clarification flows from automatically hijacking every
//   next user message before Living SG can process it;
// - decide whether the message is a real continuation of the pending question
//   or a new independent user task;
// - keep this as a semantic gate, not a keyword/phrase router.
//
// Boundaries:
// - no slash-command routing;
// - no exact phrase routing;
// - no repo/document action execution;
// - no AI answer generation;
// - classifier only returns a routing decision for pending-state ownership.
// ============================================================================

import { safeText } from "./chatShared.js";

function clampConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function parseJsonObjectFromText(value) {
  const text = safeText(value).trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function fallbackRelease(reason = "pending_continuation_gate_unavailable") {
  return {
    ok: false,
    shouldContinuePending: false,
    shouldReleaseToLivingChat: true,
    shouldClearPending: false,
    confidence: 0,
    relation: "unknown",
    reason,
  };
}

export async function resolvePendingClarificationContinuationGate({
  callAI,
  userText,
  pending,
} = {}) {
  const text = safeText(userText);
  const question = safeText(pending?.question);
  const kind = safeText(pending?.kind) || "unknown";

  if (!pending || !text) return fallbackRelease("pending_or_text_missing");
  if (typeof callAI !== "function") return fallbackRelease("callai_missing");

  const messages = [
    {
      role: "system",
      content:
        "You are a strict semantic gate for pending clarification ownership in a chat assistant.\n" +
        "The assistant has a pending clarification question, but a new user message arrived before normal Living SG processing.\n" +
        "Decide whether the new user message is truly an answer/continuation of the pending clarification, or whether it is a new independent task that must be released to normal Living SG chat.\n" +
        "Do not solve the task. Do not answer the user. Return only valid JSON.\n\n" +
        "Schema:\n" +
        "{\n" +
        '  "relation": "continues_pending" | "new_independent_task" | "ambiguous",\n' +
        '  "shouldContinuePending": boolean,\n' +
        '  "shouldReleaseToLivingChat": boolean,\n' +
        '  "shouldClearPending": boolean,\n' +
        '  "confidence": number,\n' +
        '  "reason": string\n' +
        "}\n\n" +
        "Rules:\n" +
        "- shouldContinuePending=true only when the message is a direct answer, correction, or requested detail for the pending clarification.\n" +
        "- shouldReleaseToLivingChat=true when the message is a new question, new task, or changed topic.\n" +
        "- shouldClearPending=true only when the user clearly moved to a new independent task.\n" +
        "- Ambiguous messages should be released to Living SG unless they are clearly tied to the pending clarification.\n" +
        "- This is semantic relation classification, not keyword matching.\n" +
        "- Output JSON only.",
    },
    {
      role: "user",
      content:
        `Pending clarification kind:\n${kind}\n\n` +
        `Pending clarification question:\n${question || "none"}\n\n` +
        `New user message:\n${text}\n`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 160,
      temperature: 0.1,
    });

    const parsed = parseJsonObjectFromText(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackRelease("json_parse_failed");
    }

    const relation = safeText(parsed?.relation) || "unknown";
    const confidence = clampConfidence(parsed?.confidence);
    const shouldContinuePending =
      parsed?.shouldContinuePending === true &&
      relation === "continues_pending" &&
      confidence >= 0.6;

    const shouldReleaseToLivingChat = shouldContinuePending
      ? false
      : parsed?.shouldReleaseToLivingChat !== false;

    return {
      ok: true,
      shouldContinuePending,
      shouldReleaseToLivingChat,
      shouldClearPending:
        shouldReleaseToLivingChat === true &&
        parsed?.shouldClearPending === true &&
        relation === "new_independent_task",
      confidence,
      relation,
      reason: safeText(parsed?.reason) || "semantic_pending_continuation_gate",
    };
  } catch (error) {
    return fallbackRelease(
      error?.message
        ? `pending_continuation_gate_error:${String(error.message)}`
        : "pending_continuation_gate_error"
    );
  }
}

export default {
  resolvePendingClarificationContinuationGate,
};
