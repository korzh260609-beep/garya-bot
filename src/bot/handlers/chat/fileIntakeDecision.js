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

function buildEffectiveTextWithMediaContext({
  baseEffectiveText = "",
  mediaSummary = null,
  extractedText = "",
  visibleFactsText = "",
  extractionProviderKey = "",
  visibleFactsProviderKey = "",
  extractionError = "",
  visibleFactsError = "",
}) {
  const userPart = safeText(baseEffectiveText);
  const extractedPart = safeText(extractedText);
  const factsPart = safeText(visibleFactsText);
  const extractionProvider = safeText(extractionProviderKey);
  const factsProvider = safeText(visibleFactsProviderKey);
  const extractionErr = safeText(extractionError);
  const factsErr = safeText(visibleFactsError);

  const lines = [
    userPart,
    "",
    "[MEDIA_CONTEXT]",
    buildMediaAiContextNote(mediaSummary),
  ];

  if (extractionProvider) {
    lines.push(`OCR провайдер: ${extractionProvider}.`);
  }

  if (factsProvider) {
    lines.push(`Vision facts провайдер: ${factsProvider}.`);
  }

  if (extractedPart) {
    lines.push("Ниже текст, извлечённый специализированным OCR-маршрутом:");
    lines.push(extractedPart);
  } else if (extractionErr) {
    lines.push(`OCR текст не извлечён. Причина: ${extractionErr}.`);
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

          if (!shouldCallAI) {
            if (processedDirectUserHint) {
              directReplyText = processedDirectUserHint;
            }

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

          if (shouldCallAI) {
            directReplyText = null;

            effective = buildEffectiveTextWithMediaContext({
              baseEffectiveText: effective,
              mediaSummary,
              extractedText: processedExtractedText,
              visibleFactsText: processedVisibleFactsText,
              extractionProviderKey: processedExtractionProviderKey,
              visibleFactsProviderKey: processedVisibleFactsProviderKey,
              extractionError: processedExtractionError,
              visibleFactsError: processedVisibleFactsError,
            });
          }
        }
      } catch (error) {
        try {
          console.error("fileIntakeDecision runtime hook failed:", error);
        } catch (_) {
          // ignore
        }
        // fail-open: keep original base decision
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