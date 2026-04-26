// src/bot/handlers/pmControlledWriteDiag.js
// ============================================================================
// PROJECT MEMORY CONTROLLED WRITE DIAGNOSTIC
// Purpose:
// - verify the legacy /pm_set write path without touching real project sections
// - write only one controlled diagnostic section_state probe
// - read the same section back to prove runtime write/read path works
// ============================================================================

const PM_CONTROLLED_WRITE_DIAG_BUILD = "pm-controlled-write-diag-2026-04-26-01";
const CONTROLLED_SECTION = "diag_pm_set_runtime_probe";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildProbeContent({ timestamp }) {
  return [
    "CONTROLLED PROJECT MEMORY WRITE DIAGNOSTIC",
    `timestamp: ${timestamp}`,
    "purpose: verify legacy /pm_set-compatible upsertProjectSection runtime path",
    "scope: diagnostic section only",
  ].join("\n");
}

export async function handlePmControlledWriteDiag({
  bot,
  chatId,
  chatIdStr = "",
  transport = "telegram",
  bypass = false,
  upsertProjectSection,
  getProjectSection,
} = {}) {
  const timestamp = new Date().toISOString();
  const hasWriter = typeof upsertProjectSection === "function";
  const hasReader = typeof getProjectSection === "function";
  const content = buildProbeContent({ timestamp });

  const diag = {
    command: "/pm_controlled_diag",
    build: PM_CONTROLLED_WRITE_DIAG_BUILD,
    section: CONTROLLED_SECTION,
    controlledWrite: true,
    dbWrites: true,
    touchesRealProjectSections: false,
    bypass: !!bypass,
    hasWriter,
    hasReader,
    writeOk: false,
    readBackOk: false,
    contentMatches: false,
    error: null,
  };

  try {
    if (!bypass) {
      diag.error = "not_trusted_path";
    } else if (!hasWriter) {
      diag.error = "upsertProjectSection_missing";
    } else if (!hasReader) {
      diag.error = "getProjectSection_missing";
    } else {
      await upsertProjectSection({
        section: CONTROLLED_SECTION,
        title: "Controlled Project Memory write diagnostic",
        content,
        tags: ["diagnostic", "controlled-write", "stage-7a"],
        meta: {
          diagnostic: true,
          controlledWrite: true,
          command: "/pm_controlled_diag",
          legacyPath: "/pm_set-compatible",
          setBy: normalizeString(chatIdStr || chatId),
          transport: normalizeString(transport) || "telegram",
          stageKey: "7A",
        },
        schemaVersion: 1,
      });

      diag.writeOk = true;

      const rec = await getProjectSection(undefined, CONTROLLED_SECTION);
      const readContent = String(rec?.content || "");

      diag.readBackOk = !!rec;
      diag.contentMatches = readContent === content;
      diag.entryType = rec?.entry_type || rec?.entryType || null;
      diag.status = rec?.status || null;
      diag.isActive = typeof rec?.is_active === "boolean" ? rec.is_active : null;
      diag.contentChars = readContent.length;
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  try {
    console.log("🧠 PROJECT_MEMORY_CONTROLLED_WRITE_DIAG", diag);
  } catch (_) {}

  const ok =
    diag.bypass === true &&
    diag.hasWriter === true &&
    diag.hasReader === true &&
    diag.writeOk === true &&
    diag.readBackOk === true &&
    diag.contentMatches === true &&
    !diag.error;

  const lines = [
    "🧠 Project Memory controlled write diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    `section: ${diag.section}`,
    "",
    `controlledWrite: ${diag.controlledWrite ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `touchesRealProjectSections: ${diag.touchesRealProjectSections ? "yes" : "no"}`,
    `bypass: ${diag.bypass ? "yes" : "no"}`,
    "",
    `upsertProjectSection: ${diag.hasWriter ? "OK" : "MISSING"}`,
    `getProjectSection: ${diag.hasReader ? "OK" : "MISSING"}`,
    "",
    `writeOk: ${diag.writeOk ? "yes" : "no"}`,
    `readBackOk: ${diag.readBackOk ? "yes" : "no"}`,
    `contentMatches: ${diag.contentMatches ? "yes" : "no"}`,
    `entryType: ${diag.entryType || "-"}`,
    `status: ${diag.status || "-"}`,
    `isActive: ${diag.isActive === null ? "-" : diag.isActive ? "yes" : "no"}`,
    `contentChars: ${diag.contentChars || 0}`,
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

export default handlePmControlledWriteDiag;
