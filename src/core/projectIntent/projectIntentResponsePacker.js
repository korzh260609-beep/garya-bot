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

function isLikelyBoundary(slice = "", index = 0) {
  const ch = slice[index] || "";
  const next = slice[index + 1] || "";

  if (isLikelySentenceBoundaryChar(ch) && (next === " " || next === "\n" || next === "")) {
    return true;
  }

  if (ch === "\n" && slice[index - 1] === "\n") {
    return true;
  }

  return false;
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
    if (isLikelyBoundary(slice, i)) {
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

export function splitTextIntoSemanticChunks(text = "", limit = DEFAULT_TRANSPORT_REPLY_LIMIT) {
  const raw = safeText(text);

  if (!raw) return [];

  const chunks = [];
  let rest = raw;

  while (rest) {
    const part = cutAtSemanticBoundary(rest, limit);

    if (!part.wasSplit) {
      chunks.push(part.head);
      break;
    }

    chunks.push(part.head);
    rest = safeText(part.tail);

    if (!rest) break;
  }

  return chunks.filter(Boolean);
}

function buildContinuationFooter({ chunkIndex, chunkCount, endedCleanly }) {
  if (chunkCount <= 1) return "";

  const boundaryText = endedCleanly
    ? "Есть продолжение."
    : "Ответ пришлось остановить на границе допустимого объёма. Есть продолжение.";

  return [
    "",
    `Часть ${chunkIndex} из ${chunkCount}.`,
    boundaryText,
    "Напиши: `продолжай` или `покажи следующую часть`.",
  ].join("\n");
}

export function buildPackedExplainText({
  aiReply,
  targetPath,
  displayMode = "explain",
  replyLimit = DEFAULT_TRANSPORT_REPLY_LIMIT,
}) {
  const text = safeText(aiReply);
  const fileName = safeText(targetPath).split("/").pop() || safeText(targetPath) || "документ";
  const chunks = splitTextIntoSemanticChunks(text, replyLimit);

  if (chunks.length <= 1) {
    return {
      text,
      largeDocument: false,
      pendingChoice: null,
      continuationState: {
        isActive: false,
        sourceKind: "ai_explain",
        targetPath: safeText(targetPath),
        displayMode: safeText(displayMode),
        chunkIndex: 1,
        chunkCount: 1,
        chunks: chunks.length === 1 ? chunks : [],
        remainingText: "",
      },
    };
  }

  const intro =
    displayMode === "summary"
      ? `Я даю первую часть краткого объяснения файла ${fileName}.`
      : `Я даю первую часть объяснения файла ${fileName}.`;

  const firstChunk = chunks[0];
  const footer = buildContinuationFooter({
    chunkIndex: 1,
    chunkCount: chunks.length,
    endedCleanly: /[.!?…]$/.test(firstChunk),
  });

  return {
    text: [intro, "", firstChunk, footer].join("\n"),
    largeDocument: true,
    pendingChoice: {
      isActive: true,
      kind: "large_doc_action",
      targetEntity: fileName,
      targetPath: safeText(targetPath),
      displayMode,
    },
    continuationState: {
      isActive: true,
      sourceKind: "ai_explain",
      targetPath: safeText(targetPath),
      displayMode: safeText(displayMode),
      chunkIndex: 1,
      chunkCount: chunks.length,
      chunks,
      remainingText: chunks.slice(1).join("\n\n"),
    },
  };
}

export function buildContinuationChunkReply({
  continuationState,
}) {
  const state = continuationState && typeof continuationState === "object"
    ? continuationState
    : {};

  const isActive = state.isActive === true;
  const chunks = Array.isArray(state.chunks) ? state.chunks.filter(Boolean) : [];
  const currentIndex = Number(state.chunkIndex || 1);
  const chunkCount = Number(state.chunkCount || chunks.length || 0);

  if (!isActive || chunks.length === 0 || chunkCount <= 1) {
    return {
      ok: false,
      text: "",
      nextState: {
        isActive: false,
        sourceKind: safeText(state.sourceKind),
        targetPath: safeText(state.targetPath),
        displayMode: safeText(state.displayMode),
        chunkIndex: 1,
        chunkCount: chunks.length || 0,
        chunks,
        remainingText: "",
      },
      hasMore: false,
    };
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex > chunks.length) {
    return {
      ok: false,
      text: "",
      nextState: {
        isActive: false,
        sourceKind: safeText(state.sourceKind),
        targetPath: safeText(state.targetPath),
        displayMode: safeText(state.displayMode),
        chunkIndex: currentIndex,
        chunkCount: chunkCount,
        chunks,
        remainingText: "",
      },
      hasMore: false,
    };
  }

  const body = chunks[nextIndex - 1];
  const hasMore = nextIndex < chunks.length;
  const footer = hasMore
    ? buildContinuationFooter({
        chunkIndex: nextIndex,
        chunkCount: chunkCount,
        endedCleanly: /[.!?…]$/.test(body),
      })
    : [
        "",
        `Часть ${nextIndex} из ${chunkCount}.`,
        "Это последняя часть.",
      ].join("\n");

  return {
    ok: true,
    text: [body, footer].join("\n"),
    nextState: {
      isActive: hasMore,
      sourceKind: safeText(state.sourceKind),
      targetPath: safeText(state.targetPath),
      displayMode: safeText(state.displayMode),
      chunkIndex: nextIndex,
      chunkCount: chunkCount,
      chunks,
      remainingText: hasMore ? chunks.slice(nextIndex).join("\n\n") : "",
    },
    hasMore,
  };
}

export default {
  DEFAULT_TRANSPORT_REPLY_LIMIT,
  TRANSPORT_REPLY_LIMITS,
  getReplyLimitFromTransport,
  getReplyLimitFromReplyAndLog,
  cutAtSemanticBoundary,
  splitTextIntoSemanticChunks,
  buildPackedExplainText,
  buildContinuationChunkReply,
};
