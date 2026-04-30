// src/core/living-sg/LivingRequest.js
// ============================================================================
// LIVING SG — Request Skeleton
//
// Purpose:
// - normalize an incoming user message for the future Living SG path;
// - keep identity/scope/context separate from legacy technical/projectIntent routes;
// - perform no writes, no external calls, no command handling, no diagnostics.
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function safeBool(value) {
  return value === true;
}

export const LIVING_REQUEST_SOURCE = Object.freeze({
  LIVING_SG: "living_sg",
});

export function createLivingRequest(input = {}) {
  const text = safeText(input.text ?? input.trimmed);

  return {
    ok: true,
    source: LIVING_REQUEST_SOURCE.LIVING_SG,
    dryRun: true,
    text,
    transport: safeText(input.transport) || "unknown",
    chatId: safeText(input.chatId ?? input.chatIdStr),
    globalUserId: safeText(input.globalUserId),
    senderId: safeText(input.senderId),
    isPrivateChat: safeBool(input.isPrivateChat),
    isMonarchUser: safeBool(input.isMonarchUser),
    userRole: safeText(input.userRole) || "guest",
    activeProjectContext: input.activeProjectContext || null,
    hasActiveProjectSession: safeBool(input.hasActiveProjectSession),
    context: input.context || {},
    metadata: {
      createdBy: "LivingRequest",
      noRuntimeExecution: true,
      noTechnicalModeExpansion: true,
    },
  };
}

export default {
  LIVING_REQUEST_SOURCE,
  createLivingRequest,
};
