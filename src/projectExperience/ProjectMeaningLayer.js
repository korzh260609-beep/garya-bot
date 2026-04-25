// src/projectExperience/ProjectMeaningLayer.js
// ============================================================================
// STAGE C.9F — Project Meaning Layer (SKELETON / DRY-RUN)
// Purpose:
// - understand project-related user intent by meaning, not by hardcoded replies
// - separate meaning extraction from execution, memory writes, and repo access
// - identify whether enough information exists to act safely
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - NO hardcoded final user replies
// - This layer returns structured meaning only; caller/AI decides natural wording
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase().replace(/ё/g, "е");
}

function uniq(values = []) {
  return [...new Set(Array.isArray(values) ? values.filter(Boolean) : [])];
}

function extractStageId(text = "") {
  const source = safeText(text);
  const direct = source.match(/(?:stage|этап)\s*([0-9]+[a-zа-я]?(?:\.[0-9]+)?)/i);
  if (direct) return safeText(direct[1]).toUpperCase();

  const standalone = source.match(/\b([0-9]+[a-zа-я](?:\.[0-9]+)?)\b/i);
  if (standalone) return safeText(standalone[1]).toUpperCase();

  return null;
}

function hasProjectWorkMeaning(text = "") {
  const s = lower(text);
  return Boolean(
    s.includes("сг") ||
    s.includes("проект") ||
    s.includes("repo") ||
    s.includes("github") ||
    s.includes("workflow") ||
    s.includes("roadmap") ||
    s.includes("архитект") ||
    s.includes("модул") ||
    s.includes("скелет") ||
    s.includes("этап") ||
    s.includes("stage")
  );
}

function inferMeaning({ text = "", hasActiveProjectSession = false } = {}) {
  const sourceText = safeText(text);
  const s = lower(sourceText);
  const stageId = extractStageId(sourceText);
  const missing = [];
  let userMeaning = "general_message";
  let intent = "general_chat";
  let enoughInformation = true;
  let shouldClarify = false;
  let confidence = 0.4;

  const projectRelated = hasActiveProjectSession || hasProjectWorkMeaning(sourceText);

  const asksToInspect = Boolean(
    s.includes("проверь") ||
    s.includes("проверить") ||
    s.includes("статус") ||
    s.includes("готов") ||
    s.includes("заверш") ||
    s.includes("check") ||
    s.includes("status")
  );

  const referencesStage = Boolean(
    s.includes("этап") ||
    s.includes("stage") || stageId
  );

  const referencesArchitecture = Boolean(
    s.includes("архитект") ||
    s.includes("скелет") ||
    s.includes("модул") ||
    s.includes("структур")
  );

  const referencesMemory = Boolean(
    s.includes("памят") ||
    s.includes("memory") ||
    s.includes("сохрани") ||
    s.includes("запиши")
  );

  const riskConcern = Boolean(
    s.includes("риск") ||
    s.includes("ошиб") ||
    s.includes("слом") ||
    s.includes("противореч") ||
    s.includes("нельзя")
  );

  if (projectRelated && asksToInspect && referencesStage) {
    intent = "inspect_project_stage";
    userMeaning = stageId
      ? `user wants to inspect project stage ${stageId}`
      : "user wants to inspect a project stage but did not identify which stage";
    confidence = stageId ? 0.82 : 0.74;

    if (!stageId) {
      enoughInformation = false;
      shouldClarify = true;
      missing.push("stage_id");
    }
  } else if (projectRelated && referencesArchitecture) {
    intent = "work_on_project_architecture";
    userMeaning = "user is discussing or changing project architecture";
    confidence = 0.72;
  } else if (projectRelated && referencesMemory) {
    intent = "work_with_project_memory";
    userMeaning = "user is discussing project memory or wants something remembered";
    confidence = 0.7;
  } else if (projectRelated && riskConcern) {
    intent = "analyze_project_risk";
    userMeaning = "user is concerned about risk, errors, or contradictions in project work";
    confidence = 0.72;
  } else if (projectRelated || hasActiveProjectSession) {
    intent = "project_related_message";
    userMeaning = "user message appears related to SG project work";
    confidence = 0.55;
  }

  return {
    ok: true,
    dryRun: true,
    source: "ProjectMeaningLayer",
    intent,
    confidence,
    userMeaning,
    enoughInformation,
    shouldClarify,
    missingInformation: uniq(missing),
    extracted: {
      stageId,
    },
    policy: {
      doNotGuessMissingInformation: true,
      naturalClarificationRequired: shouldClarify,
      hardcodedReplyAllowed: false,
    },
  };
}

export class ProjectMeaningLayer {
  understand(input = {}) {
    return inferMeaning(input);
  }
}

export function understandProjectMeaning(input = {}) {
  return new ProjectMeaningLayer().understand(input);
}

export default {
  ProjectMeaningLayer,
  understandProjectMeaning,
};
