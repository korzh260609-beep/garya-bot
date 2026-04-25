// src/projectExperience/DiffAnalyzer.js
// ============================================================================
// STAGE C.3 — Diff Analyzer (SKELETON / RULE-BASED)
// Purpose:
// - analyze commit/file-change evidence into module hints, change intent hints and risks
// - keep analysis deterministic and explainable before any AI summarization layer
// - provide structured repo understanding for Reconciler and future Project Memory writes
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO final stage completion claims
// - NO AI inference here; rule-based hints only
// ============================================================================

import {
  createProjectEvidence,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
} from "./projectExperienceTypes.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function lower(value) {
  return safeText(value).toLowerCase();
}

function unique(values = []) {
  return [...new Set(ensureArray(values).map(safeText).filter(Boolean))];
}

function classifyModuleByPath(filename = "") {
  const path = lower(filename);

  if (!path) return "unknown";
  if (path.startsWith("src/projectexperience/")) return "project_experience";
  if (path.startsWith("src/projectmemory/") || path === "projectmemory.js") return "project_memory";
  if (path.startsWith("src/core/projectintent/")) return "project_intent";
  if (path.startsWith("src/core/handlemessage/")) return "core_message_flow";
  if (path.startsWith("src/bot/dispatchers/") || path.startsWith("src/bot/router/") || path.startsWith("src/bot/handlers/")) return "bot_command_layer";
  if (path.startsWith("migrations/")) return "database_migration";
  if (path.startsWith("pillars/")) return "pillars";
  if (path.startsWith("src/sources/")) return "sources_layer";
  if (path.startsWith("src/tasks/")) return "task_engine";
  if (path.includes("memory")) return "memory";
  if (path.includes("auth") || path.includes("access") || path.includes("permission")) return "access_control";

  return "unknown";
}

function classifyChangeIntent({ message = "", files = [] } = {}) {
  const text = lower(message);
  const filenames = ensureArray(files).map((file) => lower(file?.filename)).join("\n");
  const blob = `${text}\n${filenames}`;

  const intents = [];

  if (/\bfix\b|исправ|bug|error|ошиб/.test(blob)) intents.push("fix");
  if (/\badd\b|добав|create|созда/.test(blob)) intents.push("add_feature_or_file");
  if (/refactor|split|extract|перенос|вынес/.test(blob)) intents.push("refactor");
  if (/guard|confirm|permission|access|deny|block|защит/.test(blob)) intents.push("safety_or_access_control");
  if (/memory|projectmemory|project_memory|памят/.test(blob)) intents.push("memory_related");
  if (/workflow|roadmap|decision|pillar/.test(blob)) intents.push("pillar_related");
  if (/migration|schema|table|index|db/.test(blob)) intents.push("database_related");
  if (/test|diag|debug|diagnostic/.test(blob)) intents.push("diagnostic_or_test");

  return unique(intents.length > 0 ? intents : ["unknown"]);
}

function detectRisks({ modules = [], intents = [], files = [] } = {}) {
  const risks = [];
  const filePaths = ensureArray(files).map((file) => lower(file?.filename));

  if (modules.includes("database_migration")) {
    risks.push("Database migration detected; deployment/order/backfill must be checked.");
  }

  if (modules.includes("access_control") || intents.includes("safety_or_access_control")) {
    risks.push("Access-control or guard logic changed; monarch/private/user-scope behavior must be verified.");
  }

  if (modules.includes("project_memory") || intents.includes("memory_related")) {
    risks.push("Project Memory logic changed; avoid writing unverified facts or mixing raw claims with confirmed knowledge.");
  }

  if (modules.includes("pillars")) {
    risks.push("Pillars changed; project logic and current workflow may need reconciliation.");
  }

  if (filePaths.some((path) => path.endsWith("cmdactionmap.js") || path.includes("commanddispatcher"))) {
    risks.push("Command routing changed; verify command wiring and permission gate.");
  }

  if (filePaths.some((path) => path.includes("projectintentconfirmedactionbuilder"))) {
    risks.push("Confirmed action builder changed; verify it does not convert free-text into unverified facts.");
  }

  return unique(risks);
}

function summarizeFiles(files = []) {
  return ensureArray(files)
    .map((file) => ({
      filename: safeText(file?.filename),
      status: safeText(file?.status),
      additions: file?.additions ?? null,
      deletions: file?.deletions ?? null,
      changes: file?.changes ?? null,
    }))
    .filter((file) => file.filename);
}

export class DiffAnalyzer {
  analyzeCommitEvidence(commitEvidence = {}) {
    const details = commitEvidence?.details || {};
    const files = summarizeFiles(details?.files || []);
    const message = safeText(details?.message || commitEvidence?.title);

    const modules = unique(files.map((file) => classifyModuleByPath(file.filename)));
    const intents = classifyChangeIntent({ message, files });
    const risks = detectRisks({ modules, intents, files });

    return createProjectEvidence({
      type: PROJECT_EXPERIENCE_EVIDENCE_TYPES.FILE_CHANGE,
      source: "diff_analyzer",
      ref: safeText(details?.sha || commitEvidence?.ref),
      title: `Diff analysis: ${safeText(message) || safeText(details?.sha || commitEvidence?.ref) || "unknown commit"}`,
      summary: [
        `modules=${modules.join(",") || "unknown"}`,
        `intents=${intents.join(",") || "unknown"}`,
        `files=${files.length}`,
        `risks=${risks.length}`,
      ].join(" | "),
      details: {
        commitSha: safeText(details?.sha || commitEvidence?.ref),
        message,
        modules,
        intents,
        risks,
        files,
      },
      confidence: files.length > 0
        ? PROJECT_EXPERIENCE_CONFIDENCE.MEDIUM
        : PROJECT_EXPERIENCE_CONFIDENCE.LOW,
    });
  }

  analyzeCommitEvidences(commitEvidences = []) {
    return ensureArray(commitEvidences).map((evidence) => this.analyzeCommitEvidence(evidence));
  }
}

export default {
  DiffAnalyzer,
};
