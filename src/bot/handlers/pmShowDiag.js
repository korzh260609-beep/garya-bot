// src/bot/handlers/pmShowDiag.js
// ============================================================================
// PROJECT MEMORY SHOW DIAGNOSTIC
// Purpose:
// - verify /pm_show read path without writing to project_memory
// - prove getProjectSection is wired and performs read-only section retrieval
// - keep diagnostic logic out of dispatcher
// ============================================================================

const PM_SHOW_DIAG_BUILD = "pm-show-diag-readonly-2026-04-26-01";
const DEFAULT_DIAG_SECTION = "workflow";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveDiagSection(rest) {
  return normalizeString(rest) || DEFAULT_DIAG_SECTION;
}

export async function handlePmShowDiag({
  bot,
  chatId,
  rest = "",
  getProjectSection,
} = {}) {
  const section = resolveDiagSection(rest);
  const hasReader = typeof getProjectSection === "function";

  const diag = {
    command: "/pm_show_diag",
    build: PM_SHOW_DIAG_BUILD,
    section,
    readOnly: true,
    dbWrites: false,
    hasReader,
    found: false,
    contentChars: 0,
    error: null,
  };

  try {
    if (!hasReader) {
      diag.error = "getProjectSection_missing";
    } else {
      const rec = await getProjectSection(undefined, section);
      diag.found = !!rec;
      diag.contentChars = rec?.content ? String(rec.content).length : 0;
      diag.entryType = rec?.entry_type || rec?.entryType || null;
      diag.status = rec?.status || null;
      diag.isActive = typeof rec?.is_active === "boolean" ? rec.is_active : null;
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  try {
    console.log("🧠 PROJECT_MEMORY_SHOW_DIAG_READONLY", diag);
  } catch (_) {}

  const ok = hasReader && !diag.error;

  const lines = [
    "🧠 Project Memory show diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    `section: ${diag.section}`,
    "",
    `readOnly: ${diag.readOnly ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `getProjectSection: ${diag.hasReader ? "OK" : "MISSING"}`,
    "",
    `found: ${diag.found ? "yes" : "no"}`,
    `contentChars: ${diag.contentChars}`,
    `entryType: ${diag.entryType || "-"}`,
    `status: ${diag.status || "-"}`,
    `isActive: ${diag.isActive === null ? "-" : diag.isActive ? "yes" : "no"}`,
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

export default handlePmShowDiag;
