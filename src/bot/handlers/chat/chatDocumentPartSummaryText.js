// src/bot/handlers/chat/chatDocumentPartSummaryText.js

import { safeText } from "./chatShared.js";
import { guardDocumentPartText } from "./aiInputGuard.js";

export function buildInvalidRequestedPartSummaryReply({
  resolvedParts,
  requestedPartNumber,
}) {
  const chunkCount = Number(resolvedParts?.chunkCount || 0);
  const fileName = safeText(resolvedParts?.fileName || "document");
  const requested = Number(requestedPartNumber || 0);

  if (chunkCount <= 0) {
    return `Не вижу частей для ${fileName}.`;
  }

  if (requested <= 0) {
    return `Не понял номер части. Укажи номер от 1 до ${chunkCount}.`;
  }

  if (chunkCount === 1) {
    return `${fileName} помещается в 1 часть. Укажи часть 1.`;
  }

  return `В ${fileName} только ${chunkCount} частей. Укажи номер от 1 до ${chunkCount}.`;
}

export async function buildDocumentPartSummaryReply({
  callAI,
  userText,
  fileName,
  requestedPartNumber,
  chunkCount,
  partText,
}) {
  if (typeof callAI !== "function") return "";

  const normalizedPartText = safeText(partText).trim();
  if (!normalizedPartText) return "";

  const guardedPartText = guardDocumentPartText(normalizedPartText);

  const messages = [
    {
      role: "system",
      content:
        "You are a precise assistant that summarizes one specific document part.\n" +
        "Your task: produce a SHORT concise summary of the requested part only.\n" +
        "Rules:\n" +
        "- Use the same language as the user's request.\n" +
        "- Summarize the meaning, not the whole document.\n" +
        "- Do NOT dump the raw text.\n" +
        "- Do NOT talk about number of parts or estimate.\n" +
        "- Focus only on the requested part.\n" +
        "- Keep it brief and clear: 2-5 short sentences.\n" +
        "- If the text is legal/technical, explain simply but accurately.\n" +
        "- No markdown tables. No JSON.",
    },
    {
      role: "user",
      content:
        `User request:\n${safeText(userText).trim()}\n\n` +
        `Document: ${safeText(fileName).trim() || "document"}\n` +
        `Requested part: ${Number(requestedPartNumber || 0)} of ${Number(chunkCount || 0)}\n\n` +
        `Part text:\n${guardedPartText}`,
    },
  ];

  try {
    const raw = await callAI(messages, "low", {
      max_completion_tokens: 260,
      temperature: 0.2,
    });

    return safeText(raw).trim();
  } catch {
    return "";
  }
}

export default {
  buildInvalidRequestedPartSummaryReply,
  buildDocumentPartSummaryReply,
};
