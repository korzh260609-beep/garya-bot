// src/memory/policies/groupMemoryPolicy.js
// SG 2.0 — Group Memory Policy Skeleton
//
// Purpose:
// - Prevent mixing personal user memory with shared group memory.
// - Deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const GROUP_MEMORY_POLICY_VERSION = 1;

export function getGroupMemoryPolicy() {
  return {
    version: GROUP_MEMORY_POLICY_VERSION,
    groupMemoryIsSharedOnly: true,
    personalMemoryRequiresGlobalUserId: true,
    groupMessagesRequireAttribution: true,
    groupMemoryMustNotBecomePersonalMemory: true,
    userToUserChatIsNotPersonalMemoryByDefault: true,
    forbidden: [
      "mix_personal_memories_between_group_users",
      "store_group_statement_as_user_memory_without_attribution",
      "store_user_to_user_talk_as_confirmed_memory_by_default",
      "recall_other_user_private_memory_in_group",
      "use_group_chat_id_as_personal_memory_owner",
      "remove_speaker_attribution_from_group_context",
    ],
  };
}

export function assertGroupMemoryAllowed({
  groupId = null,
  hasAttribution = false,
  isSharedGroupFact = false,
  containsPersonalMemory = false,
  attemptsPrivateRecall = false,
  globalUserId = null,
} = {}) {
  const errors = [];
  const warnings = [];

  if (!groupId) errors.push("missing_group_id");
  if (!hasAttribution) errors.push("missing_attribution");
  if (!isSharedGroupFact) warnings.push("not_confirmed_shared_group_fact");
  if (containsPersonalMemory && !globalUserId) errors.push("personal_memory_requires_global_user_id");
  if (attemptsPrivateRecall) errors.push("private_recall_in_group_blocked");

  return {
    ok: errors.length === 0,
    decision: errors.length === 0 ? "ALLOW_GROUP_MEMORY_CANDIDATE" : "BLOCK_GROUP_MEMORY",
    errors,
    warnings,
    policy: getGroupMemoryPolicy(),
  };
}

export default {
  GROUP_MEMORY_POLICY_VERSION,
  getGroupMemoryPolicy,
  assertGroupMemoryAllowed,
};
