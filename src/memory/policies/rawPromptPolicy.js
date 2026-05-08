// src/memory/policies/rawPromptPolicy.js
// SG 2.0 — Raw Prompt Policy Skeleton
//
// Purpose:
// - Block uncontrolled raw dialogue/log/archive injection into AI prompts.
// - Deterministic and dependency-free.
// - No DB access, no transport logic, no AI calls, no source fetching.

export const RAW_PROMPT_POLICY_VERSION = 1;

export function getRawPromptPolicy() {
  return {
    version: RAW_PROMPT_POLICY_VERSION,
    default: "block_raw_prompt_injection",
    rawDialoguePromptFacingByDefault: false,
    allowedOnlyThroughBoundedRestore: true,
    requiresAttribution: true,
    requiresSizeLimit: true,
    requiresPrivacyScopeCheck: true,
    forbidden: [
      "inject_raw_chat_history_by_default",
      "inject_raw_group_messages_without_attribution",
      "inject_secrets_or_env_values",
      "use_raw_archive_as_confirmed_memory",
      "dump_unbounded_logs_or_repo_files_into_prompt",
    ],
  };
}

export function assertRawPromptAllowed({
  restoreApproved = false,
  bounded = false,
  hasAttribution = false,
  privacyChecked = false,
  containsSecret = false,
} = {}) {
  const errors = [];

  if (!restoreApproved) errors.push("restore_not_approved");
  if (!bounded) errors.push("restore_not_bounded");
  if (!hasAttribution) errors.push("missing_attribution");
  if (!privacyChecked) errors.push("privacy_not_checked");
  if (containsSecret) errors.push("contains_secret");

  return {
    ok: errors.length === 0,
    decision: errors.length === 0 ? "ALLOW_BOUNDED_RESTORE" : "BLOCK_RAW_PROMPT",
    errors,
    policy: getRawPromptPolicy(),
  };
}

export default {
  RAW_PROMPT_POLICY_VERSION,
  getRawPromptPolicy,
  assertRawPromptAllowed,
};
