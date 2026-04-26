// src/core/meaningIntent/MeaningIntentBoundary.js
// ============================================================================
// STAGE 7A — Meaning / Intent Boundary skeleton
// Purpose:
// - validate already-produced structured meaning/intent results
// - provide a safe boundary before IntentActionRouter
// - keep normal SG conversation natural-language driven upstream
// - do NOT parse raw user text here
// - do NOT match keywords or fixed phrases here
// - do NOT call AI here
// - do NOT execute handlers here
// - do NOT connect to runtime here
// ============================================================================

export const MEANING_INTENT_BOUNDARY_VERSION = 1;

export const MEANING_INTENT_SOURCES = Object.freeze({
  AI: "ai",
  ROBOT: "robot",
  SYSTEM: "system",
  MANUAL_TEST: "manual_test",
});

export const MEANING_INTENT_STATUS = Object.freeze({
  ACCEPTED: "accepted",
  REJECTED: "rejected",
});

const DEFAULT_MIN_CONFIDENCE = 0.6;

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeIntentKey(value) {
  const text = safeText(value);
  return text || null;
}

function normalizeSource(value) {
  const text = safeText(value);

  if (Object.values(MEANING_INTENT_SOURCES).includes(text)) {
    return text;
  }

  return null;
}

function normalizeConfidence(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  if (n < 0) {
    return 0;
  }

  if (n > 1) {
    return 1;
  }

  return n;
}

function clonePlain(value) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (_e) {
    return null;
  }
}

function rejectDecision({ reason, input = null, intentKey = null, source = null, confidence = null } = {}) {
  return {
    ok: false,
    accepted: false,
    status: MEANING_INTENT_STATUS.REJECTED,
    reason: safeText(reason) || "rejected",
    intentKey: normalizeIntentKey(intentKey),
    source: normalizeSource(source),
    confidence: normalizeConfidence(confidence),
    rawTextUsed: false,
    phraseMatching: false,
    input: clonePlain(input),
    version: MEANING_INTENT_BOUNDARY_VERSION,
  };
}

function acceptDecision({ input, intentKey, source, confidence, metadata = {} } = {}) {
  return {
    ok: true,
    accepted: true,
    status: MEANING_INTENT_STATUS.ACCEPTED,
    reason: "accepted_structured_intent",
    intentKey: normalizeIntentKey(intentKey),
    source: normalizeSource(source),
    confidence: normalizeConfidence(confidence),
    rawTextUsed: false,
    phraseMatching: false,
    metadata: clonePlain(metadata) || {},
    input: clonePlain(input),
    version: MEANING_INTENT_BOUNDARY_VERSION,
  };
}

export class MeaningIntentBoundary {
  constructor({ minConfidence = DEFAULT_MIN_CONFIDENCE } = {}) {
    const n = normalizeConfidence(minConfidence);
    this.minConfidence = n === null ? DEFAULT_MIN_CONFIDENCE : n;
  }

  validate(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return rejectDecision({
        reason: "invalid_structured_input",
        input,
      });
    }

    if (input.rawTextUsed === true) {
      return rejectDecision({
        reason: "raw_text_not_allowed",
        input,
        intentKey: input.intentKey,
        source: input.source,
        confidence: input.confidence,
      });
    }

    if (input.phraseMatching === true || input.keywordMatching === true) {
      return rejectDecision({
        reason: "phrase_or_keyword_matching_not_allowed",
        input,
        intentKey: input.intentKey,
        source: input.source,
        confidence: input.confidence,
      });
    }

    const intentKey = normalizeIntentKey(input.intentKey || input.type);

    if (!intentKey) {
      return rejectDecision({
        reason: "missing_intent_key",
        input,
        source: input.source,
        confidence: input.confidence,
      });
    }

    const source = normalizeSource(input.source);

    if (!source) {
      return rejectDecision({
        reason: "invalid_intent_source",
        input,
        intentKey,
        confidence: input.confidence,
      });
    }

    const confidence = normalizeConfidence(input.confidence);

    if (confidence === null) {
      return rejectDecision({
        reason: "invalid_confidence",
        input,
        intentKey,
        source,
      });
    }

    if (confidence < this.minConfidence) {
      return rejectDecision({
        reason: "confidence_below_threshold",
        input,
        intentKey,
        source,
        confidence,
      });
    }

    return acceptDecision({
      input,
      intentKey,
      source,
      confidence,
      metadata: input.metadata,
    });
  }

  toRouterInput(decision = {}) {
    if (!decision || decision.accepted !== true || !decision.intentKey) {
      return null;
    }

    return {
      intentKey: decision.intentKey,
      intent: {
        intentKey: decision.intentKey,
        source: decision.source,
        confidence: decision.confidence,
        metadata: clonePlain(decision.metadata) || {},
      },
    };
  }

  status() {
    return {
      ok: true,
      version: MEANING_INTENT_BOUNDARY_VERSION,
      minConfidence: this.minConfidence,
      sources: Object.values(MEANING_INTENT_SOURCES),
      statuses: Object.values(MEANING_INTENT_STATUS),
      rawTextParsing: false,
      phraseMatching: false,
      runtimeConnected: false,
    };
  }
}

export default MeaningIntentBoundary;
