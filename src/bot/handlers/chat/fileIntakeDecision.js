// src/bot/handlers/chat/fileIntakeDecision.js

function getFn(obj, name, fallback) {
  return typeof obj?.[name] === "function" ? obj[name] : fallback;
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
  // STAGE 11F + 12.x runtime hook
  // PURPOSE:
  // - connect download/process pipeline to real chat flow
  // - media-only path should prefer processFile().directUserHint when available
  // - fail-open on runtime errors
  // - cleanup tmp files after processing attempt
  // --------------------------------------------------------------------------
  if (mediaSummary && !shouldCallAI) {
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

          // ================================================================
          // CRITICAL RULE:
          // If runtime processing produced a direct user hint
          // (for example OCR result), it MUST override base stub.
          // ================================================================
          if (processedDirectUserHint) {
            directReplyText = processedDirectUserHint;
          }

          // Optional safety:
          // if some future processor wants to escalate to AI,
          // allow that only when it explicitly returns shouldCallAI=true.
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
      } catch (error) {
        try {
          console.error("fileIntakeDecision runtime hook failed:", error);
        } catch (_) {
          // ignore
        }
        // fail-open:
        // keep original directReplyText from base decision
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