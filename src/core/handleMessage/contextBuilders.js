// src/core/handleMessage/contextBuilders.js

import { envStr } from "../config.js";

export function buildDispatchCommandContext({
  deps,
  cmdBase,
  chatIdNum,
  chatIdStr,
  senderId,
  rest,
  user,
  userRole,
  userPlan,
  isMonarchUser,
  globalUserId,
  transport,
  chatType,
  messageId,
  isPrivateChat,
  replyAndLog,
  raw,
}) {
  return {
    bot: deps.bot || null,
    msg: raw || null,
    raw: raw || null,
    chatId: chatIdNum,
    chatIdStr,
    senderIdStr: senderId || "",
    rest,
    user,
    userRole,
    userPlan,
    bypass: isMonarchUser,

    reply: async (text, meta = {}) => replyAndLog(text, { cmd: cmdBase, ...meta }),

    globalUserId,
    transport,
    chatType,
    messageId: messageId ? Number(messageId) : null,

    isPrivateChat,
    identityCtx: {
      transport,
      senderIdStr: senderId || "",
      chatIdStr,
      chatType,
      isPrivateChat,
      isMonarchUser,
    },
    getAnswerMode: deps.getAnswerMode,
    setAnswerMode: deps.setAnswerMode,
    callAI: deps.callAI,
    logInteraction: deps.logInteraction,
    getCoinGeckoSimplePriceById: deps.getCoinGeckoSimplePriceById,
    getCoinGeckoSimplePriceMulti: deps.getCoinGeckoSimplePriceMulti,
    getUserTasks: deps.getUserTasks,
    getTaskById: deps.getTaskById,
    runTaskWithAI: deps.runTaskWithAI,
    updateTaskStatus: deps.updateTaskStatus,
    createDemoTask: deps.createDemoTask,
    createManualTask: deps.createManualTask,
    createTestPriceMonitorTask: deps.createTestPriceMonitorTask,

    getProjectSection: deps.getProjectSection,
    getProjectMemoryList: deps.getProjectMemoryList,
    upsertProjectSection: deps.upsertProjectSection,
    recordProjectWorkSession: deps.recordProjectWorkSession,
    updateProjectWorkSession: deps.updateProjectWorkSession,

    upsertConfirmedProjectSectionState: deps.upsertConfirmedProjectSectionState,
    appendConfirmedProjectDecision: deps.appendConfirmedProjectDecision,
    appendConfirmedProjectConstraint: deps.appendConfirmedProjectConstraint,
    appendConfirmedProjectNextStep: deps.appendConfirmedProjectNextStep,
    writeConfirmedProjectMemory: deps.writeConfirmedProjectMemory,

    listConfirmedProjectMemoryEntries: deps.listConfirmedProjectMemoryEntries,
    getLatestConfirmedProjectMemoryEntry: deps.getLatestConfirmedProjectMemoryEntry,
    buildConfirmedProjectMemoryDigest: deps.buildConfirmedProjectMemoryDigest,

    runSourceDiagnosticsOnce: deps.runSourceDiagnosticsOnce,
    getAllSourcesSafe: deps.getAllSourcesSafe,
    fetchFromSourceKey: deps.fetchFromSourceKey,
    formatSourcesList: deps.formatSourcesList,
    diagnoseSource: deps.diagnoseSource,
    testSource: deps.testSource,
  };
}

export function buildChatHandlerContext({
  context,
  deps,
  chatIdNum,
  chatIdStr,
  senderId,
  globalUserId,
  userRole,
  trimmed,
  saveMessageToMemory,
  saveChatPair,
}) {
  return {
    bot: deps.bot,
    msg: context.raw,
    chatId: chatIdNum,
    chatIdStr,
    senderIdStr: senderId || "",
    globalUserId,
    userRole,
    trimmed,
    MAX_HISTORY_MESSAGES: deps.MAX_HISTORY_MESSAGES || 20,

    FileIntake: deps.FileIntake,

    telegramBotToken: deps.telegramBotToken || "",

    getChatHistory: deps.getChatHistory,
    saveMessageToMemory,
    saveChatPair,

    logInteraction: deps.logInteraction,
    loadProjectContext: deps.loadProjectContext,
    getAnswerMode: deps.getAnswerMode,
    buildSystemPrompt: deps.buildSystemPrompt,

    isMonarch: (id) => String(id || "") === envStr("MONARCH_USER_ID", ""),

    callAI: deps.callAI,
    sanitizeNonMonarchReply: deps.sanitizeNonMonarchReply,
  };
}
