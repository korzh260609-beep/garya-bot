// src/core/projectIntent/projectIntentConversationContext.js

import { safeText } from "./projectIntentConversationShared.js";

export function buildProjectIntentRoutingText(trimmed, followupContext = null, pendingChoiceContext = null) {
  const base = safeText(trimmed);

  const parts = [base];

  if (followupContext?.isActive) {
    parts.push("repo");
    parts.push(safeText(followupContext.targetEntity));
    parts.push(safeText(followupContext.targetPath));
  }

  if (pendingChoiceContext?.isActive) {
    parts.push("repo_pending_choice");
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