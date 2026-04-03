// src/bot/handlers/chat/fileIntakeDecision.js

import { resolveDocumentFollowupIntent } from "./documentFollowupIntentResolver.js";

function getFn(obj, name, fallback) {
  return typeof obj?.[name] === "function" ? obj[name] : fallback;
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function wordCount(value) {
  const text = safeText(value);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function normalizeWhitespace(value) {
  return safeText(value).replace(/\s+/g, " ").trim();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isLikelyShortMediaQuestion(value) {
  const text = safeText(value);
  if (!text) return false;

  const words = wordCount(text);
  const hasQuestionMark = text.includes("?");
  const shortEnough = text.length <= 80 && words <= 8;

  return hasQuestionMark || shortEnough;
}

function resolveMediaResponseMode({
  baseEffectiveText = "",
  mediaSummary = null,
}) {
  const text = safeText(baseEffectiveText);
  const kind = safeText(mediaSummary?.kind || "unknown");

  if (!mediaSummary) {
    return null;
  }

  if (kind === "photo" && text && isLikelyShortMediaQuestion(text)) {
    return "short_object_answer";
  }

  if (kind === "document" && !text) {
    return "document_summary_answer";
  }

  if (kind === "document") {
    return "document_summary_answer";
  }

  return null;
}

function buildMediaAiContextNote(mediaSummary) {
  const kind = safeText(mediaSummary?.kind || "unknown");

  if (kind === "photo") {
    return "Специализированное извлечение: OCR/Vision + visible facts для фото.";
  }

  if (kind === "document") {
    return `Специализированное извлечение: parser/OCR для документа (${safeText(
      mediaSummary?.fileName || "file"
    )}).`;
  }

  if (kind === "voice") {
    return "Специализированное извлечение: STT для голосового сообщения.";
  }

  if (kind === "audio") {
    return "Специализированное извлечение: STT для аудио.";
  }

  if (kind === "video") {
    return "Специализированное извлечение: video/audio extraction.";
  }

  return "Специализированное извлечение: media handler.";
}

function buildResponseStyleDirective({
  baseEffectiveText = "",
  mediaSummary = null,
  mediaResponseMode = null,
}) {
  const text = safeText(baseEffectiveText);
  const kind = safeText(mediaSummary?.kind || "unknown");

  const lines = ["[RESPONSE_STYLE]"];

  if (kind === "photo" && isLikelyShortMediaQuestion(text)) {
    lines.push(
      "Если запрос пользователя простой и короткий про изображение, сначала дай 1 короткий прямой ответ в первом предложении."
    );
    lines.push(
      "Затем, только если нужно, добавь 1 короткое уточнение о неуверенности или видимых признаках."
    );
    lines.push(
      "Не делай длинные списки и не расписывай лишние детали без необходимости."
    );
  } else if (mediaResponseMode === "document_summary_answer") {
    lines.push(
      "Для документа сначала дай только общий смысл и краткую сводку."
    );
    lines.push(
      "Не вставляй весь документ целиком без явного запроса пользователя."
    );
    lines.push(
      "Используй не только сырой текст, но и структурные признаки документа: title, headings, stats, blocks — если они есть."
    );
    lines.push(
      "Добавь короткую подсказку, что пользователь может попросить полный текст или вывод частями."
    );
  } else if (mediaResponseMode === "document_full_text_answer") {
    lines.push("Пользователь просит полный текст документа.");
    lines.push(
      "Если текст не вмещается в один ответ, отдай только первую часть и явно скажи написать 'продолжай' для следующей части."
    );
    lines.push("Не заменяй полный текст кратким пересказом.");
  } else {
    lines.push(
      "Опирайся на специализированный media-контекст и отвечай по существу."
    );
    lines.push(
      "Не раздувай ответ без необходимости. Сначала вывод, потом короткое пояснение."
    );
  }

  lines.push("[/RESPONSE_STYLE]");

  return lines.join("\n");
}

function normalizeDocumentStats(stats = null) {
  if (!stats || typeof stats !== "object") return null;

  return {
    charCount: safeNumber(stats?.charCount, 0),
    wordCount: safeNumber(stats?.wordCount, 0),
    paragraphCount: safeNumber(stats?.paragraphCount, 0),
    blockCount: safeNumber(stats?.blockCount, 0),
    headingCount: safeNumber(stats?.headingCount, 0),
  };
}

function normalizeDocumentHeadings(headings = []) {
  if (!Array.isArray(headings)) return [];

  return headings
    .map((item) => ({
      index: safeNumber(item?.index, 0),
      type: safeText(item?.type || "heading"),
      text: safeText(item?.text || ""),
    }))
    .filter((item) => item.text);
}

function normalizeDocumentBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return [];

  return blocks
    .map((item) => ({
      index: safeNumber(item?.index, 0),
      type: safeText(item?.type || "paragraph"),
      preview: safeText(item?.preview || ""),
      wordCount: safeNumber(item?.wordCount, 0),
      charCount: safeNumber(item?.charCount, 0),
    }))
    .filter((item) => item.preview);
}

function buildEffectiveTextWithMediaContext({
  baseEffectiveText = "",
  mediaSummary = null,
  mediaResponseMode = null,
  extractedText = "",
  visibleFactsText = "",
  extractionProviderKey = "",
  visibleFactsProviderKey = "",
  extractionError = "",
  visibleFactsError = "",
  documentTitle = "",
  documentStats = null,
  documentHeadings = [],
  documentBlocks = [],
  documentStructureVersion = null,
  documentStructureSource = "",
}) {
  const userPart = safeText(baseEffectiveText);
  const extractedPart = safeText(extractedText);
  const factsPart = safeText(visibleFactsText);
  const extractionProvider = safeText(extractionProviderKey);
  const factsProvider = safeText(visibleFactsProviderKey);
  const extractionErr = safeText(extractionError);
  const factsErr = safeText(visibleFactsError);

  const normalizedDocumentTitle = safeText(documentTitle);
  const normalizedDocumentStats = normalizeDocumentStats(documentStats);
  const normalizedDocumentHeadings = normalizeDocumentHeadings(documentHeadings);
  const normalizedDocumentBlocks = normalizeDocumentBlocks(documentBlocks);
  const normalizedStructureSource = safeText(documentStructureSource);
  const normalizedStructureVersion = safeNumber(documentStructureVersion, 0);

  const lines = [
    userPart,
    "",
    buildResponseStyleDirective({
      baseEffectiveText: userPart,
      mediaSummary,
      mediaResponseMode,
    }),
    "",
    "[MEDIA_CONTEXT]",
    buildMediaAiContextNote(mediaSummary),
  ];

  if (mediaResponseMode) {
    lines.push(`Media response mode: ${mediaResponseMode}.`);
  }

  if (extractionProvider) {
    lines.push(`OCR/Text extraction провайдер: ${extractionProvider}.`);
  }

  if (factsProvider) {
    lines.push(`Vision facts провайдер: ${factsProvider}.`);
  }

  if (normalizedDocumentTitle) {
    lines.push(`Название/заголовок документа: ${normalizedDocumentTitle}`);
  }

  if (normalizedDocumentStats) {
    lines.push(
      `Статистика документа: words=${normalizedDocumentStats.wordCount}, chars=${normalizedDocumentStats.charCount}, paragraphs=${normalizedDocumentStats.paragraphCount}, blocks=${normalizedDocumentStats.blockCount}, headings=${normalizedDocumentStats.headingCount}.`
    );
  }

  if (normalizedStructureVersion > 0 || normalizedStructureSource) {
    lines.push(
      `Структура документа: version=${normalizedStructureVersion || "n/a"}, source=${normalizedStructureSource || "n/a"}.`
    );
  }

  if (normalizedDocumentHeadings.length > 0) {
    lines.push("Ниже ключевые заголовки документа:");
    for (const heading of normalizedDocumentHeadings.slice(0, 12)) {
      lines.push(
        `- [${heading.index}] (${heading.type || "heading"}) ${heading.text}`
      );
    }
  }

  if (normalizedDocumentBlocks.length > 0) {
    lines.push("Ниже краткие previews блоков документа:");
    for (const block of normalizedDocumentBlocks.slice(0, 12)) {
      lines.push(
        `- [${block.index}] (${block.type || "paragraph"}) ${block.preview}`
      );
    }
  }

  if (extractedPart) {
    lines.push("Ниже текст, извлечённый специализированным маршрутом:");
    lines.push(extractedPart);
  } else if (extractionErr) {
    lines.push(`Текст не извлечён. Причина: ${extractionErr}.`);
  }

  if (factsPart) {
    lines.push("");
    lines.push("Ниже краткие видимые факты по изображению:");
    lines.push(factsPart);
  } else if (factsErr) {
    lines.push(`Vision facts недоступны. Причина: ${factsErr}.`);
  }

  lines.push(
    "Важно: generic AI не видел binary/media напрямую и отвечает только по тексту пользователя и подготовленному специализированному контексту."
  );
  lines.push("[/MEDIA_CONTEXT]");

  return lines.filter(Boolean).join("\n");
}

async function resolveSemanticDocumentMode({
  callAI,
  userText,
  hasRecentDocument = false,
  hasAttachedDocument = false,
  fallbackMode = "document_summary_answer",
}) {
  const resolved = await resolveDocumentFollowupIntent({
    callAI,
    userText,
    hasRecentDocument,
    hasAttachedDocument,
  });

  if (!resolved?.isDocumentIntent) {
    return {
      isDocumentIntent: false,
      mediaResponseMode: fallbackMode,
      needsClarification: false,
      clarificationQuestion: "",
      confidence: 0,
      reason: resolved?.reason || "no_document_intent",
    };
  }

  if (resolved?.needsClarification) {
    return {
      isDocumentIntent: true,
      mediaResponseMode: "document_summary_answer",
      needsClarification: true,
      clarificationQuestion:
        safeText(resolved?.clarificationQuestion) ||
        "Уточни: нужен общий смысл или полный текст документа?",
      confidence: resolved?.confidence ?? 0,
      reason: resolved?.reason || "clarification_needed",
    };
  }

  return {
    isDocumentIntent: true,
    mediaResponseMode:
      resolved?.responseMode === "document_full_text_answer"
        ? "document_full_text_answer"
        : "document_summary_answer",
    needsClarification: false,
    clarificationQuestion: "",
    confidence: resolved?.confidence ?? 0,
    reason: resolved?.reason || "resolved",
  };
}

export async function resolveFileIntakeDecision({
  FileIntake,
  msg,
  trimmed,
  telegramBotToken = "",
  callAI = null,
}) {
  const summarizeMediaAttachment = getFn(
    FileIntake,
    "summarizeMediaAttachment",
    () => null
  );

  const mediaSummary = summarizeMediaAttachment(msg);

  const decisionFn = getFn(
    FileIntake,
    "buildEffectiveUserTextAndDecision",
    null
  );

  const baseDecision = decisionFn
    ? decisionFn(trimmed, mediaSummary)
    : {
        effectiveUserText: trimmed,
        shouldCallAI: Boolean(trimmed),
        directReplyText: Boolean(trimmed)
          ? null
          : "Напиши текстом, что нужно сделать.",
      };

  let effective = safeText(baseDecision?.effectiveUserText || "");
  let shouldCallAI = Boolean(baseDecision?.shouldCallAI);
  let directReplyText = baseDecision?.directReplyText || null;

  let mediaResponseMode = resolveMediaResponseMode({
    baseEffectiveText: effective,
    mediaSummary,
  });

  if (!mediaSummary && trimmed) {
    const getRecentDocumentSessionCache = getFn(
      FileIntake,
      "getRecentDocumentSessionCache",
      null
    );

    const recentDocumentCache = getRecentDocumentSessionCache
      ? getRecentDocumentSessionCache(msg?.chat?.id ?? null)
      : null;

    if (recentDocumentCache) {
      const semanticDocumentMode = await resolveSemanticDocumentMode({
        callAI,
        userText: trimmed,
        hasRecentDocument: true,
        hasAttachedDocument: false,
        fallbackMode: "document_summary_answer",
      });

      if (semanticDocumentMode?.needsClarification) {
        return {
          summarizeMediaAttachment,
          mediaSummary: null,
          mediaResponseMode: "document_summary_answer",
          decision: baseDecision,
          effective: "",
          shouldCallAI: false,
          directReplyText: semanticDocumentMode.clarificationQuestion,
        };
      }

      if (semanticDocumentMode?.isDocumentIntent) {
        const pseudoDocumentSummary = {
          kind: "document",
          fileName: recentDocumentCache?.fileName || "document",
        };

        mediaResponseMode = semanticDocumentMode.mediaResponseMode;
        shouldCallAI = true;
        directReplyText = null;

        effective = buildEffectiveTextWithMediaContext({
          baseEffectiveText: trimmed,
          mediaSummary: pseudoDocumentSummary,
          mediaResponseMode,
          extractedText: safeText(recentDocumentCache?.text || ""),
          visibleFactsText: "",
          extractionProviderKey: "document_text",
          visibleFactsProviderKey: "",
          extractionError: "",
          visibleFactsError: "",
          documentTitle: safeText(recentDocumentCache?.title || ""),
          documentStats: recentDocumentCache?.stats || null,
          documentHeadings: Array.isArray(recentDocumentCache?.headings)
            ? recentDocumentCache.headings
            : [],
          documentBlocks: Array.isArray(recentDocumentCache?.blocks)
            ? recentDocumentCache.blocks
            : [],
          documentStructureVersion:
            recentDocumentCache?.structureVersion ?? null,
          documentStructureSource: safeText(
            recentDocumentCache?.structureSource || ""
          ),
        });
      }
    }
  }

  if (mediaSummary) {
    const intakeAndDownloadIfNeeded = getFn(
      FileIntake,
      "intakeAndDownloadIfNeeded",
      null
    );
    const processFile = getFn(FileIntake, "processFile", null);
    const cleanupIntakeTempFiles = getFn(
      FileIntake,
      "cleanupIntakeTempFiles",
      null
    );

    if (intakeAndDownloadIfNeeded && processFile && telegramBotToken) {
      let intake = null;

      try {
        intake = await intakeAndDownloadIfNeeded(msg, telegramBotToken);

        if (intake) {
          const processed = await processFile(intake);

          const processedDirectUserHint = safeText(
            processed?.directUserHint || ""
          );

          const processedEffectiveText = safeText(
            processed?.effectiveUserText || processed?.processedText || ""
          );

          const processedShouldCallAI = processed?.shouldCallAI === true;

          const processedExtractedText = safeText(
            processed?.extractedText || ""
          );

          const processedVisibleFactsText = safeText(
            processed?.visibleFactsText || ""
          );

          const processedExtractionError = safeText(
            processed?.extractionError || ""
          );

          const processedVisibleFactsError = safeText(
            processed?.visibleFactsError || ""
          );

          const processedExtractionProviderKey = safeText(
            processed?.extractionProviderKey || ""
          );

          const processedVisibleFactsProviderKey = safeText(
            processed?.visibleFactsProviderKey || ""
          );

          const processedDocumentTitle = safeText(
            processed?.documentTitle || ""
          );

          const processedDocumentStats = processed?.documentStats || null;

          const processedDocumentHeadings = Array.isArray(
            processed?.documentHeadings
          )
            ? processed.documentHeadings
            : [];

          const processedDocumentBlocks = Array.isArray(
            processed?.documentBlocks
          )
            ? processed.documentBlocks
            : [];

          const processedDocumentStructureVersion =
            processed?.documentStructureVersion ?? null;

          const processedDocumentStructureSource = safeText(
            processed?.documentStructureSource || ""
          );

          if (!shouldCallAI) {
            if (processedDirectUserHint) {
              directReplyText = processedDirectUserHint;
            }

            if (processedShouldCallAI) {
              shouldCallAI = true;

              if (processedEffectiveText) {
                effective = processedEffectiveText;
              }

              directReplyText = null;

              mediaResponseMode = resolveMediaResponseMode({
                baseEffectiveText: trimmed || processedEffectiveText,
                mediaSummary,
              });
            }
          }

          if (
            mediaSummary?.kind === "document" &&
            trimmed &&
            processedExtractedText
          ) {
            const semanticDocumentMode = await resolveSemanticDocumentMode({
              callAI,
              userText: trimmed,
              hasRecentDocument: true,
              hasAttachedDocument: true,
              fallbackMode: mediaResponseMode || "document_summary_answer",
            });

            if (semanticDocumentMode?.needsClarification) {
              return {
                summarizeMediaAttachment,
                mediaSummary,
                mediaResponseMode: "document_summary_answer",
                decision: baseDecision,
                effective: "",
                shouldCallAI: false,
                directReplyText: semanticDocumentMode.clarificationQuestion,
              };
            }

            if (semanticDocumentMode?.isDocumentIntent) {
              mediaResponseMode = semanticDocumentMode.mediaResponseMode;
              shouldCallAI = true;
              directReplyText = null;
            }
          }

          if (shouldCallAI) {
            directReplyText = null;

            effective = buildEffectiveTextWithMediaContext({
              baseEffectiveText: effective,
              mediaSummary,
              mediaResponseMode,
              extractedText: processedExtractedText,
              visibleFactsText: processedVisibleFactsText,
              extractionProviderKey: processedExtractionProviderKey,
              visibleFactsProviderKey: processedVisibleFactsProviderKey,
              extractionError: processedExtractionError,
              visibleFactsError: processedVisibleFactsError,
              documentTitle: processedDocumentTitle,
              documentStats: processedDocumentStats,
              documentHeadings: processedDocumentHeadings,
              documentBlocks: processedDocumentBlocks,
              documentStructureVersion: processedDocumentStructureVersion,
              documentStructureSource: processedDocumentStructureSource,
            });
          }
        }
      } catch (error) {
        try {
          console.error("fileIntakeDecision runtime hook failed:", error);
        } catch (_) {
          // ignore
        }
      } finally {
        if (intake && cleanupIntakeTempFiles) {
          try {
            cleanupIntakeTempFiles(intake);
          } catch (cleanupError) {
            try {
              console.error("fileIntakeDecision cleanup failed:", cleanupError);
            } catch (_) {
              // ignore
            }
          }
        }
      }
    }
  }

  return {
    summarizeMediaAttachment,
    mediaSummary,
    mediaResponseMode,
    decision: baseDecision,
    effective,
    shouldCallAI,
    directReplyText,
  };
}

export default {
  resolveFileIntakeDecision,
};