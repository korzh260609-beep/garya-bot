// src/bot/handlers/chat/chatDocumentPartReplies.js

import { safeText } from "./chatShared.js";

export function buildRequestedDocumentPartReply({
  resolvedParts,
  requestedPartNumber,
}) {
  const chunkCount = Number(resolvedParts?.chunkCount || 0);
  const fileName = safeText(resolvedParts?.fileName || "document");
  const chunks = Array.isArray(resolvedParts?.chunks) ? resolvedParts.chunks : [];
  const targetIndex = Number(requestedPartNumber || 0) - 1;

  if (!Number.isFinite(targetIndex) || targetIndex < 0 || targetIndex >= chunks.length) {
    return "";
  }

  const chunkText = safeText(chunks[targetIndex]);
  if (!chunkText) return "";

  const header =
    chunkCount > 1
      ? `Часть ${requestedPartNumber} из ${chunkCount} (${fileName}):`
      : `Текст документа (${fileName}):`;

  return `${header}\n\n${chunkText}`.trim();
}

export function buildInvalidRequestedPartReply({
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

export default {
  buildRequestedDocumentPartReply,
  buildInvalidRequestedPartReply,
};