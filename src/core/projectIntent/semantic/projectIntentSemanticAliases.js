// src/core/projectIntent/semantic/projectIntentSemanticAliases.js
// ============================================================================
// LEGACY PHRASE-BOUND ROUTING MARKER
//
// INTERFACE MODE NOTE:
// - This file uses deterministic phrase/keyword alias checks.
// - Under hard Human Mode / Technical Mode separation, this is NOT full Human Mode.
// - Treat this as legacy Technical Mode support until a clean structured meaning
//   layer replaces it.
// - Do not add new phrase-bound hacks here.
// ============================================================================

import { KNOWN_CANONICAL_TARGETS } from "./projectIntentSemanticConstants.js";
import { normalizeText, tokenizeText, safeText, levenshtein } from "./projectIntentSemanticText.js";

export function inferSemanticAlias(text = "") {
  const normalized = normalizeText(text);

  if (
    (normalized.includes("описан") || normalized.includes("что это за проект") || normalized.includes("about project")) &&
    normalized.includes("проект")
  ) {
    return { entity: "project_description", path: "README.md", confidence: "high" };
  }

  if (normalized.includes("readme")) {
    return { entity: "readme", path: "README.md", confidence: "high" };
  }

  if (
    normalized.includes("decision") ||
    normalized.includes("decisions") ||
    normalized.includes("решени")
  ) {
    return { entity: "decisions", path: "pillars/DECISIONS.md", confidence: "medium" };
  }

  if (normalized.includes("workflow")) {
    return { entity: "workflow", path: "pillars/WORKFLOW.md", confidence: "high" };
  }

  if (normalized.includes("roadmap")) {
    return { entity: "roadmap", path: "pillars/ROADMAP.md", confidence: "high" };
  }

  if (normalized.includes("project.md")) {
    return { entity: "project", path: "pillars/PROJECT.md", confidence: "high" };
  }

  return { entity: "", path: "", confidence: "low" };
}

export function fuzzyCanonicalMatch(text = "") {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const alias = inferSemanticAlias(normalized);
  if (alias.path) {
    return alias;
  }

  const candidates = [];

  for (const token of tokens) {
    const clean = token.replace(/[^a-zа-я0-9_./-]/gi, "");
    if (!clean || clean.length < 3) continue;

    for (const item of KNOWN_CANONICAL_TARGETS) {
      const dist = levenshtein(clean, item.entity);
      if (dist <= 2 || item.entity.includes(clean) || clean.includes(item.entity)) {
        candidates.push({
          ...item,
          score: dist,
        });
      }

      const fileBase = item.path.split("/").pop()?.replace(/\.[^.]+$/i, "").toLowerCase() || "";
      const fileDist = levenshtein(clean, fileBase);
      if (fileDist <= 2 || fileBase.includes(clean) || clean.includes(fileBase)) {
        candidates.push({
          ...item,
          score: Math.min(dist, fileDist),
        });
      }
    }
  }

  if (!candidates.length) {
    return {
      entity: "",
      path: "",
      confidence: "low",
    };
  }

  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  return {
    entity: safeText(best.entity),
    path: safeText(best.path),
    confidence: best.score === 0 ? "high" : "medium",
  };
}