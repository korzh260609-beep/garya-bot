// src/bot/handlers/projectAccessGuard.js
// ============================================================================
// SG project-only access guard
// Purpose:
// - allow internal SG project repo/github access ONLY to monarch
// - require private chat for project-only commands
// - enforce read-only project repo usage
// ============================================================================

import {
  resolveHandlerAccess,
  requireMonarchPrivateAccess,
} from "./handlerAccess.js";

import {
  PROJECT_ONLY_FEATURES,
  isProjectReadOnlyFeature,
} from "./projectAccessScope.js";

function safeString(value) {
  return String(value ?? "").trim();
}

function normalizeFeature(feature) {
  const value = safeString(feature);
  return value || PROJECT_ONLY_FEATURES.PROJECT_REPO_ACCESS;
}

async function replyText(ctx = {}, text) {
  if (typeof ctx?.reply === "function") {
    await ctx.reply(text, {
      handler: "projectAccessGuard",
      event: "project_access_denied",
    });
    return;
  }

  const bot = ctx?.bot || null;
  const chatId = ctx?.chatId ?? null;
  if (bot && chatId !== null && chatId !== undefined) {
    await bot.sendMessage(chatId, text);
  }
}

export async function requireProjectMonarchPrivateAccess(
  ctx = {},
  { feature, command } = {}
) {
  const access = resolveHandlerAccess(ctx);
  const normalizedFeature = normalizeFeature(feature);
  const normalizedCommand = safeString(command);

  const monarchPrivateOk = await requireMonarchPrivateAccess(ctx);
  if (!monarchPrivateOk) {
    return false;
  }

  if (!isProjectReadOnlyFeature(normalizedFeature)) {
    await replyText(
      ctx,
      `⛔ Project feature is blocked: ${normalizedFeature || "unknown"}`
    );
    return false;
  }

  // Defensive rule:
  // all current project features must be read-only from repo/GitHub perspective.
  // This guard prevents accidental future expansion into write paths.
  if (
    normalizedCommand === "/repo_write" ||
    normalizedCommand === "/repo_commit" ||
    normalizedCommand === "/repo_push" ||
    normalizedCommand === "/repo_pr" ||
    normalizedCommand === "/repo_merge"
  ) {
    await replyText(ctx, "⛔ SG project repo access is read-only.");
    return false;
  }

  return true;
}

export function buildProjectAccessMeta(ctx = {}, { feature, command } = {}) {
  const access = resolveHandlerAccess(ctx);

  return {
    feature: normalizeFeature(feature),
    command: safeString(command),
    isMonarchUser: !!access.isMonarchUser,
    isPrivateChat: !!access.isPrivateChat,
    userRole: access.userRole || "guest",
    userPlan: access.userPlan || "free",
    globalUserId: access.globalUserId || null,
    senderIdStr: access.senderIdStr || "",
    chatIdStr: access.chatIdStr || "",
    transport: access.transport || "telegram",
    chatType: access.chatType || "",
    readOnly: true,
  };
}

export default {
  requireProjectMonarchPrivateAccess,
  buildProjectAccessMeta,
};