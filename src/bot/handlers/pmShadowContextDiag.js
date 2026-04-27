// src/bot/handlers/pmShadowContextDiag.js
// ============================================================================
// PROJECT MEMORY SHADOW CONTEXT DIAGNOSTIC
// Stage 7A.9 — Project Work Auto-Restore shadow diagnostic
// Purpose:
// - verify project work context can be restored before project/repo work
// - verify confirmed memory is distinguishable from chat context
// - verify the diagnostic is read-only and shadow-mode only
// - do not write DB, do not call AI, do not change runtime prompt behavior
// ============================================================================

const PM_SHADOW_CONTEXT_DIAG_BUILD = "pm-shadow-context-diag-2026-04-27-01";

function safeText(value) {
  return String(value ?? "");
}

function normalizeEntryType(entry = {}) {
  return safeText(entry.entry_type || entry.entryType).trim();
}

function normalizeSection(entry = {}) {
  return safeText(entry.section).trim();
}

function entryBlob(entry = {}) {
  return [
    entry.title,
    entry.section,
    entry.entry_type,
    entry.module_key,
    entry.stage_key,
    entry.content,
    safeText(entry.meta && typeof entry.meta === "object" ? JSON.stringify(entry.meta) : ""),
  ].join("\n");
}

function countEntriesByType(entries = [], entryType = "") {
  const target = safeText(entryType).trim();
  return Array.isArray(entries)
    ? entries.filter((entry) => normalizeEntryType(entry) === target).length
    : 0;
}

function countEntriesByText(entries = [], pattern) {
  if (!Array.isArray(entries) || !(pattern instanceof RegExp)) return 0;
  return entries.filter((entry) => pattern.test(entryBlob(entry))).length;
}

