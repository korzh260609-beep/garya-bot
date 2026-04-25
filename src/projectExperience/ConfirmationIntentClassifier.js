// src/projectExperience/ConfirmationIntentClassifier.js
// ============================================================================
// STAGE C.6D — Confirmation Intent Classifier (TRANSPORT-AGNOSTIC SKELETON)
// Purpose:
// - classify user response to a pending project action as confirm/cancel/clarify/unknown
// - keep confirmation logic independent from Telegram commands
// - support natural language UX while avoiding blind execution
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO action execution
// - rule-based skeleton only; future version can use AI/semantic classifier
// ============================================================================

export const CONFIRMATION_INTENT = Object.freeze({
  CONFIRM: "confirm",
  CANCEL: "cancel",
  CLARIFY: "clarify",
  UNKNOWN: "unknown",
});

function safeText(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.!?,;:()\[\]{}"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(text = "", patterns = []) {
  return patterns.some((pattern) => pattern.test(text));
}

export class ConfirmationIntentClassifier {
  classify({ text = "", pendingAction = null } = {}) {
    const raw = safeText(text);
    const normalized = normalize(raw);

    if (!pendingAction) {
      return {
        intent: CONFIRMATION_INTENT.UNKNOWN,
        confidence: 0,
        reason: "no_pending_action",
      };
    }

    if (!normalized) {
      return {
        intent: CONFIRMATION_INTENT.UNKNOWN,
        confidence: 0,
        reason: "empty_text",
      };
    }

    const cancelSignal = containsAny(normalized, [
      /\bнет\b/u,
      /\bне надо\b/u,
      /\bотмена\b/u,
      /\bотмени\b/u,
      /\bстоп\b/u,
      /\bstop\b/u,
      /\bcancel\b/u,
      /\bdon'?t\b/u,
      /\bdo not\b/u,
    ]);

    if (cancelSignal) {
      return {
        intent: CONFIRMATION_INTENT.CANCEL,
        confidence: 0.8,
        reason: "cancel_signal",
      };
    }

    const clarifySignal = containsAny(normalized, [
      /\bобъясни\b/u,
      /\bпоясни\b/u,
      /\bуточни\b/u,
      /\bчто будет\b/u,
      /\bкакой риск\b/u,
      /\bпочему\b/u,
      /\bexplain\b/u,
      /\bwhy\b/u,
      /\brisk\b/u,
    ]);

    if (clarifySignal) {
      return {
        intent: CONFIRMATION_INTENT.CLARIFY,
        confidence: 0.7,
        reason: "clarify_signal",
      };
    }

    const confirmSignal = containsAny(normalized, [
      /\bда\b/u,
      /\bок\b/u,
      /\bокей\b/u,
      /\bподтверждаю\b/u,
      /\bсогласен\b/u,
      /\bделаем\b/u,
      /\bпродолжай\b/u,
      /\bвыполняй\b/u,
      /\byes\b/u,
      /\bok\b/u,
      /\bconfirm\b/u,
      /\bapproved\b/u,
      /\bgo ahead\b/u,
      /\bcontinue\b/u,
      /\bdo it\b/u,
    ]);

    if (confirmSignal) {
      return {
        intent: CONFIRMATION_INTENT.CONFIRM,
        confidence: 0.75,
        reason: "confirm_signal",
      };
    }

    return {
      intent: CONFIRMATION_INTENT.UNKNOWN,
      confidence: 0.2,
      reason: "no_clear_confirmation_intent",
    };
  }
}

export default {
  CONFIRMATION_INTENT,
  ConfirmationIntentClassifier,
};
