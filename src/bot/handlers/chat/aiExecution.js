// src/bot/handlers/chat/aiExecution.js

import BehaviorEventsService from "../../../logging/BehaviorEventsService.js";

export function resolveAiParams(answerMode) {
  let maxTokens = 350;
  let temperature = 0.6;

  if (answerMode === "short") {
    maxTokens = 150;
    temperature = 0.3;
  } else if (answerMode === "long") {
    maxTokens = 900;
    temperature = 0.8;
  }

  return {
    maxTokens,
    temperature,
  };
}

async function logBehaviorUsageEvents({
  globalUserId,
  chatIdStr,
  aiMetaBase,
}) {
  try {
    const be = new BehaviorEventsService();

    const behaviorStyleAxis =
      typeof aiMetaBase?.behaviorStyleAxis === "string"
        ? aiMetaBase.behaviorStyleAxis
        : "unknown";

    const behaviorStyleAxisSource =
      typeof aiMetaBase?.behaviorStyleAxisSource === "string"
        ? aiMetaBase.behaviorStyleAxisSource
        : "unknown";

    const behaviorCriticality =
      typeof aiMetaBase?.behaviorCriticality === "string"
        ? aiMetaBase.behaviorCriticality
        : "unknown";

    const behaviorCriticalitySource =
      typeof aiMetaBase?.behaviorCriticalitySource === "string"
        ? aiMetaBase.behaviorCriticalitySource
        : "unknown";

    const behaviorVersion =
      typeof aiMetaBase?.behaviorVersion === "string"
        ? aiMetaBase.behaviorVersion
        : "unknown";

    const behaviorNoNodding = Boolean(aiMetaBase?.behaviorNoNodding);
    const behaviorSoftStyleAskDetected = Boolean(
      aiMetaBase?.behaviorSoftStyleAskDetected
    );

    await be.logEvent({
      globalUserId: globalUserId ?? null,
      chatId: chatIdStr,
      eventType: "behavior_snapshot_used",
      metadata: {
        behaviorVersion,
        styleAxis: behaviorStyleAxis,
        styleAxisSource: behaviorStyleAxisSource,
        softStyleAskDetected: behaviorSoftStyleAskDetected,
        criticality: behaviorCriticality,
        criticalitySource: behaviorCriticalitySource,
        noNodding: behaviorNoNodding,
      },
      transport: "telegram",
      schemaVersion: 1,
    });
  } catch (e) {
    console.error("behavior_events behavior_snapshot_used log failed:", e);
  }
}

function countMatches(text, regex) {
  const m = text.match(regex);
  return Array.isArray(m) ? m.length : 0;
}

function buildClarificationSignal(reply) {
  const raw = typeof reply === "string" ? reply : "";
  const text = raw.trim();

  if (!text) {
    return {
      shouldLog: false,
      reason: "empty",
      replyChars: 0,
      questionCount: 0,
      lineCount: 0,
    };
  }

  if (text.startsWith("ERROR: Ошибка вызова ИИ")) {
    return {
      shouldLog: false,
      reason: "error_reply",
      replyChars: text.length,
      questionCount: 0,
      lineCount: 0,
    };
  }

  const replyChars = text.length;
  const questionCount = countMatches(text, /\?/g);
  const lineCount = text.split(/\n+/).filter(Boolean).length;
  const endsWithQuestion = text.endsWith("?");
  const firstQuestionIndex = text.indexOf("?");
  const charsBeforeFirstQuestion =
    firstQuestionIndex >= 0 ? firstQuestionIndex : text.length;

  const sentenceBreakCount = countMatches(text, /[.!?]/g);
  const colonCount = countMatches(text, /:/g);
  const bulletLineCount = text
    .split("\n")
    .filter((line) => /^\s*[-•–—\d]+\)?[.\-]?\s+/.test(line.trim())).length;

  const shortEnough = replyChars <= 280;
  const compactEnough = lineCount <= 3;
  const hasSingleQuestion = questionCount === 1;
  const lowStructure =
    bulletLineCount === 0 && colonCount <= 1 && sentenceBreakCount <= 3;
  const questionAppearsEarly = charsBeforeFirstQuestion <= 220;

  const shouldLog =
    endsWithQuestion &&
    hasSingleQuestion &&
    shortEnough &&
    compactEnough &&
    lowStructure &&
    questionAppearsEarly;

  let reason = "not_clarification";
  if (shouldLog) {
    reason = "short_single_question";
  } else if (!endsWithQuestion) {
    reason = "no_terminal_question";
  } else if (!hasSingleQuestion) {
    reason = "question_count_mismatch";
  } else if (!shortEnough) {
    reason = "too_long";
  } else if (!compactEnough) {
    reason = "too_many_lines";
  } else if (!lowStructure) {
    reason = "too_structured";
  } else if (!questionAppearsEarly) {
    reason = "question_too_late";
  }

  return {
    shouldLog,
    reason,
    replyChars,
    questionCount,
    lineCount,
    sentenceBreakCount,
    colonCount,
    bulletLineCount,
    endsWithQuestion,
    charsBeforeFirstQuestion,
    detectorVersion: "clar_v2",
  };
}

