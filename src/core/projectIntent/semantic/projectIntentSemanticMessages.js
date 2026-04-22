// src/core/projectIntent/semantic/projectIntentSemanticMessages.js

import { safeText } from "./projectIntentSemanticText.js";

export function buildSemanticMessages({
  text,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const activeScope = followupContext?.projectContextScope || {};

  const contextLines = [
    `current_user_message: ${safeText(text)}`,
    `active_repo_context: ${followupContext?.isActive === true ? "yes" : "no"}`,
    `active_repo_target_entity: ${safeText(followupContext?.targetEntity)}`,
    `active_repo_target_path: ${safeText(followupContext?.targetPath)}`,
    `active_repo_display_mode: ${safeText(followupContext?.displayMode)}`,
    `active_repo_action_kind: ${safeText(followupContext?.actionKind)}`,
    `active_repo_object_kind: ${safeText(followupContext?.objectKind)}`,
    `active_repo_continuation: ${followupContext?.continuation?.isActive === true ? "yes" : "no"}`,
    `active_repo_continuation_target_path: ${safeText(followupContext?.continuation?.targetPath)}`,
    `active_repo_continuation_display_mode: ${safeText(followupContext?.continuation?.displayMode)}`,
    `active_repo_scope_project_key: ${safeText(activeScope?.projectKey)}`,
    `active_repo_scope_project_area: ${safeText(activeScope?.projectArea)}`,
    `active_repo_scope_repo: ${safeText(activeScope?.repoScope)}`,
    `active_repo_scope_linked_area: ${safeText(activeScope?.linkedArea)}`,
    `active_repo_scope_linked_repo: ${safeText(activeScope?.linkedRepo)}`,
    `active_repo_scope_cross_repo: ${
      typeof activeScope?.crossRepo === "boolean"
        ? String(activeScope.crossRepo)
        : ""
    }`,
    `pending_choice_active: ${pendingChoiceContext?.isActive === true ? "yes" : "no"}`,
    `pending_choice_target_entity: ${safeText(pendingChoiceContext?.targetEntity)}`,
    `pending_choice_target_path: ${safeText(pendingChoiceContext?.targetPath)}`,
    `pending_choice_display_mode: ${safeText(pendingChoiceContext?.displayMode)}`,
  ].join("\n");

  return [
    {
      role: "system",
      content:
        "You are a semantic parser for INTERNAL REPO DIALOGUE.\n" +
        "Task: understand USER MEANING, not command words.\n" +
        "Return ONLY strict JSON.\n" +
        "Do not explain.\n" +
        "Do not hallucinate files.\n" +
        "Prefer active repo context and pending choice context.\n" +
        "Prefer object understanding: repo root, folder, file, continuation.\n" +
        "If active repo continuation exists and user asks to continue, use continue_active.\n" +
        "If active repo action is browse_folder and user mentions a basename like DOCS_GOVERNANCE.md, treat it as a file inside that active folder.\n" +
        "If active repo object is file and user asks about a command, function, method, important part, random part, section, or says 'здесь/в этом файле', prefer explain_active.\n" +
        "Do not ask for a new target when active file context already answers the question.\n" +
        "If user asks what is inside a folder, prefer browse_folder.\n" +
        "If user asks what a file is about, prefer explain_target.\n" +
        "If user asks to show repository tree, default to root-first.\n" +
        "projectContextScope fields are OPTIONAL.\n" +
        "Use them only when they are explicit from active repo context or from an explicit repo object target.\n" +
        "Do not invent linked repo or cross-repo relations.\n" +
        "JSON shape:\n" +
        "{\n" +
        '  "intent": "repo_status|show_tree|browse_folder|find_target|find_and_explain|open_target|explain_target|explain_active|answer_pending_choice|continue_active|unknown",\n' +
        '  "targetEntity": "string",\n' +
        '  "targetPath": "string",\n' +
        '  "displayMode": "raw|raw_first_part|summary|explain|translate_ru",\n' +
        '  "treePrefix": "string",\n' +
        '  "objectKind": "repo|root|folder|file|unknown",\n' +
        '  "clarifyNeeded": true,\n' +
        '  "clarifyQuestion": "string",\n' +
        '  "confidence": "low|medium|high",\n' +
        '  "projectContextScope": {\n' +
        '    "projectKey": "string",\n' +
        '    "projectArea": "string",\n' +
        '    "repoScope": "string",\n' +
        '    "linkedArea": "string",\n' +
        '    "linkedRepo": "string",\n' +
        '    "crossRepo": true\n' +
        "  }\n" +
        "}",
    },
    {
      role: "user",
      content: contextLines,
    },
  ];
}