// src/core/projectIntent/projectIntentResponsePacker.js
// ============================================================================
// STAGE 12A.0 — universal semantic response packer for repo dialogue
// Purpose:
// - keep delivery logic transport-aware but meaning-first
// - avoid silent truncation
// - split long responses only on safe semantic boundaries
// - preserve continuation context
// IMPORTANT:
// - no transport send here
// - no repo read here
// - packaging only
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

export const DEFAULT_TRANSPORT_REPLY_LIMIT = 3200;

export const TRANSPORT_REPLY_LIMITS = Object.freeze({
  telegram: 3200,
  discord: 3500,
  web: 6000,
  api: 8000,
  unknown: DEFAULT_TRANSPORT_REPLY_LIMIT,
});

export function getReplyLimitFromTransport(transportName = "") {
  const key = safeText(transportName).toLowerCase();
  return TRANSPORT_REPLY_LIMITS[key] || DEFAULT_TRANSPORT_REPLY_LIMIT;
}

export function getReplyLimitFromReplyAndLog(replyAndLog) {
  const transportName = safeText(replyAndLog?.transport || replyAndLog?.transportName);
  return getReplyLimitFromTransport(transportName);
}

function isLikelySentenceBoundaryChar(ch = "") {
  return [".", "!", "?", "…"].includes(ch);
}

export function cutAtSemanticBoundary(text = "", limit = DEFAULT_TRANSPORT_REPLY_LIMIT) {
  const raw = safeText(text);

  if (!raw) {
    return {
      head: "",
      tail: "",
      wasSplit: false,
      endedCleanly: true,
    };
  }

  if (raw.length <= limit) {
    return {
      head: raw,
      tail: "",
      wasSplit: false,
      endedCleanly: /[.!?…]$/.test(raw),
    };
  }

  const slice = raw.slice(0, limit);
  let bestIndex = -1;

  for (let i = slice.length - 1; i >= Math.floor(limit * 0.55); i -= 1) {
    const ch = slice[i];
    const next = slice[i + 1] || "";

    if (isLikelySentenceBoundaryChar(ch) && (next === " " || next === "\n" || next === "")) {
      bestIndex = i + 1;
      break;
    }

    if (ch === "\n" && slice[i - 1] === "\n") {
      bestIndex = i + 1;
      break;
    }
  }

  if (bestIndex === -1) {
    for (let i = slice.length - 1; i >= Math.floor(limit * 0.7); i -= 1) {
      if (slice[i] === " ") {
        bestIndex = i;
        break;
      }
    }
  }

  if (bestIndex === -1) {
    bestIndex = limit;
  }

  const head = slice.slice(0, bestIndex).trim();
  const tail = raw.slice(bestIndex).trim();

  return {
    head,
    tail,
    wasSplit: true,
    endedCleanly: /[.!?…]$/.test(head),
  };
}

export function buildPackedExplainText({
  aiReply,
  targetPath,
  displayMode = "explain",
  replyLimit = DEFAULT_TRANSPORT_REPLY_LIMIT,
}) {
  const text = safeText(aiReply);
  const split = cutAtSemanticBoundary(text, replyLimit);
  const fileName = safeText(targetPath).split("/").pop() || safeText(targetPath) || "документ";

  if (!split.wasSplit) {
    return {
      text,
      largeDocument: false,
      pendingChoice: null,
    };
  }

  const intro =
    displayMode === "summary"
      ? `Я даю первую часть краткого объяснения файла ${fileName}.`
      : `Я даю первую часть объяснения файла ${fileName}.`;

  const footer = split.endedCleanly
    ? [
        "",
        "Ответ длиннее одного сообщения.",
        "Есть продолжение.",
        "Напиши: `продолжай` или `покажи следующую часть`.",
      ].join("\n")
    : [
        "",
        "Ответ пришлось остановить на границе допустимого объёма.",
        "Есть продолжение.",
        "Напиши: `продолжай` или `покажи следующую часть`.",
      ].join("\n");

  return {
    text: [intro, "", split.head, footer].join("\n"),
    largeDocument: true,
    pendingChoice: {
      isActive: true,
      kind: "large_doc_action",
      targetEntity: fileName,
      targetPath: safeText(targetPath),
      displayMode,
    },
  };
}

export default {
  DEFAULT_TRANSPORT_REPLY_LIMIT,
  TRANSPORT_REPLY_LIMITS,
  getReplyLimitFromTransport,
  getReplyLimitFromReplyAndLog,
  cutAtSemanticBoundary,
  buildPackedExplainText,
};
