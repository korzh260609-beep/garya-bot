// src/core/projectIntent/projectIntentConversationContext.js

import { safeText } from "./projectIntentConversationShared.js";
import { buildProjectContextScopeFromRepoContext } from "./projectIntentProjectContextScope.js";

function safeParseJsonArray(value) {
  try {
    const parsed = JSON.parse(String(value ?? ""));
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOptionalText(value) {
  const s = safeText(value).toLowerCase();
  return s || "";
}

function normalizeProjectContextScope(value) {
  const source = safeObject(value);
  const out = {};

  const projectKey = safeText(source.projectKey);
  if (projectKey) out.projectKey = projectKey;

  const projectArea = normalizeOptionalText(source.projectArea);
  if (projectArea) out.projectArea = projectArea;

  const repoScope = normalizeOptionalText(source.repoScope);
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = normalizeOptionalText(source.linkedArea);
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = normalizeOptionalText(source.linkedRepo);
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

export function buildProjectIntentRoutingText(
  trimmed,
  followupContext = null,
  pendingChoiceContext = null
) {
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

    if (followupContext.objectKind) {
      parts.push("object_kind");
      parts.push(safeText(followupContext.objectKind));
    }

    if (followupContext.actionKind === "browse_folder" || followupContext.objectKind === "folder") {
      parts.push("active_folder");
      parts.push("folder_context");
      parts.push("folder");
      parts.push("directory");
      parts.push("inside_folder");
      parts.push(safeText(followupContext.targetPath));
      parts.push(safeText(followupContext.treePrefix));
    }

    if (
      followupContext.actionKind === "open_target" ||
      followupContext.actionKind === "find_and_explain" ||
      followupContext.actionKind === "explain_target" ||
      followupContext.objectKind === "file"
    ) {
      parts.push("active_file");
      parts.push("file_context");
      parts.push("document_context");
    }

    if (followupContext.continuation?.isActive === true) {
      parts.push("repo_continuation_active");
      parts.push("continuation");
      parts.push("next_part_available");
      parts.push(safeText(followupContext.continuation.targetPath));
      parts.push(safeText(followupContext.continuation.displayMode));
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

export async function getLatestProjectIntentRepoContext(
  memory,
  {
    chatIdStr,
    globalUserId,
    chatType,
  }
) {
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
        const explicitScope = normalizeProjectContextScope(meta.projectContextScope);
        const fallbackScope = buildProjectContextScopeFromRepoContext({
          isActive: true,
          targetEntity: safeText(meta.projectIntentTargetEntity),
          targetPath: safeText(meta.projectIntentTargetPath),
          objectKind: safeText(meta.projectIntentObjectKind),
        });

        const mergedScope = {
          ...fallbackScope,
          ...explicitScope,
        };

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

          objectKind: safeText(meta.projectIntentObjectKind),

          continuation: {
            isActive: meta?.projectIntentContinuationActive === true,
            sourceKind: safeText(meta.projectIntentContinuationSourceKind),
            targetPath: safeText(meta.projectIntentContinuationTargetPath),
            displayMode: safeText(meta.projectIntentContinuationDisplayMode),
            chunkIndex: Number(meta.projectIntentContinuationChunkIndex || 1),
            chunkCount: Number(meta.projectIntentContinuationChunkCount || 0),
            chunks: safeParseJsonArray(meta.projectIntentContinuationChunksJson),
            remainingText: safeText(meta.projectIntentContinuationRemainingText),
          },

          projectContextScope: mergedScope,
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
    objectKind: "",
    continuation: {
      isActive: false,
      sourceKind: "",
      targetPath: "",
      displayMode: "",
      chunkIndex: 1,
      chunkCount: 0,
      chunks: [],
      remainingText: "",
    },
    projectContextScope: {},
  };
}

export async function getLatestProjectIntentPendingChoice(
  memory,
  {
    chatIdStr,
    globalUserId,
    chatType,
  }
) {
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