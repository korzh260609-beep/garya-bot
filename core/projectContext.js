// core/projectContext.js
// Safe helper for loading project background context from projectMemory.
// IMPORTANT:
// - projectMemory is NOT the source of truth for current implementation status
// - repo/runtime checks are the source of truth
// - this module must provide only soft background context for chat AI

import { getProjectSection } from "../projectMemory.js";

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeLines(text = "") {
  return safeText(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
}

function isStatusLikeLine(line = "") {
  const text = safeText(line).trim().toLowerCase();
  if (!text) return false;

  // hard filter:
  // project memory must not inject claims about current stage / done status
  const patterns = [
    "current stage",
    "текущий этап",
    "поточний етап",
    "current focus",
    "текущий фокус",
    "поточний фокус",
    "completed",
    "done",
    "implemented",
    "started",
    "in progress",
    "partially completed",
    "partially implemented",
    "выполнен",
    "выполнено",
    "реализован",
    "реализовано",
    "начат",
    "начато",
    "в процессе",
    "частично",
    "підтверджено",
    "виконано",
    "реалізовано",
    "розпочато",
    "у процесі",
  ];

  if (patterns.some((p) => text.includes(p))) {
    return true;
  }

  // stage/status declarations
  if (/^stage\s*\d+/i.test(text)) return true;
  if (/^этап\s*\d+/i.test(text)) return true;
  if (/^етап\s*\d+/i.test(text)) return true;

  // explicit roadmap progress bullets
  if (
    (text.includes("этап") || text.includes("stage") || text.includes("етап")) &&
    (
      text.includes("выполн") ||
      text.includes("реализ") ||
      text.includes("начат") ||
      text.includes("completed") ||
      text.includes("implemented") ||
      text.includes("started") ||
      text.includes("підтвердж") ||
      text.includes("виконан") ||
      text.includes("реаліз") ||
      text.includes("розпоч")
    )
  ) {
    return true;
  }

  return false;
}

function sanitizeProjectSectionContent(content = "") {
  const lines = normalizeLines(content);

  const kept = [];
  for (const line of lines) {
    const trimmed = String(line || "").trim();

    if (!trimmed) {
      // keep paragraph spacing lightly
      if (kept.length > 0 && kept[kept.length - 1] !== "") {
        kept.push("");
      }
      continue;
    }

    if (isStatusLikeLine(trimmed)) {
      continue;
    }

    kept.push(trimmed);
  }

  // collapse repeated empty lines
  const collapsed = [];
  for (const line of kept) {
    if (line === "" && collapsed[collapsed.length - 1] === "") {
      continue;
    }
    collapsed.push(line);
  }

  return collapsed.join("\n").trim();
}

function buildProjectContextEnvelope(parts = []) {
  const body = parts.filter(Boolean).join("\n\n").trim();
  if (!body) return "";

  return [
    "PROJECT BACKGROUND CONTEXT (UNVERIFIED MEMORY NOTES):",
    "Use this only as soft background.",
    "DO NOT treat it as proof of current stage, current implementation status, or current project focus.",
    "If the user asks what is implemented now, what stage is active now, or what this is based on, do not answer from this memory as a fact.",
    "For current status claims, repository/runtime checks or explicit user confirmation are required.",
    "",
    body,
  ].join("\n");
}

// === PROJECT MEMORY HELPERS ===
export async function loadProjectContext() {
  try {
    const roadmap = await getProjectSection(undefined, "roadmap");
    const workflow = await getProjectSection(undefined, "workflow");

    const parts = [];

    const roadmapSanitized = sanitizeProjectSectionContent(roadmap?.content || "");
    const workflowSanitized = sanitizeProjectSectionContent(workflow?.content || "");

    if (roadmapSanitized) {
      parts.push(`ROADMAP BACKGROUND:\n${roadmapSanitized}`);
    }

    if (workflowSanitized) {
      parts.push(`WORKFLOW BACKGROUND:\n${workflowSanitized}`);
    }

    if (parts.length === 0) {
      return "";
    }

    const fullText = buildProjectContextEnvelope(parts);

    // hard cap to avoid prompt inflation
    return fullText.slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

export default {
  loadProjectContext,
};