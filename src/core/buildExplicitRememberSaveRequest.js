// src/core/buildExplicitRememberSaveRequest.js
//
// Goal:
// - move memory.remember() request preparation OUT of handleExplicitRemember.js
// - keep behavior identical
// - no DB
// - no side effects
// - deterministic only
//
// IMPORTANT:
// - this helper does NOT save memory
// - this helper only builds payload for memory.remember()

export function buildExplicitRememberSaveRequest({
  rememberKey,
  rememberValue,
  chatIdStr,
  globalUserId,
  transport,
  metadata,
}) {
  return {
    key: rememberKey,
    value: rememberValue,
    chatId: chatIdStr,
    globalUserId: globalUserId || null,
    transport,
    metadata,
    schemaVersion: 2,
  };
}

export default buildExplicitRememberSaveRequest;