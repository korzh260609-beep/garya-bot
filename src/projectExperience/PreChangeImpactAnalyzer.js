// src/projectExperience/PreChangeImpactAnalyzer.js
// ============================================================================
// STAGE C.6 — Pre-Change Impact Analyzer (SKELETON / RULE-BASED)
// Purpose:
// - analyze intended code/project changes BEFORE they are applied
// - help SG understand what a change may affect and what must be checked after
// - prevent blind architecture changes
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - NO file edits
// - advisory/dry-run only
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function lower(value) {
  return safeText(value).toLowerCase();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(ensureArray(values).map(safeText).filter(Boolean))];
}

function classifyTarget(path = "") {
  const p = lower(path);

  if (!p) return "unknown";
  if (p.startsWith("src/projectexperience/")) return "project_experience";
  if (p.startsWith("src/projectmemory/") || p === "projectmemory.js") return "project_memory";
  if (p.startsWith("src/core/projectintent/")) return "project_intent";
  if (p.startsWith("src/core/handlemessage/")) return "core_message_flow";
  if (p.startsWith("src/bot/dispatchers/") || p.startsWith("src/bot/router/") || p.startsWith("src/bot/handlers/") || p === "src/bot/cmdactionmap.js") return "bot_command_layer";
  if (p.startsWith("pillars/")) return "pillars";
  if (p.startsWith("migrations/")) return "database_migration";
  if (p.startsWith("src/sources/")) return "sources_layer";
  if (p.startsWith("src/tasks/")) return "task_engine";
  if (p.includes("access") || p.includes("permission") || p.includes("guard")) return "access_control";

  return "unknown";
}

function inferRisk(moduleKey = "") {
  switch (moduleKey) {
    case "core_message_flow":
      return "Core message flow change may affect every chat response and must be fail-open/fail-safe checked.";
    case "project_intent":
      return "Project intent change may route user text incorrectly or allow/deny SG-core actions incorrectly.";
    case "project_memory":
      return "Project Memory change may store wrong facts or mix claims with verified knowledge.";
    case "project_experience":
      return "Project Experience change may alter SG project understanding and verification behavior.";
    case "bot_command_layer":
      return "Command layer change may break command wiring, permissions or idempotency.";
    case "database_migration":
      return "Migration change may require deploy order, backfill and rollback planning.";
    case "pillars":
      return "Pillar change may alter project direction and must not be automated without monarch command.";
    case "access_control":
      return "Access-control change may expose monarch-only project functions to other users.";
    default:
      return "Unknown module impact; manual review required.";
  }
}

function inferChecks(moduleKey = "") {
  switch (moduleKey) {
    case "core_message_flow":
      return ["send normal chat message", "send project-related message", "verify no crash on empty/non-text input"];
    case "project_intent":
      return ["test SG-core read intent", "test SG-core write intent confirmation", "test non-monarch denial"];
    case "project_memory":
      return ["test /pm list/read command", "verify confirmed vs raw layers", "verify no unverified fact write"];
    case "project_experience":
      return ["import all projectExperience modules", "run dry-run context decision", "verify no Project Memory writes"];
    case "bot_command_layer":
      return ["test command parsing", "test permission gate", "test idempotency path"];
    case "database_migration":
      return ["run migration", "check rollback plan", "verify indexes/backfill"];
    case "pillars":
      return ["manual monarch review", "check WORKFLOW/ROADMAP/DECISIONS consistency"];
    case "access_control":
      return ["test monarch private allow", "test group denial", "test non-monarch denial"];
    default:
      return ["manual review", "run smoke test"];
  }
}

export class PreChangeImpactAnalyzer {
  analyzeChangePlan({
    changeTitle = "",
    changeReason = "",
    targetFiles = [],
    intendedEffects = [],
  } = {}) {
    const files = ensureArray(targetFiles).map(safeText).filter(Boolean);
    const modules = unique(files.map(classifyTarget));

    const risks = unique(modules.map(inferRisk));
    const checks = unique(modules.flatMap(inferChecks));

    const highRisk = modules.some((m) =>
      ["core_message_flow", "project_intent", "project_memory", "database_migration", "access_control", "pillars"].includes(m)
    );

    return {
      ok: true,
      dryRun: true,
      changeTitle: safeText(changeTitle),
      changeReason: safeText(changeReason),
      targetFiles: files,
      intendedEffects: ensureArray(intendedEffects).map(safeText).filter(Boolean),
      affectedModules: modules,
      riskLevel: highRisk ? "high" : modules.includes("unknown") ? "medium" : "low",
      risks,
      requiredChecks: checks,
      recommendation: highRisk
        ? "Proceed only with a small isolated change and verify immediately after commit/deploy."
        : "Proceed with normal review and smoke test.",
    };
  }
}

export default {
  PreChangeImpactAnalyzer,
};
