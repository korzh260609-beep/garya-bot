// AGENT NOTE:
// SG 2.0 Diagnostics Layer intent helper.
// Purpose: normalize structured intent produced by the understanding layer.
// Do not add keyword lists, phrase matching, transport commands, slash-command parsing, or direct Render/GitHub calls here.

function normalizeString(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeList(value) {
  return Array.isArray(value)
    ? value.map((item) => normalizeString(item)).filter(Boolean)
    : [];
}

function normalizeDiagnosticsIntent(intent = {}) {
  const raw = intent && typeof intent === "object" && !Array.isArray(intent) ? intent : {};
  const domain = normalizeString(raw.domain || raw.area || raw.scope);
  const action = normalizeString(raw.action || raw.intent || raw.operation);
  const target = normalizeString(raw.target || raw.object || raw.subject);
  const capability = normalizeString(raw.capability || raw.tool || raw.check || raw.diagnosticsCapability);
  const diagnosticsSuite = normalizeString(raw.diagnosticsSuite || raw.suite);
  const checks = normalizeList(raw.checks || raw.diagnosticsChecks);

  return {
    domain,
    action,
    target,
    capability,
    diagnosticsSuite,
    checks,
  };
}

function isDiagnosticsIntent(normalizedIntent = {}) {
  return Boolean(
    normalizedIntent.domain === "diagnostics"
    || normalizedIntent.action === "diagnose"
    || normalizedIntent.action === "check_status"
    || normalizedIntent.action === "inspect"
    || normalizedIntent.capability
    || normalizedIntent.diagnosticsSuite
    || normalizedIntent.checks.length > 0
  );
}

export function normalizeDiagnosticsText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function detectDiagnosticsIntent(input = {}) {
  const text = normalizeDiagnosticsText(input.text);
  const intent = normalizeDiagnosticsIntent(input.intent);
  const ok = isDiagnosticsIntent(intent);

  return {
    ok,
    reason: ok ? "structured_diagnostics_intent" : "no_structured_diagnostics_intent",
    confidence: ok ? 1 : 0,
    matchedHints: [],
    textObserved: Boolean(text),
    intent,
    routing: {
      source: "structured_intent",
      keywordMatchingUsed: false,
      phraseMatchingUsed: false,
    },
  };
}

export default {
  normalizeDiagnosticsText,
  detectDiagnosticsIntent,
};
