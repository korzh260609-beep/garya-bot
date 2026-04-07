// src/bot/handlers/chat/chatEstimateMeta.js

import { safeText } from "./chatShared.js";

export function getEstimateMeta(estimate) {
  const fileName = safeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0);
  const charCount = Number(estimate?.charCount || 0);
  const chunkSize = Number(estimate?.chunkSize || 0);
  const approxInputTokens = Math.ceil(charCount / 4);
  const parts = Array.isArray(estimate?.parts) ? estimate.parts : [];

  const largestPart = parts.reduce(
    (max, part) => {
      const current = Number(part?.charCount || 0);
      return current > max.charCount
        ? { partNumber: Number(part?.partNumber || 0), charCount: current }
        : max;
    },
    { partNumber: 0, charCount: 0 }
  );

  return {
    fileName,
    chunkCount,
    charCount,
    chunkSize,
    approxInputTokens,
    parts,
    largestPart,
  };
}

export default {
  getEstimateMeta,
};
