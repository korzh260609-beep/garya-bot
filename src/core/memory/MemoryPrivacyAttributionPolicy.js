// src/core/memory/MemoryPrivacyAttributionPolicy.js
// STAGE 7.8.8 — PRIVACY / ATTRIBUTION / GROUP-SAFETY RULES (SKELETON)
//
// Goal:
// - define privacy boundaries for memory recall and restore
// - keep ownership, speaker attribution, and chat scope explicit
// - prevent cross-user and cross-group memory leakage
// - prepare safe checks for future group/private memory runtime
//
// IMPORTANT SAFETY RULES:
// - NO DB schema changes.
// - NO DB reads here.
// - NO AI logic here.
// - NO automatic prompt injection.
// - NO writes here.
// - This module is deterministic policy/diagnostic only.

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

function _normalizeChatType(value) {
  const v = _safeStr(value).trim().toLowerCase();
  return v || "unknown";
}

function _isGroupChatType(value) {
  const v = _normalizeChatType(value);
  return v === "group" || v === "supergroup";
}

export const MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION =
  "memory-privacy-attribution-policy-7.8.8-001";

export const MEMORY_PRIVACY_SCOPE = Object.freeze({
  PRIVATE_USER: "private_user",
  GROUP_SHARED: "group_shared",
  GROUP_USER_PERSONAL: "group_user_personal",
  PROJECT: "project",
  UNKNOWN: "unknown",
});

export const MEMORY_PRIVACY_DEFAULTS = Object.freeze({
  allowCrossUserRecall: false,
  allowCrossGroupRecall: false,
  allowPrivateMemoryInGroup: false,
  allowGroupMemoryInPrivate: false,
  requireSpeakerAttributionInGroup: true,
  requireOwnerForPersonalMemory: true,
  requireChatScopeForGroupMemory: true,
  rawPromptInjectionAllowed: false,
  failClosedOnMissingOwner: true,
  failClosedOnMissingChatScope: true,
});

export function getMemoryPrivacyAttributionPolicy() {
  return {
    ok: true,
    version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
    scopes: MEMORY_PRIVACY_SCOPE,
    defaults: MEMORY_PRIVACY_DEFAULTS,
    invariants: [
      "personal memory must have an owner identity",
      "group memory must have a chat scope",
      "group recall must preserve speaker attribution",
      "private user memory must not be restored into group context by default",
      "group memory must not be restored into private context by default",
      "cross-user and cross-group recall are forbidden until approved later stages",
      "missing owner or missing chat scope must fail closed",
    ],
    forbiddenActions: [
      "cross_user_memory_recall",
      "cross_group_memory_recall",
      "private_memory_into_group_prompt",
      "group_memory_into_private_prompt",
      "unattributed_group_speaker_recall",
      "raw_prompt_injection",
    ],
  };
}

export function classifyMemoryPrivacyScope({
  globalUserId = null,
  chatId = null,
  chatType = null,
  metadata = {},
} = {}) {
  const meta = _safeObj(metadata);
  const globalUserIdStr = _safeStr(globalUserId || meta.globalUserId || meta.global_user_id).trim();
  const chatIdStr = _safeStr(chatId || meta.chatId || meta.chat_id).trim();
  const normalizedChatType = _normalizeChatType(chatType || meta.chatType || meta.chat_type);
  const explicitScope = _safeStr(meta.memoryScope || meta.privacyScope).trim();

  if (explicitScope && Object.values(MEMORY_PRIVACY_SCOPE).includes(explicitScope)) {
    return {
      ok: true,
      scope: explicitScope,
      globalUserId: globalUserIdStr || null,
      chatId: chatIdStr || null,
      chatType: normalizedChatType,
      version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
    };
  }

  if (_isGroupChatType(normalizedChatType) && globalUserIdStr && chatIdStr) {
    return {
      ok: true,
      scope: MEMORY_PRIVACY_SCOPE.GROUP_USER_PERSONAL,
      globalUserId: globalUserIdStr,
      chatId: chatIdStr,
      chatType: normalizedChatType,
      version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
    };
  }

  if (_isGroupChatType(normalizedChatType) && chatIdStr) {
    return {
      ok: true,
      scope: MEMORY_PRIVACY_SCOPE.GROUP_SHARED,
      globalUserId: null,
      chatId: chatIdStr,
      chatType: normalizedChatType,
      version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
    };
  }

  if (globalUserIdStr) {
    return {
      ok: true,
      scope: MEMORY_PRIVACY_SCOPE.PRIVATE_USER,
      globalUserId: globalUserIdStr,
      chatId: chatIdStr || null,
      chatType: normalizedChatType,
      version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
    };
  }

  return {
    ok: false,
    scope: MEMORY_PRIVACY_SCOPE.UNKNOWN,
    globalUserId: globalUserIdStr || null,
    chatId: chatIdStr || null,
    chatType: normalizedChatType,
    reason: "unknown_privacy_scope",
    version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
  };
}

