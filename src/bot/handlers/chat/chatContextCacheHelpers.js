// src/bot/handlers/chat/chatContextCacheHelpers.js

import {
  saveRecentDocumentForExport,
} from "./outputSessionCache.js";
import { saveActiveDocumentContext } from "./activeDocumentContextCache.js";
import { saveActiveDocumentExportTarget } from "./activeDocumentExportTargetCache.js";
import { saveActiveExportSource } from "./activeExportSourceCache.js";
import {
  safeText,
  normalizePreferredExportKind,
  normalizeDocumentExportTarget,
} from "./chatShared.js";

export function saveExportSourceContext({
  chatId,
  sourceKind,
  chatIdStr,
  messageId,
  reason,
}) {
  const normalizedSourceKind = normalizePreferredExportKind(sourceKind);
  if (!normalizedSourceKind) return null;

  return saveActiveExportSource({
    chatId,
    sourceKind: normalizedSourceKind,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "active_export_source"),
    },
  });
}

export function saveDocumentExportTargetContext({
  chatId,
  target,
  chatIdStr,
  messageId,
  reason,
}) {
  const normalizedTarget = normalizeDocumentExportTarget(target);
  if (!normalizedTarget) return null;

  return saveActiveDocumentExportTarget({
    chatId,
    target: normalizedTarget,
    meta: {
      chatIdStr,
      messageId,
      reason: safeText(reason || "document_export_target_active"),
    },
  });
}

export function hydrateRecentRuntimeDocumentIntoCaches({
  chatId,
  chatIdStr,
  messageId,
  FileIntake,
}) {
  const getRecentDocumentSessionCache =
    typeof FileIntake?.getRecentDocumentSessionCache === "function"
      ? FileIntake.getRecentDocumentSessionCache
      : null;

  if (!getRecentDocumentSessionCache) return null;

  const recentRuntimeDocument = getRecentDocumentSessionCache(chatId);
  if (!recentRuntimeDocument?.text) return null;

  saveRecentDocumentForExport({
    chatId,
    text: recentRuntimeDocument.text,
    baseName:
      recentRuntimeDocument?.fileName ||
      recentRuntimeDocument?.title ||
      "document_context",
    meta: {
      source: "document_runtime_text_hydrated",
      fileName: recentRuntimeDocument?.fileName || null,
      title: recentRuntimeDocument?.title || null,
      chatIdStr,
      messageId,
    },
  });

  saveActiveDocumentContext({
    chatId,
    fileName: recentRuntimeDocument?.fileName || "",
    title: recentRuntimeDocument?.title || "",
    text: recentRuntimeDocument?.text || "",
    source: "runtime_document_session",
    meta: {
      chatIdStr,
      messageId,
    },
  });

  saveExportSourceContext({
    chatId,
    sourceKind: "document",
    chatIdStr,
    messageId,
    reason: "runtime_document_session",
  });

  return recentRuntimeDocument;
}

export default {
  saveExportSourceContext,
  saveDocumentExportTargetContext,
  hydrateRecentRuntimeDocumentIntoCaches,
};