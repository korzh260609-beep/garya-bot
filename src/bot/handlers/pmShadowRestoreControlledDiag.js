// src/bot/handlers/pmShadowRestoreControlledDiag.js
// ============================================================================
// PROJECT MEMORY SHADOW RESTORE CONTROLLED DIAGNOSTIC
// Stage 7A.10 + 7A.9
// Purpose:
// - write controlled diagnostic confirmed constraint + next_step
// - verify Project Memory shadow restore can see constraints and next steps
// - use only trusted confirmed Project Memory writer
// - do not write from raw chat, do not call AI, do not change pillars
// ============================================================================

const PM_SHADOW_RESTORE_CONTROLLED_DIAG_BUILD = "pm-shadow-restore-controlled-diag-2026-04-27-01";
const DIAG_SOURCE_REF = "diag:project-memory-7a-shadow-restore-controlled";

function safeText(value) {
  return String(value ?? "").trim();
}

function entryTypeOf(entry = {}) {
  return safeText(entry.entry_type || entry.entryType);
}

function entryBlob(entry = {}) {
  return [
    entry.title,
    entry.section,
    entry.entry_type,
    entry.module_key,
    entry.stage_key,
    entry.source_ref,
    entry.content,
    safeText(entry.meta && typeof entry.meta === "object" ? JSON.stringify(entry.meta) : ""),
  ].join("\n");
}

function countByType(entries = [], type = "") {
  const target = safeText(type);
  return Array.isArray(entries)
    ? entries.filter((entry) => entryTypeOf(entry) === target).length
    : 0;
}

function countDiagByType(entries = [], type = "") {
  const target = safeText(type);
  return Array.isArray(entries)
    ? entries.filter((entry) => {
        return entryTypeOf(entry) === target && entryBlob(entry).includes(DIAG_SOURCE_REF);
      }).length
    : 0;
}

function hasText(value = "", needle = "") {
  return safeText(value).includes(safeText(needle));
}