export function buildMemoryAttribution({
  globalUserId = null,
  chatId = null,
  chatType = null,
  senderId = null,
  senderName = null,
  senderUsername = null,
  role = null,
  metadata = {},
} = {}) {
  const meta = _safeObj(metadata);
  const scope = classifyMemoryPrivacyScope({ globalUserId, chatId, chatType, metadata: meta });
  const senderIdStr = _safeStr(senderId || meta.senderId || meta.senderIdStr).trim();
  const senderNameStr = _safeStr(senderName || meta.senderName).trim();
  const senderUsernameStr = _safeStr(senderUsername || meta.senderUsername).trim();
  const roleStr = _safeStr(role || meta.role).trim() || "unknown";

  return {
    ok: scope.ok,
    scope: scope.scope,
    globalUserId: scope.globalUserId,
    chatId: scope.chatId,
    chatType: scope.chatType,
    speaker: {
      senderId: senderIdStr || null,
      senderName: senderNameStr || null,
      senderUsername: senderUsernameStr || null,
      role: roleStr,
      label:
        senderNameStr ||
        (senderUsernameStr ? (senderUsernameStr.startsWith("@") ? senderUsernameStr : `@${senderUsernameStr}`) : null) ||
        (senderIdStr ? `user:${senderIdStr}` : null) ||
        "unknown_speaker",
    },
    requiresAttribution: _isGroupChatType(scope.chatType),
    version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
  };
}

export function assertMemoryPrivacyAllowed({
  source = {},
  target = {},
  metadata = {},
} = {}) {
  const src = _safeObj(source);
  const dst = _safeObj(target);
  const meta = _safeObj(metadata);
  const errors = [];

  const sourceScope = classifyMemoryPrivacyScope(src);
  const targetScope = classifyMemoryPrivacyScope(dst);

  if (!sourceScope.ok) errors.push("invalid_source_scope");
  if (!targetScope.ok) errors.push("invalid_target_scope");

  const sameUser =
    sourceScope.globalUserId &&
    targetScope.globalUserId &&
    sourceScope.globalUserId === targetScope.globalUserId;
  const sameChat =
    sourceScope.chatId && targetScope.chatId && sourceScope.chatId === targetScope.chatId;

  if (sourceScope.globalUserId && targetScope.globalUserId && !sameUser) {
    errors.push("cross_user_recall_forbidden");
  }

  if (sourceScope.chatId && targetScope.chatId && !sameChat) {
    errors.push("cross_group_or_cross_chat_recall_forbidden");
  }

  if (
    sourceScope.scope === MEMORY_PRIVACY_SCOPE.PRIVATE_USER &&
    targetScope.scope === MEMORY_PRIVACY_SCOPE.GROUP_SHARED
  ) {
    errors.push("private_memory_into_group_forbidden");
  }

  if (
    sourceScope.scope === MEMORY_PRIVACY_SCOPE.GROUP_SHARED &&
    targetScope.scope === MEMORY_PRIVACY_SCOPE.PRIVATE_USER
  ) {
    errors.push("group_memory_into_private_forbidden");
  }

  if (meta.rawPromptInjectionAllowed === true) {
    errors.push("raw_prompt_injection_allowed");
  }

  if (
    _isGroupChatType(sourceScope.chatType) &&
    MEMORY_PRIVACY_DEFAULTS.requireSpeakerAttributionInGroup &&
    !_safeStr(meta.speakerLabel || meta.senderName || meta.senderUsername || meta.senderId).trim()
  ) {
    errors.push("missing_group_speaker_attribution");
  }

  return {
    ok: errors.length === 0,
    errors,
    sourceScope,
    targetScope,
    version: MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
  };
}

export default {
  MEMORY_PRIVACY_ATTRIBUTION_POLICY_VERSION,
  MEMORY_PRIVACY_SCOPE,
  MEMORY_PRIVACY_DEFAULTS,
  getMemoryPrivacyAttributionPolicy,
  classifyMemoryPrivacyScope,
  buildMemoryAttribution,
  assertMemoryPrivacyAllowed,
};
