// src/bot/handlers/pmSessionControlledDiag.js
// ============================================================================
// PROJECT MEMORY SESSION CONTROLLED DIAGNOSTIC
// Purpose:
// - verify controlled work-session write + update path
// - use trusted path only
// - create a small diagnostic session and update it through ProjectMemorySessionUpdater
// - keep update logic out of dispatcher
// ============================================================================

const PM_SESSION_CONTROLLED_DIAG_BUILD = "pm-session-controlled-diag-2026-04-27-01";

function safeText(value) {
  return String(value ?? "").trim();
}

function makeDiagMarker() {
  return `pm_session_controlled_diag_${Date.now()}`;
}

function contentHasMarker(content = "", marker = "") {
  return String(content ?? "").includes(marker);
}

export async function handlePmSessionControlledDiag({
  bot,
  chatId,
  chatIdStr,
  transport = "agent_workspace",
  bypass = false,
  recordProjectWorkSession,
  updateProjectWorkSession,
  getProjectMemoryList,
} = {}) {
  const marker = makeDiagMarker();
  const hasRecorder = typeof recordProjectWorkSession === "function";
  const hasUpdater = typeof updateProjectWorkSession === "function";
  const hasListReader = typeof getProjectMemoryList === "function";

  const diag = {
    command: "/pm_session_controlled_diag",
    build: PM_SESSION_CONTROLLED_DIAG_BUILD,
    controlledWrite: true,
    dbWrites: true,
    touchesRealProjectSections: false,
    usesTrustedPath: !!bypass,
    hasRecorder,
    hasUpdater,
    hasListReader,
    createdId: null,
    createOk: false,
    updateOk: false,
    readBackOk: false,
    contentUpdated: false,
    error: null,
  };

  try {
    if (!bypass) {
      diag.error = "trusted_path_required";
    } else if (!hasRecorder) {
      diag.error = "recordProjectWorkSession_missing";
    } else if (!hasUpdater) {
      diag.error = "updateProjectWorkSession_missing";
    } else if (!hasListReader) {
      diag.error = "getProjectMemoryList_missing";
    } else {
      const created = await recordProjectWorkSession({
        title: "Diagnostic controlled session update",
        goal: `create diagnostic work-session ${marker}`,
        checked: ["recordProjectWorkSession"],
        changed: ["created diagnostic session"],
        decisions: ["controlled session diagnostic uses trusted path only"],
        risks: ["diagnostic writes one small work_session entry"],
        nextSteps: ["update same diagnostic session"],
        notes: [marker],
        tags: ["diag", "project_memory", "session_controlled"],
        sourceType: "diagnostic",
        sourceRef: `agent_workspace:${marker}`,
        relatedPaths: [
          "src/bot/handlers/pmSessionControlledDiag.js",
          "src/projectMemory/ProjectMemorySessionUpdater.js",
        ],
        moduleKey: "project_memory",
        stageKey: "7A",
        meta: {
          transport: safeText(transport),
          manual: false,
          diagnostic: true,
          marker,
          chatId: safeText(chatIdStr || chatId),
        },
      });

      diag.createdId = Number(created?.id) || null;
      diag.createOk = Number.isInteger(diag.createdId) && diag.createdId > 0;

      if (!diag.createOk) {
        diag.error = "diagnostic_session_create_failed";
      } else {
        const updatedMarker = `${marker}_updated`;
        const updated = await updateProjectWorkSession({
          id: diag.createdId,
          patch: {
            changed: ["updated diagnostic session through ProjectMemorySessionUpdater"],
            notes: [updatedMarker],
            sourceRef: `agent_workspace:${updatedMarker}`,
            tags: ["diag", "project_memory", "session_controlled", "updated"],
          },
        });

        diag.updateOk = Number(updated?.id) === diag.createdId;

        const rows = await getProjectMemoryList(undefined, "work_sessions");
        const row = Array.isArray(rows)
          ? rows.find((item) => Number(item?.id) === diag.createdId)
          : null;

        diag.readBackOk = !!row;
        diag.contentUpdated = contentHasMarker(row?.content, updatedMarker);

        if (!diag.updateOk) {
          diag.error = "diagnostic_session_update_failed";
        } else if (!diag.readBackOk) {
          diag.error = "diagnostic_session_readback_failed";
        } else if (!diag.contentUpdated) {
          diag.error = "diagnostic_session_content_not_updated";
        }
      }
    }
  } catch (error) {
    diag.error = error?.message || "unknown_error";
  }

  const ok =
    diag.controlledWrite === true &&
    diag.dbWrites === true &&
    diag.touchesRealProjectSections === false &&
    diag.usesTrustedPath === true &&
    diag.hasRecorder === true &&
    diag.hasUpdater === true &&
    diag.hasListReader === true &&
    diag.createOk === true &&
    diag.updateOk === true &&
    diag.readBackOk === true &&
    diag.contentUpdated === true &&
    !diag.error;

  try {
    console.log("🧠 PROJECT_MEMORY_SESSION_CONTROLLED_DIAG", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory session controlled diag",
    "",
    `build: ${diag.build}`,
    `command: ${diag.command}`,
    "",
    `controlledWrite: ${diag.controlledWrite ? "yes" : "no"}`,
    `dbWrites: ${diag.dbWrites ? "yes" : "no"}`,
    `touchesRealProjectSections: ${diag.touchesRealProjectSections ? "yes" : "no"}`,
    `trustedPath: ${diag.usesTrustedPath ? "yes" : "no"}`,
    "",
    `recordProjectWorkSession: ${diag.hasRecorder ? "OK" : "MISSING"}`,
    `updateProjectWorkSession: ${diag.hasUpdater ? "OK" : "MISSING"}`,
    `getProjectMemoryList: ${diag.hasListReader ? "OK" : "MISSING"}`,
    "",
    `createdId: ${diag.createdId ?? "-"}`,
    `createOk: ${diag.createOk ? "yes" : "no"}`,
    `updateOk: ${diag.updateOk ? "yes" : "no"}`,
    `readBackOk: ${diag.readBackOk ? "yes" : "no"}`,
    `contentUpdated: ${diag.contentUpdated ? "yes" : "no"}`,
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

export default handlePmSessionControlledDiag;
