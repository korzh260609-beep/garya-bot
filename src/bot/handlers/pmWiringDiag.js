// src/bot/handlers/pmWiringDiag.js
// ============================================================================
// PROJECT MEMORY WIRING DIAGNOSTIC
// Purpose:
// - show the active Project Memory command path used by commandDispatcher
// - verify Project Memory functions are present in ctx/deps wiring
// - keep diagnostic logic out of dispatcher
// ============================================================================

const PM_WIRING_DIAG_BUILD = "pm-wiring-diag-core-2026-04-26-01";

export async function handlePmWiringDiag({ bot, chatId, ctx = {} }) {
  const bypass = !!ctx.bypass;

  if (!bypass) {
    await bot.sendMessage(
      chatId,
      "Только монарх может смотреть Project Memory diagnostics."
    );
    return;
  }

  const diag = {
    command: "/pm_wiring_diag",
    build: PM_WIRING_DIAG_BUILD,
    transportPath: "core/TelegramAdapter -> handleMessage -> commandDispatcher",
    dispatcherPath:
      "src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js",
    handlerPath: "src/bot/handlers/pmWiringDiag.js",
    bypass,
    chatId: String(ctx.chatIdStr || ctx.chatId || chatId || ""),
    transport: String(ctx.transport || "telegram"),
    chatType: String(ctx.chatType || ctx.identityCtx?.chatType || "unknown"),
    isPrivateChat: !!ctx.isPrivateChat,
    functions: {
      getProjectSection: typeof ctx.getProjectSection === "function",
      upsertProjectSection: typeof ctx.upsertProjectSection === "function",
      getProjectMemoryList: typeof ctx.getProjectMemoryList === "function",
      recordProjectWorkSession: typeof ctx.recordProjectWorkSession === "function",
      updateProjectWorkSession: typeof ctx.updateProjectWorkSession === "function",
      listConfirmedProjectMemoryEntries:
        typeof ctx.listConfirmedProjectMemoryEntries === "function",
      writeConfirmedProjectMemory:
        typeof ctx.writeConfirmedProjectMemory === "function",
    },
  };

  try {
    console.log("🧠 PROJECT_MEMORY_WIRING_DIAG_CORE", diag);
  } catch (_) {}

  const lines = [
    "🧠 Project Memory wiring diag",
    "",
    `build: ${diag.build}`,
    `transportPath: ${diag.transportPath}`,
    `dispatcherPath: ${diag.dispatcherPath}`,
    `handlerPath: ${diag.handlerPath}`,
    "",
    `bypass: ${diag.bypass ? "yes" : "no"}`,
    `transport: ${diag.transport}`,
    `chatType: ${diag.chatType}`,
    `private: ${diag.isPrivateChat ? "yes" : "no"}`,
    `chatId: ${diag.chatId}`,
    "",
    "Functions:",
    `- getProjectSection: ${diag.functions.getProjectSection ? "OK" : "MISSING"}`,
    `- upsertProjectSection: ${diag.functions.upsertProjectSection ? "OK" : "MISSING"}`,
    `- getProjectMemoryList: ${diag.functions.getProjectMemoryList ? "OK" : "MISSING"}`,
    `- recordProjectWorkSession: ${diag.functions.recordProjectWorkSession ? "OK" : "MISSING"}`,
    `- updateProjectWorkSession: ${diag.functions.updateProjectWorkSession ? "OK" : "MISSING"}`,
    `- listConfirmedProjectMemoryEntries: ${diag.functions.listConfirmedProjectMemoryEntries ? "OK" : "MISSING"}`,
    `- writeConfirmedProjectMemory: ${diag.functions.writeConfirmedProjectMemory ? "OK" : "MISSING"}`,
    "",
    "Result:",
    "This command was handled by the core dispatcher path, not legacy projectMemoryCommands.js.",
  ];

  await bot.sendMessage(chatId, lines.join("\n"));
}

export default handlePmWiringDiag;
