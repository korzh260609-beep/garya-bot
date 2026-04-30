// src/core/handleMessage/legacyProjectIntentFlow.js
// ============================================================================
// LEGACY PROJECT INTENT FLOW — DISCONNECTED SKELETON
//
// Purpose:
// - create a single future boundary for existing projectIntent/repo/diagnostic
//   legacy logic currently mixed into handleChatFlow;
// - do not connect this file to runtime yet;
// - do not add slash-commands;
// - do not create or expand Technical Mode;
// - do not create new diagnostic bridges;
// - do not execute projectIntent logic in this skeleton.
//
// This file exists to support the migration documented in:
// pillars/architecture/HANDLE_CHAT_FLOW_ISOLATION_PLAN.md
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

export const LEGACY_PROJECT_INTENT_FLOW_STATUS = Object.freeze({
  DISCONNECTED: "disconnected",
  NOT_HANDLED: "not_handled",
  BLOCKED: "blocked",
});

export function createLegacyProjectIntentFlowInput(input = {}) {
  return {
    text: safeText(input.text ?? input.trimmed),
    transport: safeText(input.transport) || "unknown",
    chatId: safeText(input.chatId ?? input.chatIdStr),
    chatType: safeText(input.chatType),
    globalUserId: safeText(input.globalUserId),
    senderId: safeText(input.senderId),
    messageId: input.messageId ?? null,
    isPrivateChat: input.isPrivateChat === true,
    isMonarchUser: input.isMonarchUser === true,
    userRole: safeText(input.userRole) || "guest",
    context: input.context || {},
    deps: input.deps || {},
    replyAndLog: input.replyAndLog || null,
    memory: input.memory || null,
  };
}

export async function handleLegacyProjectIntentFlow(input = {}) {
  const normalized = createLegacyProjectIntentFlowInput(input);

  return {
    ok: true,
    handled: false,
    dryRun: true,
    source: "legacyProjectIntentFlow",
    status: LEGACY_PROJECT_INTENT_FLOW_STATUS.DISCONNECTED,
    reason: "legacy_project_intent_flow_skeleton_not_connected",
    projectIntentRepoContext: null,
    projectContextDecision: null,
    projectMemoryAutoCaptureSummary: null,
    metadata: {
      noRuntimeConnection: true,
      noSlashCommandsAdded: true,
      noTechnicalModeExpansion: true,
      noDiagnosticBridgeAdded: true,
      noProjectIntentExecution: true,
      noStateChange: true,
    },
    input: {
      text: normalized.text,
      transport: normalized.transport,
      chatId: normalized.chatId,
      chatType: normalized.chatType,
      globalUserId: normalized.globalUserId,
      senderId: normalized.senderId,
      messageId: normalized.messageId,
      isPrivateChat: normalized.isPrivateChat,
      isMonarchUser: normalized.isMonarchUser,
      userRole: normalized.userRole,
    },
  };
}

export default {
  LEGACY_PROJECT_INTENT_FLOW_STATUS,
  createLegacyProjectIntentFlowInput,
  handleLegacyProjectIntentFlow,
};
