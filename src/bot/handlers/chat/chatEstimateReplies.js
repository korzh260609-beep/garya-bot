// src/bot/handlers/chat/chatEstimateReplies.js

import { saveActiveEstimateContext } from "./activeEstimateContextCache.js";
import { safeText } from "./chatShared.js";

export function buildEstimateReplyText(estimate) {
  const fileName = safeText(estimate?.fileName || "document");
  const chunkCount = Number(estimate?.chunkCount || 0);
  const charCount = Number(estimate?.charCount || 0);
  const chunkSize = Number(estimate?.chunkSize || 0);
  const parts = Array.isArray(estimate?.parts) ? estimate.parts : [];

  const approxInputTokens = Math.ceil(charCount / 4);
  const largestPart = parts.reduce(
    (max, part) => {
      const current = Number(part?.charCount || 0);
      return current > max.charCount
        ? { partNumber: Number(part?.partNumber || 0), charCount: current }
        : max;
    },
    { partNumber: 0, charCount: 0 }
  );

  const lines = [];

  if (chunkCount <= 1) {
    lines.push(
      `Если вывести ${fileName} в чат, он поместится примерно в 1 сообщение.`
    );
  } else {
    lines.push(
      `Если вывести ${fileName} в чат, получится примерно ${chunkCount} частей.`
    );
  }

  if (chunkSize > 0 && charCount > 0) {
    lines.push(
      `Основа оценки: около ${charCount} символов текста при лимите ~${chunkSize} символов на часть.`
    );
    lines.push(`Это примерно ~${approxInputTokens} токенов текста.`);
  }

  if (largestPart.charCount > 0) {
    lines.push(
      `Самая большая часть: №${largestPart.partNumber}, около ${largestPart.charCount} символов.`
    );
  }

  if (chunkCount <= 2) {
    lines.push(`Практичнее вывести в чат.`);
  } else {
    lines.push(`Практичнее отдать файлом, а не длинной серией сообщений.`);
  }

  if (parts.length > 0) {
    lines.push("");
    lines.push("Примерно по частям:");

    for (const part of parts.slice(0, 6)) {
      const partNumber = Number(part?.partNumber || 0);
      const partCharCount = Number(part?.charCount || 0);
      const startsWith = safeText(part?.startsWith || "");

      let line = `- Часть ${partNumber}: ~${partCharCount} символов`;
      if (startsWith) {
        line += `, начинается с: "${startsWith}"`;
      }
      lines.push(line);
    }

    if (parts.length > 6) {
      lines.push(`- ... ещё ${parts.length - 6} частей`);
    }
  }

  return lines.join("\n").trim();
}

export function buildEstimateFollowUpReplyText(
  record,
  requestedFocus = "general_estimate"
) {
  const estimate = record?.estimate || null;
  if (!estimate) return "";

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

  if (requestedFocus === "tokens") {
    return `Для ${fileName} это примерно ~${approxInputTokens} токенов текста. Оценка грубая: считаю примерно 1 токен ≈ 4 символа.`;
  }

  if (requestedFocus === "chars") {
    if (chunkSize > 0) {
      return `В ${fileName} около ${charCount} символов текста. При лимите ~${chunkSize} символов на часть это и даёт примерно ${chunkCount} частей.`;
    }
    return `В ${fileName} около ${charCount} символов текста.`;
  }

  if (requestedFocus === "largest_part") {
    if (largestPart.charCount > 0) {
      return `Самая большая часть у ${fileName} — №${largestPart.partNumber}, около ${largestPart.charCount} символов.`;
    }
    return `Не вижу достаточно данных по частям, чтобы уверенно назвать самую большую часть у ${fileName}.`;
  }

  if (requestedFocus === "file_vs_chat") {
    if (chunkCount <= 2) {
      return `Для ${fileName} выгоднее чат: частей мало, читать будет проще прямо в переписке.`;
    }
    return `Для ${fileName} выгоднее файл: частей около ${chunkCount}, длинная серия сообщений будет менее удобной.`;
  }

  if (requestedFocus === "chunk_count") {
    if (chunkCount <= 1) {
      return `Если выводить ${fileName} в чат, это примерно 1 сообщение.`;
    }
    return `Если выводить ${fileName} в чат, получится примерно ${chunkCount} частей.`;
  }

  if (requestedFocus === "parts_overview") {
    if (!parts.length) {
      return `По ${fileName} вижу общую оценку, но детальная разбивка по частям сейчас недоступна.`;
    }

    const lines = [`По ${fileName} примерно ${chunkCount} частей.`];

    for (const part of parts.slice(0, 6)) {
      lines.push(
        `- Часть ${Number(part?.partNumber || 0)}: ~${Number(
          part?.charCount || 0
        )} символов`
      );
    }

    if (parts.length > 6) {
      lines.push(`- ... ещё ${parts.length - 6} частей`);
    }

    return lines.join("\n").trim();
  }

  return buildEstimateReplyText(estimate);
}

export function saveSuccessfulEstimateContext({
  chatId,
  estimate,
  chatIdStr,
  messageId,
  reason,
}) {
  if (!estimate?.ok) return null;

  return saveActiveEstimateContext({
    chatId,
    estimate,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "document_chat_estimate"),
    },
  });
}

export default {
  buildEstimateReplyText,
  buildEstimateFollowUpReplyText,
  saveSuccessfulEstimateContext,
};