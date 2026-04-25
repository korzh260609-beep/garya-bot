// src/core/meaning/ContextContinuityEngine.js
// ============================================================================
// CORE MEANING — Context Continuity Engine (SKELETON)
// Purpose:
// - decide whether previous context is still relevant to the current message
// - prevent stale context from being used as a hard answer
// - allow context as a hint only when the new message logically continues it
// IMPORTANT:
// - NO DB writes
// - NO external calls
// - NO hardcoded final user replies
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function hasQuestionSignal(text = "") {
  const s = lower(text);
  return Boolean(
    s.includes("?") ||
    s.includes("какой") ||
    s.includes("какая") ||
    s.includes("какое") ||
    s.includes("какие") ||
    s.includes("который") ||
    s.includes("что именно") ||
    s.includes("уточни") ||
    s.includes("which") ||
    s.includes("what exactly")
  );
}

function hasTargetId(text = "") {
  const source = safeText(text);
  return Boolean(source.match(/(?:stage|этап)\s*([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i));
}

function hasExplicitContinuationSignal(text = "") {
  const s = lower(text);
  return Boolean(
    s.includes("этот") ||
    s.includes("его") ||
    s.includes("по нему") ||
    s.includes("продолж") ||
    s.includes("дальше") ||
    s.includes("that") ||
    s.includes("this") ||
    s.includes("continue")
  );
}

function hasDirectionChangeSignal(text = "") {
  const s = lower(text);
  return Boolean(
    s.includes("нет") ||
    s.includes("не то") ||
    s.includes("другое") ||
    s.includes("другой") ||
    s.includes("теперь") ||
    s.includes("новое") ||
    s.includes("вообще") ||
    s.includes("no") ||
    s.includes("not that") ||
    s.includes("another") ||
    s.includes("now")
  );
}

export class ContextContinuityEngine {
  analyze({ text = "", previousContext = null } = {}) {
    const hasPrevious = Boolean(previousContext);
    const questionSignal = hasQuestionSignal(text);
    const explicitTarget = hasTargetId(text);
    const continuationSignal = hasExplicitContinuationSignal(text);
    const directionChangeSignal = hasDirectionChangeSignal(text);

    let previousContextRelevant = hasPrevious && !directionChangeSignal;
    let contextStrength = hasPrevious ? "weak" : "none";
    let canUsePreviousTarget = false;
    let shouldAskClarification = false;
    const reasons = [];

    if (!hasPrevious) {
      reasons.push("no_previous_context");
    }

    if (directionChangeSignal) {
      previousContextRelevant = false;
      contextStrength = "stale";
      reasons.push("direction_change_signal");
    }

    if (explicitTarget) {
      contextStrength = "strong";
      canUsePreviousTarget = false;
      reasons.push("current_message_has_explicit_target");
    } else if (continuationSignal && hasPrevious && !directionChangeSignal) {
      contextStrength = "strong";
      canUsePreviousTarget = true;
      reasons.push("explicit_continuation_signal");
    } else if (questionSignal && !explicitTarget) {
      contextStrength = hasPrevious ? "weak" : "none";
      canUsePreviousTarget = false;
      shouldAskClarification = true;
      reasons.push("question_without_explicit_target");
    }

    return {
      ok: true,
      source: "ContextContinuityEngine",
      previousContextRelevant,
      contextStrength,
      directionChanged: directionChangeSignal,
      canUsePreviousTarget,
      shouldAskClarification,
      currentMessageHasExplicitTarget: explicitTarget,
      reasons,
      policy: {
        previousContextIsHintNotTruth: true,
        doNotUseWeakContextAsAnswer: true,
      },
    };
  }
}

export function analyzeContextContinuity(input = {}) {
  return new ContextContinuityEngine().analyze(input);
}

export default {
  ContextContinuityEngine,
  analyzeContextContinuity,
};
