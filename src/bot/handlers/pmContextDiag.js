// src/bot/handlers/pmContextDiag.js
// ============================================================================
// PROJECT MEMORY CONTEXT DIAGNOSTIC
// Purpose:
// - verify Project Memory context/restore read path
// - build confirmed project context without DB writes
// - keep restore/context diagnostics out of dispatcher
// ============================================================================

const PM_CONTEXT_DIAG_BUILD = "pm-context-diag-2026-04-27-01";

export async function handlePmContextDiag({
  bot,
  chatId,
  buildProjectMemoryContext,
  buildProjectMemoryDigest,
} = {}) {
  const hasContextBuilder = typeof buildProjectMemoryContext === "function";
  const hasDigestBuilder = typeof buildProjectMemoryDigest === "function";

  const diag = {
    command: "/pm_context_diag",
    build: PM_CONTEXT_DIAG_BUILD,
    readOnly: true,
    dbWrites: false,
    hasContextBuilder,
    hasDigestBuilder,
    contextOk: false,
    digestOk: false,
    contextChars: 0,
    totalEntries: null,
    aiContextEligibleTotal: null,
    sectionsTotal: null,
    entryTypesTotal: null,
    error: null,
  };

  try {
    if (!hasContextBuilder) {
      diag.error = "buildProjectMemoryContext_missing";
    } else if (!hasDigestBuilder) {
      diag.error = "buildProjectMemoryDigest_missing";
    } else {
      const context = await buildProjectMemoryContext({});
      const digest = await buildProjectMemoryDigest({});

      diag.contextChars = String(context || "").length;
      diag.contextOk = typeof context === "string";
      diag.digestOk = !!digest && typeof digest === "object";
      diag.totalEntries = Number.isFinite(Number(digest?.totalEntries))
        ? Number(digest.totalEntries)
        : null;
      diag.aiContextEligibleTotal = Number.isFinite(Number(digest?.aiContextEligibleTotal))
        ? Number(digest.aiContextEligibleTotal)
        : null;
      diag.sectionsTotal = Array.isArray(digest?.sections) ? digest.sections.length : null;
      diag.entryTypesTotal = Array.isArray(digest?.entryTypes) ? digest.entryTypes.length : null;
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.readOnly === true &&
    diag.dbWrites === false &&
    diag.hasContextBuilder === true &&
    diag.hasDigestBuilder === true &&
    diag.contextOk === true &&
    diag.digestOk === true &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_CONTEXT_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory context diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `buildProjectMemoryContext: ${diag.hasContextBuilder ? "OK" : "MISSING"}`,
    `buildProjectMemoryDigest: ${diag.hasDigestBuilder ? "OK" : "MISSING"}`,
    "",
    `contextOk: ${diag.contextOk ? "yes" : "no"}`,
    `digestOk: ${diag.digestOk ? "yes" : "no"}`,
    `contextChars: ${diag.contextChars}`,
    `totalEntries: ${diag.totalEntries ?? "-"}`,
    `aiContextEligibleTotal: ${diag.aiContextEligibleTotal ?? "-"}`,
    `sectionsTotal: ${diag.sectionsTotal ?? "-"}`,
    `entryTypesTotal: ${diag.entryTypesTotal ?? "-"}`,
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

export default handlePmContextDiag;