function hasAnyText(value = "", pattern) {
  return pattern instanceof RegExp ? pattern.test(safeText(value)) : false;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

export async function handlePmShadowContextDiag({
  bot,
  chatId,
  buildProjectMemoryContext,
  buildProjectMemoryDigest,
  listConfirmedProjectMemoryEntries,
} = {}) {
  const hasContextBuilder = typeof buildProjectMemoryContext === "function";
  const hasDigestBuilder = typeof buildProjectMemoryDigest === "function";
  const hasConfirmedReader = typeof listConfirmedProjectMemoryEntries === "function";

  const diag = {
    command: "/pm_shadow_context_diag",
    build: PM_SHADOW_CONTEXT_DIAG_BUILD,
    stage: "7A.9",
    readOnly: true,
    dbWrites: false,
    aiCalls: false,
    shadowMode: true,
    runtimePromptChanged: false,
    chatContextUsed: false,
    confirmedMemoryUsed: false,
    hasContextBuilder,
    hasDigestBuilder,
    hasConfirmedReader,
    contextOk: false,
    digestOk: false,
    confirmedReaderOk: false,
    contextChars: 0,
    totalEntries: null,
    aiContextEligibleTotal: null,
    sectionsTotal: null,
    entryTypesTotal: null,
    workflowPositionFound: false,
    activeDecisionsTotal: 0,
    activeConstraintsTotal: 0,
    openRisksFound: false,
    openRisksTotal: 0,
    nextSafeStepsTotal: 0,
    confirmedVsChatSeparated: true,
    warnings: [],
    error: null,
  };

  try {
    if (!hasContextBuilder) {
      diag.error = "buildProjectMemoryContext_missing";
    } else if (!hasDigestBuilder) {
      diag.error = "buildProjectMemoryDigest_missing";
    } else if (!hasConfirmedReader) {
      diag.error = "listConfirmedProjectMemoryEntries_missing";
    } else {
      const context = await buildProjectMemoryContext({});
      const digest = await buildProjectMemoryDigest({});
      const confirmedEntries = await listConfirmedProjectMemoryEntries({
        limit: 200,
      });

      const contextText = safeText(context);
      const entries = Array.isArray(confirmedEntries) ? confirmedEntries : [];
      const combinedText = `${contextText}\n${entries.map(entryBlob).join("\n")}`;

      diag.contextChars = contextText.length;
      diag.contextOk = typeof context === "string";
      diag.digestOk = !!digest && typeof digest === "object";
      diag.confirmedReaderOk = Array.isArray(confirmedEntries);
      diag.confirmedMemoryUsed = entries.length > 0 || contextText.length > 0;

      diag.totalEntries = Number.isFinite(Number(digest?.totalEntries))
        ? Number(digest.totalEntries)
        : entries.length;
      diag.aiContextEligibleTotal = Number.isFinite(Number(digest?.aiContextEligibleTotal))
        ? Number(digest.aiContextEligibleTotal)
        : null;
      diag.sectionsTotal = Array.isArray(digest?.sections)
        ? digest.sections.length
        : new Set(entries.map(normalizeSection).filter(Boolean)).size;
      diag.entryTypesTotal = Array.isArray(digest?.entryTypes)
        ? digest.entryTypes.length
        : new Set(entries.map(normalizeEntryType).filter(Boolean)).size;

      diag.activeDecisionsTotal = countEntriesByType(entries, "decision");
      diag.activeConstraintsTotal = countEntriesByType(entries, "constraint");
      diag.nextSafeStepsTotal = countEntriesByType(entries, "next_step");
      diag.openRisksTotal = countEntriesByText(
        entries,
        /\b(risk|risks|open risk|опасн|ризик|риски|риск)\b/i
      );

      diag.workflowPositionFound =
        arrayLength(digest?.stageKeys) > 0 ||
        hasAnyText(combinedText, /\b(workflow|stage|current stage|этап|стадия|шаг)\b/i);
      diag.openRisksFound =
        diag.openRisksTotal > 0 ||
        hasAnyText(combinedText, /\b(risk|risks|open risk|опасн|ризик|риски|риск)\b/i);

      if (!diag.workflowPositionFound) {
        diag.warnings.push("workflow_position_not_found_in_confirmed_memory");
      }
      if (diag.activeDecisionsTotal < 1) {
        diag.warnings.push("active_decisions_not_found_in_confirmed_memory");
      }
      if (diag.activeConstraintsTotal < 1) {
        diag.warnings.push("active_constraints_not_found_in_confirmed_memory");
      }
      if (!diag.openRisksFound) {
        diag.warnings.push("open_risks_not_found_in_confirmed_memory");
      }
      if (diag.nextSafeStepsTotal < 1) {
        diag.warnings.push("next_safe_step_not_found_in_confirmed_memory");
      }
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.readOnly === true &&
    diag.dbWrites === false &&
    diag.aiCalls === false &&
    diag.shadowMode === true &&
    diag.runtimePromptChanged === false &&
    diag.chatContextUsed === false &&
    diag.confirmedVsChatSeparated === true &&
    diag.hasContextBuilder === true &&
    diag.hasDigestBuilder === true &&
    diag.hasConfirmedReader === true &&
    diag.contextOk === true &&
    diag.digestOk === true &&
    diag.confirmedReaderOk === true &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_SHADOW_CONTEXT_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory shadow context diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    `stage: ${diag.stage}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `aiCalls: ${diag.aiCalls ? "yes" : "no"}`,
    `shadowMode: ${diag.shadowMode ? "yes" : "no"}`,
    `runtimePromptChanged: ${diag.runtimePromptChanged ? "yes" : "no"}`,
    "",
    `buildProjectMemoryContext: ${diag.hasContextBuilder ? "OK" : "MISSING"}`,
    `buildProjectMemoryDigest: ${diag.hasDigestBuilder ? "OK" : "MISSING"}`,
    `listConfirmedProjectMemoryEntries: ${diag.hasConfirmedReader ? "OK" : "MISSING"}`,
    "",
    `contextOk: ${diag.contextOk ? "yes" : "no"}`,
    `digestOk: ${diag.digestOk ? "yes" : "no"}`,
    `confirmedReaderOk: ${diag.confirmedReaderOk ? "yes" : "no"}`,
    `contextChars: ${diag.contextChars}`,
    `totalEntries: ${diag.totalEntries ?? "-"}`,
    `aiContextEligibleTotal: ${diag.aiContextEligibleTotal ?? "-"}`,
    `sectionsTotal: ${diag.sectionsTotal ?? "-"}`,
    `entryTypesTotal: ${diag.entryTypesTotal ?? "-"}`,
    "",
    `workflowPositionFound: ${diag.workflowPositionFound ? "yes" : "no"}`,
    `activeDecisionsTotal: ${diag.activeDecisionsTotal}`,
    `activeConstraintsTotal: ${diag.activeConstraintsTotal}`,
    `openRisksFound: ${diag.openRisksFound ? "yes" : "no"}`,
    `openRisksTotal: ${diag.openRisksTotal}`,
    `nextSafeStepsTotal: ${diag.nextSafeStepsTotal}`,
    "",
    `confirmedMemoryUsed: ${diag.confirmedMemoryUsed ? "yes" : "no"}`,
    `chatContextUsed: ${diag.chatContextUsed ? "yes" : "no"}`,
    `confirmedVsChatSeparated: ${diag.confirmedVsChatSeparated ? "yes" : "no"}`,
    "",
    `warnings: ${diag.warnings.length ? diag.warnings.join(", ") : "-"}`,
    "",
    `Result: ${ok ? "OK" : "FAILED"}`,
  ];

  if (diag.error) {
    lines.push(`error: ${diag.error}`);
  }

  await bot.sendMessage(chatId, lines.join("\n"));

  return {
    ok,
    diag,
  };
}

export default handlePmShadowContextDiag;
