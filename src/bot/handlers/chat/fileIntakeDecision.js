// src/bot/handlers/chat/fileIntakeDecision.js

function getFn(obj, name, fallback) {
  return typeof obj?.[name] === "function" ? obj[name] : fallback;
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function buildMediaAiContextNote(mediaSummary) {
  const kind = safeText(mediaSummary?.kind || "unknown");

  if (kind === "photo") {
    return "Специализированное извлечение: OCR/Vision для фото.";
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

function buildEffectiveTextWithExtractedMedia({
  baseEffectiveText = "",
  mediaSummary = null,
  extractedText = "",
  extractionProviderKey = "",
}) {
  const userPart = safeText(baseEffectiveText);
  const extractedPart = safeText(extractedText);
  const providerPart = safeText(extractionProviderKey || "");

  const mediaContextNote = buildMediaAiContextNote(mediaSummary);

  const providerLine = providerPart
    ? `Провайдер извлечения: ${providerPart}.`
    : null;

  return [
    userPart,
    "",
    "[MEDIA_CONTEXT]",
    mediaContextNote,
    providerLine,
    "Ниже текст, извлечённый специализированным media-маршрутом:",
    extractedPart,
    "[/MEDIA_CONTEXT]",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildEffectiveTextWithUnavailableExtraction({
  baseEffectiveText = "",
  mediaSummary = null,
  extractionError = "",
}) {
  const userPart = safeText(baseEffectiveText);
  const mediaContextNote = buildMediaAiContextNote(mediaSummary);
  const errorText = safeText(extractionError || "specialized_extraction_unavailable");

  return [
    userPart,
    "",
    "[MEDIA_CONTEXT]",
    mediaContextNote,
    "Специализированное извлечение было запрошено, но не дало текста.",
    `Причина: ${errorText}.`,
    "Важно: generic AI не видел binary/media напрямую и отвечает только по тексту пользователя и доступному текстовому контексту.",
    "[/MEDIA_CONTEXT]",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolveFileIntakeDecision({
  FileIntake,
  msg,
  trimmed,
  telegramBotToken = "",
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

  // --------------------------------------------------------------------------
  // STAGE 12.x runtime hook
  // PURPOSE:
  // - media-only path: prefer processFile().directUserHint when available
  // - media+text path: specialized extraction first, then AI gets extracted text
  // - no phrase-based routing; decision is based on message shape + semantics
  // - fail-open on runtime errors
  // - cleanup tmp files after processing attempt
  // --------------------------------------------------------------------------
  if (mediaSummary) {
    const intakeAndDownloadIfNeeded = getFn(
      FileIntake,
      "intakeAndDownloadIfNeeded",
      null
    );
    const processFile = getFn(
      FileIntake,
      "processFile",
      null
    );
    const cleanupIntakeTempFiles = getFn(
      FileIntake,
      "cleanupIntakeTempFiles",
      null
    );

    if (
      intakeAndDownloadIfNeeded &&
      processFile &&
      telegramBotToken
    ) {
      let intake = null;

      try {
        intake = await intakeAndDownloadIfNeeded(
          msg,
          telegramBotToken
        );

        if (intake) {
          const processed = await processFile(intake);

          const processedDirectUserHint = safeText(
            processed?.directUserHint || ""
          );

          const processedExtractedText = safeText(
            processed?.extractedText || ""
          );

          const processedExtractionAvailable =
            processed?.extractionAvailable === true &&
            Boolean(processedExtractedText);

          const processedExtractionError = safeText(
            processed?.extractionError || ""
          );

          const processedExtractionProviderKey = safeText(
            processed?.extractionProviderKey || ""
          );

          // ================================================================
          // PATH A — MEDIA ONLY
          // ================================================================
          if (!shouldCallAI) {
            if (processedDirectUserHint) {
              directReplyText = processedDirectUserHint;
            }

            // Optional future path:
            // if processor explicitly requests AI escalation, allow it.
            if (processed && processed.shouldCallAI === true) {
              shouldCallAI = true;

              const processedEffectiveText = safeText(
                processed.effectiveUserText || processed.processedText || ""
              );

              if (processedEffectiveText) {
                effective = processedEffectiveText;
              }

              if (!processedDirectUserHint) {
                directReplyText = null;
              }
            }
          }

          // ================================================================
          // PATH B — MEDIA + USER TEXT/CAPTION
          // RULE:
          // - no keyword matching
          // - if user already asked something in text, we do specialized
          //   extraction first and feed the extracted result into AI context
          // ================================================================
          if (shouldCallAI) {
            directReplyText = null;

            if (processedExtractionAvailable) {
              effective = buildEffectiveTextWithExtractedMedia({
                baseEffectiveText: effective,
                mediaSummary,
                extractedText: processedExtractedText,
                extractionProviderKey: processedExtractionProviderKey,
              });
            } else {
              effective = buildEffectiveTextWithUnavailableExtraction({
                baseEffectiveText: effective,
                mediaSummary,
                extractionError: processedExtractionError,
              });
            }
          }
        }
      } catch (error) {
        try {
          console.error("fileIntakeDecision runtime hook failed:", error);
        } catch (_) {
          // ignore
        }
        // fail-open:
        // keep original base decision
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
    decision: baseDecision,
    effective,
    shouldCallAI,
    directReplyText,
  };
}

export default {
  resolveFileIntakeDecision,
};