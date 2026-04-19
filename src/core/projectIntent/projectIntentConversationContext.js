// src/core/projectIntent/projectIntentConversationContext.js

import { safeText } from "./projectIntentConversationShared.js";

export function buildProjectIntentRoutingText(trimmed, followupContext = null, pendingChoiceContext = null) {
  const base = safeText(trimmed);

  const parts = [base];

  if (followupContext?.isActive) {
    parts.push("repo");
    parts.push("repo_active_context");
    parts.push(safeText(followupContext.targetEntity));
    parts.push(safeText(followupContext.targetPath));
    parts.push(safeText(followupContext.treePrefix));
    parts.push(safeText(followupContext.displayMode));
    parts.push(safeText(followupContext.actionKind));

    if (followupContext.actionKind === "browse_folder") {
      parts.push("active_folder");
      parts.push("folder_context");
      parts.push("folder");
      parts.push("directory");
      parts.push("inside_folder");
      parts.push(safeText(followupContext.targetPath));
      parts.push(safeText(followupContext.treePrefix));
    }

    if (followupContext.actionKind === "open_target" || followupContext.actionKind === "find_and_explain" || followupContext.actionKind === "explain_target") {
      parts.push("active_file");
      parts.push("file_context");
      parts.push("document_context");
    }
  }

  if (pendingChoiceContext?.isActive) {
    parts.push("repo_pending_choice");
    parts.push(safeText(pendingChoiceContext.kind));
    parts.push(safeText(pendingChoiceContext.targetEntity));
    parts.push(safeText(pendingChoiceContext.targetPath));
  }

  return parts.filter(Boolean).join(" ").trim();
}

export async function getLatestProjectIntentRepoContext(memory, {
  chatIdStr,
  globalUserId,
  chatType,
}) {
  try {
    const recent = await memory.recent({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      chatType,
      limit: 24,
    });

    const rows = Array.isArray(recent) ? recent : [];

    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const item = rows[i] || {};
      const meta = item?.metadata || {};

      if (meta?.projectIntentRepoContextActive === true) {
        return {
          isActive: true,
          targetEntity: safeText(meta.projectIntentTargetEntity),
          targetPath: safeText(meta.projectIntentTargetPath),
          displayMode: safeText(meta.projectIntentDisplayMode),
          sourceText: safeText(meta.projectIntentSourceText),
          largeDocument: meta?.projectIntentLargeDocument === true,
          treePrefix: safeText(meta.projectIntentTreePrefix),
          semanticConfidence: safeText(meta.projectIntentSemanticConfidence),
          actionKind: safeText(meta.projectIntentActionKind),
        };
      }
    }
  } catch (_) {}

  return {
    isActive: false,
    targetEntity: "",
    targetPath: "",
    displayMode: "",
    sourceText: "",
    largeDocument: false,
    treePrefix: "",
    semanticConfidence: "",
    actionKind: "",
  };
}

export async function getLatestProjectIntentPendingChoice(memory, {
  chatIdStr,
  globalUserId,
  chatType,
}) {
  try {
    const recent = await memory.recent({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      chatType,
      limit: 24,
    });

    const rows = Array.isArray(recent) ? recent : [];

    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const item = rows[i] || {};
      const meta = item?.metadata || {};

      if (meta?.projectIntentPendingChoiceActive === true) {
        return {
          isActive: true,
          kind: safeText(meta.projectIntentPendingChoiceKind),
          targetEntity: safeText(meta.projectIntentPendingChoiceTargetEntity),
          targetPath: safeText(meta.projectIntentPendingChoiceTargetPath),
          displayMode: safeText(meta.projectIntentPendingChoiceDisplayMode),
        };
      }
    }
  } catch (_) {}

  return {
    isActive: false,
    kind: "",
    targetEntity: "",
    targetPath: "",
    displayMode: "",
  };
}

export default {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
};
