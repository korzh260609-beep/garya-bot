// src/media/fileIntakeDecision.js
// ==================================================
// FILE-INTAKE EFFECTIVE USER TEXT + DECISION
// Purpose:
// - build effective text for AI
// - decide direct reply vs AI call
// ==================================================

import { safeStr } from "./fileIntakeCore.js";
import { buildStubMessage } from "./fileIntakeHints.js";
import { buildSpecializedAIRoutingRule } from "./fileIntakeRouting.js";

export function buildEffectiveUserTextAndDecision(userText, mediaSummary) {
  const trimmedText = safeStr(userText).trim();
  const captionText = safeStr(mediaSummary?.caption).trim();
  const effectiveText = trimmedText || captionText;

  const hasText = Boolean(effectiveText);

  if (!mediaSummary) {
    return {
      effectiveUserText: trimmedText,
      shouldCallAI: hasText,
      directReplyText: hasText ? null : "Напиши текстом, что нужно сделать.",
      decisionMeta: {
        hasText,
        hasMedia: false,
        shouldCallAI: hasText,
        reason: hasText ? "text_only" : "empty",
        aiRouting: null,
      },
    };
  }

  const stub = buildStubMessage(mediaSummary);
  const aiRouting = buildSpecializedAIRoutingRule(mediaSummary);

  if (!hasText) {
    return {
      effectiveUserText: "",
      shouldCallAI: false,
      directReplyText: stub,
      decisionMeta: {
        hasText,
        hasMedia: true,
        shouldCallAI: false,
        reason: "media_only_no_text",
        kind: mediaSummary.kind,
        aiRouting,
      },
    };
  }

  const mediaNote = (() => {
    if (mediaSummary.kind === "photo") {
      return "Вложение: фото. Специализированный маршрут: Vision-class. Generic AI видит только твой текст, не изображение напрямую.";
    }
    if (mediaSummary.kind === "document") {
      return `Вложение: документ (${mediaSummary.fileName || "file"}). Специализированный маршрут: Document-parse/OCR-class. Generic AI видит только твой текст, не файл.`;
    }
    if (mediaSummary.kind === "voice") {
      return "Вложение: голосовое. Специализированный маршрут: STT-class. Generic AI видит только твой текст, не аудио.";
    }
    if (mediaSummary.kind === "audio") {
      return "Вложение: аудио. Специализированный маршрут: STT-class. Generic AI видит только твой текст, не аудио.";
    }
    if (mediaSummary.kind === "video") {
      return "Вложение: видео. Специализированный маршрут: Video-extract-class. Generic AI видит только твой текст, не видео.";
    }
    return "Вложение: файл. Generic AI видит только твой текст, не binary payload.";
  })();

  return {
    effectiveUserText: `${effectiveText}\n\n(${mediaNote})`,
    shouldCallAI: true,
    directReplyText: null,
    decisionMeta: {
      hasText,
      hasMedia: true,
      shouldCallAI: true,
      reason: trimmedText ? "text_plus_media" : "caption_plus_media",
      kind: mediaSummary.kind,
      aiRouting,
    },
  };
}

export default {
  buildEffectiveUserTextAndDecision,
};