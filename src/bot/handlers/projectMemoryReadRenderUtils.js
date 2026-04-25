// src/bot/handlers/projectMemoryReadRenderUtils.js
// ============================================================================
// Project Memory read/render utilities
// Purpose:
// - keep repeated read/render helpers out of Telegram command handlers
// - keep handlers thinner
// - preserve existing behavior 1:1
// - no DB calls
// - no writes
// ============================================================================

export function safeText(value) {
  return String(value ?? "").trim();
}

export function formatDateTimeLegacy(value) {
  if (!value) return "unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export function formatDateTime(value, timezone = "UTC") {
  if (!value) return "unknown";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  try {
    return new Intl.DateTimeFormat("uk-UA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(d)
      .replace(",", "");
  } catch (_) {
    return formatDateTimeLegacy(d);
  }
}

export function extractBlockLines(content = "", blockName = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const target = safeText(blockName).toUpperCase() + ":";

  let inBlock = false;
  const out = [];

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const trimmed = line.trim();

    if (!inBlock) {
      if (trimmed.toUpperCase() === target) {
        inBlock = true;
      }
      continue;
    }

    if (!trimmed) continue;

    if (/^[A-Z_ ]+:$/.test(trimmed)) {
      break;
    }

    out.push(trimmed.replace(/^[-*•]\s*/, ""));
  }

  return out;
}

export function extractFirstBlockLine(content = "", blockName = "") {
  const lines = String(content ?? "").split(/\r?\n/);
  const target = safeText(blockName).toUpperCase() + ":";

  let inBlock = false;
  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const trimmed = line.trim();

    if (!inBlock) {
      if (trimmed.toUpperCase() === target) {
        inBlock = true;
      }
      continue;
    }

    if (!trimmed) continue;

    if (/^[A-Z_ ]+:$/.test(trimmed)) {
      break;
    }

    return trimmed.replace(/^[-*•]\s*/, "");
  }

  return "";
}

export function firstOrEmpty(arr) {
  return Array.isArray(arr) && arr.length ? safeText(arr[0]) : "";
}

export function filterSessionsByModuleStage(rows, { moduleKey, stageKey }) {
  return rows.filter((row) => {
    if (moduleKey && safeText(row.module_key) !== moduleKey) {
      return false;
    }

    if (stageKey && safeText(row.stage_key) !== stageKey) {
      return false;
    }

    return true;
  });
}

export function buildFilterLabel({ moduleKey, stageKey }) {
  const parts = [];

  if (moduleKey) parts.push(`module=${moduleKey}`);
  if (stageKey) parts.push(`stage=${stageKey}`);

  return parts.length ? ` [${parts.join(", ")}]` : "";
}

export default {
  safeText,
  formatDateTimeLegacy,
  formatDateTime,
  extractBlockLines,
  extractFirstBlockLine,
  firstOrEmpty,
  filterSessionsByModuleStage,
  buildFilterLabel,
};