function buildCompletionBoundarySystemMessage(maxTokens) {
  return {
    role: "system",
    content:
      "OUTPUT BOUNDARY RULE:\n" +
      `You have a limited completion budget (max_completion_tokens=${maxTokens}).\n` +
      "Do NOT let the answer break in the middle of a sentence, list item, or paragraph.\n" +
      "If space is running out, compress and end with one short complete final sentence.\n" +
      "Prefer a shorter finished answer over a longer abruptly cut answer.\n" +
      "Never end on a hanging clause, half-word, or unfinished bullet.",
  };
}

function withCompletionBoundaryGuard(messages, maxTokens) {
  const safeMessages = Array.isArray(messages) ? messages.slice() : [];
  safeMessages.splice(
    Math.max(0, safeMessages.length - 1),
    0,
    buildCompletionBoundarySystemMessage(maxTokens)
  );
  return safeMessages;
}

function endsCleanly(text) {
  return /[.!?…)"»\]]\s*$/.test(text);
}

function findLastGoodBoundary(text) {
  const candidates = [];

  const sentencePunct = /[.!?…](?=\s|$)/g;
  let m;
  while ((m = sentencePunct.exec(text)) !== null) {
    candidates.push(m.index + m[0].length);
  }

  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") {
      candidates.push(i);
    }
  }

  if (!candidates.length) return -1;

  const minAcceptable = Math.max(40, Math.floor(text.length * 0.55));

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    if (candidates[i] >= minAcceptable) {
      return candidates[i];
    }
  }

  return candidates[candidates.length - 1];
}

function finalizeAiReplyBoundary(reply) {
  const raw = typeof reply === "string" ? reply : "";
  const text = raw.trimEnd();

  if (!text) return raw;
  if (text.startsWith("ERROR: Ошибка вызова ИИ")) return text;
  if (endsCleanly(text)) return text;
  if (text.endsWith("```")) return text;

  const boundary = findLastGoodBoundary(text);
  if (boundary <= 0) {
    return text;
  }

  const trimmed = text.slice(0, boundary).trimEnd();
  if (!trimmed) {
    return text;
  }

  return trimmed;
}

export async function executeChatAI({
  callAI,
  filtered,
  classification,
  maxTokens,
  temperature,
  monarchNow,
  logInteraction,
  aiMetaBase,
  globalUserId,
  chatIdStr,
}) {
  try {
    console.info("AI_CALL_START", aiMetaBase);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, {
      ...classification,
      event: "AI_CALL_START",
      ...aiMetaBase,
    });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_START) error:", e);
  }

  await logBehaviorUsageEvents({
    globalUserId,
    chatIdStr,
    aiMetaBase,
  });

  const t0 = Date.now();

  let aiReply = "";
  try {
    const guardedMessages = withCompletionBoundaryGuard(filtered, maxTokens);

    aiReply = await callAI(guardedMessages, classification.aiCostLevel, {
      max_completion_tokens: maxTokens,
      temperature,
    });

    aiReply = finalizeAiReplyBoundary(aiReply);
  } catch (e) {
    console.error("ERROR AI error:", e);

    const msgText = e?.message ? String(e.message) : "unknown";
    aiReply = monarchNow
      ? `ERROR: Ошибка вызова ИИ: ${msgText}`
      : "ERROR: Ошибка вызова ИИ.";
  }

  const dtMs = Date.now() - t0;
  const aiMetaEnd = {
    ...aiMetaBase,
    dtMs,
    replyChars: typeof aiReply === "string" ? aiReply.length : 0,
    ok: !(
      typeof aiReply === "string" &&
      aiReply.startsWith("ERROR: Ошибка вызова ИИ")
    ),
  };

  try {
    const clarificationSignal = buildClarificationSignal(aiReply);

    if (clarificationSignal.shouldLog) {
      const be = new BehaviorEventsService();
      await be.logEvent({
        globalUserId: globalUserId ?? null,
        chatId: chatIdStr,
        eventType: "clarification_asked",
        metadata: {
          replyChars: clarificationSignal.replyChars,
          questionCount: clarificationSignal.questionCount,
          lineCount: clarificationSignal.lineCount,
          detectorVersion: clarificationSignal.detectorVersion,
          reason: clarificationSignal.reason,
        },
        transport: "telegram",
        schemaVersion: 1,
      });
    }
  } catch (clarErr) {
    console.error("behavior_events clarification_asked log failed:", clarErr);
  }

  try {
    console.info("AI_CALL_END", aiMetaEnd);
  } catch (_) {}

  try {
    await logInteraction(chatIdStr, {
      ...classification,
      event: "AI_CALL_END",
      ...aiMetaEnd,
    });
  } catch (e) {
    console.error("ERROR logInteraction (AI_CALL_END) error:", e);
  }

  return {
    aiReply,
    aiMetaEnd,
  };
}