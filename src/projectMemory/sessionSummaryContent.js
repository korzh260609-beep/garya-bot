// src/projectMemory/sessionSummaryContent.js
// ============================================================================
// Project Memory session_summary content builder
// Purpose:
// - single canonical formatter for session_summary content
// - keep create/update output consistent
// - preserve backward compatibility with read-flow parsers
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];

  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = safeText(item);
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function pushBlock(lines, title, items = []) {
  const normalizedItems = normalizeStringArray(items);

  lines.push(`${title}:`);

  if (!normalizedItems.length) {
    lines.push("- none");
    lines.push("");
    return;
  }

  for (const item of normalizedItems) {
    lines.push(`- ${item}`);
  }

  lines.push("");
}

export function buildSessionSummaryContent({
  goal = "",
  checked = [],
  changed = [],
  decisions = [],
  risks = [],
  nextSteps = [],
  notes = [],
} = {}) {
  const resolvedGoal = safeText(goal);

  if (!resolvedGoal) {
    throw new Error("buildSessionSummaryContent: goal is required");
  }

  const lines = [];

  lines.push("GOAL:");
  lines.push(`- ${resolvedGoal}`);
  lines.push("");

  pushBlock(lines, "CHECKED", checked);
  pushBlock(lines, "CHANGED", changed);
  pushBlock(lines, "DECISIONS", decisions);
  pushBlock(lines, "RISKS", risks);
  pushBlock(lines, "NEXT", nextSteps);
  pushBlock(lines, "NOTES", notes);

  return lines.join("\n").trim();
}

export function isStructuredSessionSummaryInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Boolean(
    safeText(value.goal) ||
    (Array.isArray(value.checked) && value.checked.length) ||
    (Array.isArray(value.changed) && value.changed.length) ||
    (Array.isArray(value.decisions) && value.decisions.length) ||
    (Array.isArray(value.risks) && value.risks.length) ||
    (Array.isArray(value.nextSteps) && value.nextSteps.length) ||
    (Array.isArray(value.notes) && value.notes.length)
  );
}

export default {
  buildSessionSummaryContent,
  isStructuredSessionSummaryInput,
};