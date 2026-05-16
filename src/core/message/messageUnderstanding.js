// AGENT NOTE:
// SG 2.0 message understanding skeleton.
// Purpose: normalize already-structured understanding output before deterministic routes.
// This file must not infer intent from raw text, use keyword lists, phrase matching, AI calls, tool calls, transport commands, memory writes, DB writes, or source sync.

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function getRawIntent(context = {}) {
  if (context.intent && typeof context.intent === "object" && !Array.isArray(context.intent)) {
    return context.intent;
  }

  if (
    context.runtimeOptions?.intent
    && typeof context.runtimeOptions.intent === "object"
    && !Array.isArray(context.runtimeOptions.intent)
  ) {
    return context.runtimeOptions.intent;
  }

  if (
    context.understanding?.intent
    && typeof context.understanding.intent === "object"
    && !Array.isArray(context.understanding.intent)
  ) {
    return context.understanding.intent;
  }

  return null;
}

export function normalizeMessageIntent(intent = null) {
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) {
    return null;
  }

  return {
    domain: normalizeString(intent.domain || intent.area || intent.scope),
    action: normalizeString(intent.action || intent.intent || intent.operation),
    target: normalizeString(intent.target || intent.object || intent.subject),
    capability: normalizeString(intent.capability || intent.tool || intent.check || intent.diagnosticsCapability),
    diagnosticsSuite: normalizeString(intent.diagnosticsSuite || intent.suite),
    checks: normalizeList(intent.checks || intent.diagnosticsChecks),
    source: normalizeString(intent.source) || "external_structured_intent",
  };
}

export function buildMessageUnderstandingContext(context = {}) {
  const rawIntent = getRawIntent(context);
  const intent = normalizeMessageIntent(rawIntent);
  const hasStructuredIntent = Boolean(intent);

  return {
    ok: true,
    type: "message_understanding_context",
    version: 1,
    mode: "structured_intent_passthrough",
    hasStructuredIntent,
    intent,
    routing: {
      source: hasStructuredIntent ? "structured_intent" : "none",
      keywordMatchingUsed: false,
      phraseMatchingUsed: false,
      aiInferenceUsed: false,
    },
    safety: {
      readOnly: true,
      noTextInference: true,
      noKeywordMatching: true,
      noPhraseMatching: true,
      noAiCall: true,
      noToolCall: true,
      noDbMutation: true,
      noMemoryWrite: true,
      noTransportCommand: true,
    },
  };
}

export default {
  normalizeMessageIntent,
  buildMessageUnderstandingContext,
};
