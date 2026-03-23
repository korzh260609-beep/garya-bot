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

import { getExplicitRememberClassifierVersion } from "./getExplicitRememberClassifierVersion.js";

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
    classifierVersion: getExplicitRememberClassifierVersion(rememberPlan),
    classifierMode: runtimeConfig?.mode,
  };
}

export default buildExplicitRememberMetadata;