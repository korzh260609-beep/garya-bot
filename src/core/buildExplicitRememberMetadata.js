// src/core/buildExplicitRememberMetadata.js
//
// Goal:
// - move explicit-remember metadata preparation OUT of handleExplicitRemember.js
// - keep behavior identical
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT save memory
// - this helper does NOT run V2
// - this helper only builds metadata for memory.remember()

export function buildExplicitRememberMetadata({
  chatIdStr,
  senderId,
  messageId,
  userRole,
  rememberRawValue,
  rememberPlan,
  runtimeConfig,
}) {
  return {
    source: "core.handleMessage.explicit_remember",
    senderId: senderId || null,
    chatId: chatIdStr,
    messageId: messageId ? Number(messageId) : null,
    userRole,
    explicitRememberRawValue: rememberRawValue,
    classifierVersion:
      rememberPlan?.selectedBy === "v2_safe_adoption" ? "v2" : "legacy",
    classifierMode: runtimeConfig?.mode,
  };
}

export default buildExplicitRememberMetadata;