export async function handlePmShadowRestoreControlledDiag({
  bot,
  chatId,
  chatIdStr = "",
  transport = "telegram",
  bypass = false,
  writeConfirmedProjectMemory,
  listConfirmedProjectMemoryEntries,
  buildProjectMemoryContext,
  buildProjectMemoryDigest,
} = {}) {
  const timestamp = new Date().toISOString();
  const effectiveChatId = safeText(chatIdStr || chatId);

  const hasWriter = typeof writeConfirmedProjectMemory === "function";
  const hasReader = typeof listConfirmedProjectMemoryEntries === "function";
  const hasContextBuilder = typeof buildProjectMemoryContext === "function";
  const hasDigestBuilder = typeof buildProjectMemoryDigest === "function";

  const constraintNeedle = `diag_shadow_restore_constraint_${timestamp}`;
  const nextStepNeedle = `diag_shadow_restore_next_step_${timestamp}`;

  const diag = {
    command: "/pm_shadow_restore_controlled_diag",
    build: PM_SHADOW_RESTORE_CONTROLLED_DIAG_BUILD,
    stage: "7A.10/7A.9",
    controlledWrite: true,
    trustedPath: !!bypass,
    dbWrites: true,
    touchesPillars: false,
    touchesRawChatMemory: false,
    aiCalls: false,
    runtimePromptChanged: false,
    sourceRef: DIAG_SOURCE_REF,
    hasWriter,
    hasReader,
    hasContextBuilder,
    hasDigestBuilder,
    constraintWriteOk: false,
    nextStepWriteOk: false,
    readBackOk: false,
    contextOk: false,
    digestOk: false,
    constraintVisible: false,
    nextStepVisible: false,
    constraintInContext: false,
    nextStepInContext: false,
    totalEntries: null,
    activeConstraintsTotal: 0,
    nextSafeStepsTotal: 0,
    diagConstraintsTotal: 0,
    diagNextStepsTotal: 0,
    contextChars: 0,
    error: null,
  };

  try {
    if (!bypass) {
      diag.error = "not_trusted_path";
    } else if (!hasWriter) {
      diag.error = "writeConfirmedProjectMemory_missing";
    } else if (!hasReader) {
      diag.error = "listConfirmedProjectMemoryEntries_missing";
    } else if (!hasContextBuilder) {
      diag.error = "buildProjectMemoryContext_missing";
    } else if (!hasDigestBuilder) {
      diag.error = "buildProjectMemoryDigest_missing";
    } else {
      const constraintSaved = await writeConfirmedProjectMemory({
        kind: "constraint",
        section: "constraints",
        title: "Diagnostic active constraint for shadow restore",
        content: [
          "CONTROLLED DIAGNOSTIC CONSTRAINT",
          constraintNeedle,
          "Project/repo work must restore confirmed constraints before continuing architectural work.",
        ].join("\n"),
        tags: ["diagnostic", "controlled-write", "shadow-restore", "stage-7a"],
        sourceType: "diagnostic",
        sourceRef: DIAG_SOURCE_REF,
        relatedPaths: ["src/bot/handlers/pmShadowContextDiag.js"],
        moduleKey: "project_memory",
        stageKey: "7A.10",
        aiContext: true,
        confidence: 0.99,
        meta: {
          diagnostic: true,
          controlledWrite: true,
          command: "/pm_shadow_restore_controlled_diag",
          transport: safeText(transport) || "telegram",
          chatId: effectiveChatId,
          createdAt: timestamp,
        },
      });

      const nextStepSaved = await writeConfirmedProjectMemory({
        kind: "next_step",
        section: "next_steps",
        title: "Diagnostic next safe step for shadow restore",
        content: [
          "CONTROLLED DIAGNOSTIC NEXT SAFE STEP",
          nextStepNeedle,
          "Next safe step: verify Project Memory shadow restore counters after controlled confirmed writes.",
        ].join("\n"),
        tags: ["diagnostic", "controlled-write", "shadow-restore", "stage-7a"],
        sourceType: "diagnostic",
        sourceRef: DIAG_SOURCE_REF,
        relatedPaths: ["src/bot/handlers/pmShadowContextDiag.js"],
        moduleKey: "project_memory",
        stageKey: "7A.9",
        aiContext: true,
        confidence: 0.99,
        meta: {
          diagnostic: true,
          controlledWrite: true,
          command: "/pm_shadow_restore_controlled_diag",
          transport: safeText(transport) || "telegram",
          chatId: effectiveChatId,
          createdAt: timestamp,
        },
      });

      diag.constraintWriteOk = !!constraintSaved;
      diag.nextStepWriteOk = !!nextStepSaved;

      const entries = await listConfirmedProjectMemoryEntries({ limit: 200 });
      const context = await buildProjectMemoryContext({});
      const digest = await buildProjectMemoryDigest({});
      const contextText = safeText(context);

      diag.readBackOk = Array.isArray(entries);
      diag.contextOk = typeof context === "string";
      diag.digestOk = !!digest && typeof digest === "object";
      diag.contextChars = contextText.length;
      diag.totalEntries = Number.isFinite(Number(digest?.totalEntries))
        ? Number(digest.totalEntries)
        : Array.isArray(entries)
          ? entries.length
          : null;
      diag.activeConstraintsTotal = countByType(entries, "constraint");
      diag.nextSafeStepsTotal = countByType(entries, "next_step");
      diag.diagConstraintsTotal = countDiagByType(entries, "constraint");
      diag.diagNextStepsTotal = countDiagByType(entries, "next_step");
      diag.constraintVisible = diag.diagConstraintsTotal > 0;
      diag.nextStepVisible = diag.diagNextStepsTotal > 0;
      diag.constraintInContext = hasText(contextText, constraintNeedle);
      diag.nextStepInContext = hasText(contextText, nextStepNeedle);
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.controlledWrite === true &&
    diag.trustedPath === true &&
    diag.dbWrites === true &&
    diag.touchesPillars === false &&
    diag.touchesRawChatMemory === false &&
    diag.aiCalls === false &&
    diag.runtimePromptChanged === false &&
    diag.hasWriter === true &&
    diag.hasReader === true &&
    diag.hasContextBuilder === true &&
    diag.hasDigestBuilder === true &&
    diag.constraintWriteOk === true &&
    diag.nextStepWriteOk === true &&
    diag.readBackOk === true &&
    diag.contextOk === true &&
    diag.digestOk === true &&
    diag.constraintVisible === true &&
    diag.nextStepVisible === true &&
    diag.activeConstraintsTotal > 0 &&
    diag.nextSafeStepsTotal > 0 &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_SHADOW_RESTORE_CONTROLLED_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory shadow restore controlled diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    `stage: ${diag.stage}`,
    "",
    `controlledWrite: ${diag.controlledWrite ? "yes" : "no"}`,
    `trustedPath: ${diag.trustedPath ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `touchesPillars: ${diag.touchesPillars ? "yes" : "no"}`,
    `touchesRawChatMemory: ${diag.touchesRawChatMemory ? "yes" : "no"}`,
    `aiCalls: ${diag.aiCalls ? "yes" : "no"}`,
    `runtimePromptChanged: ${diag.runtimePromptChanged ? "yes" : "no"}`,
    "",
    `writeConfirmedProjectMemory: ${diag.hasWriter ? "OK" : "MISSING"}`,
    `listConfirmedProjectMemoryEntries: ${diag.hasReader ? "OK" : "MISSING"}`,
    `buildProjectMemoryContext: ${diag.hasContextBuilder ? "OK" : "MISSING"}`,
    `buildProjectMemoryDigest: ${diag.hasDigestBuilder ? "OK" : "MISSING"}`,
    "",
    `constraintWriteOk: ${diag.constraintWriteOk ? "yes" : "no"}`,
    `nextStepWriteOk: ${diag.nextStepWriteOk ? "yes" : "no"}`,
    `readBackOk: ${diag.readBackOk ? "yes" : "no"}`,
    `contextOk: ${diag.contextOk ? "yes" : "no"}`,
    `digestOk: ${diag.digestOk ? "yes" : "no"}`,
    "",
    `activeConstraintsTotal: ${diag.activeConstraintsTotal}`,
    `nextSafeStepsTotal: ${diag.nextSafeStepsTotal}`,
    `diagConstraintsTotal: ${diag.diagConstraintsTotal}`,
    `diagNextStepsTotal: ${diag.diagNextStepsTotal}`,
    `constraintVisible: ${diag.constraintVisible ? "yes" : "no"}`,
    `nextStepVisible: ${diag.nextStepVisible ? "yes" : "no"}`,
    `constraintInContext: ${diag.constraintInContext ? "yes" : "no"}`,
    `nextStepInContext: ${diag.nextStepInContext ? "yes" : "no"}`,
    `contextChars: ${diag.contextChars}`,
    `totalEntries: ${diag.totalEntries ?? "-"}`,
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

export default handlePmShadowRestoreControlledDiag;
