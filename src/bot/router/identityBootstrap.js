// src/bot/router/identityBootstrap.js
// Extracted from messageRouter.js
// Purpose:
// - ensure user profile exists
// - resolve access pack / global user id
// - best-effort upsert chat
// - best-effort touch user <-> chat link
//
// IMPORTANT:
// This is extraction-only. No behavior change intended.

import { resolveUserAccess } from "../../users/userAccess.js";
import { ensureUserProfile } from "../../users/userProfile.js";
import { upsertChat } from "../../db/chatRepo.js";
import { touchUserChatLink } from "../../db/userChatLinkRepo.js";

export async function bootstrapRouterIdentityAndLinks({
  msg,
  chatIdStr,
  senderIdStr,
  chatType,
  isPrivate,
  isMonarchFn,
  chatGateMode,
  chatDefaultActive,
}) {
  if (!senderIdStr) {
    return {
      identityCtx: null,
      accessPack: null,
      globalUserId: null,
      isMonarchUser: false,
    };
  }

  await ensureUserProfile(msg);

  const isMonarchUser = isMonarchFn(senderIdStr);

  const identityCtx = {
    transport: "telegram",
    senderIdStr,
    chatIdStr,
    chatType,
    isPrivateChat: isPrivate,
    isMonarchUser,
  };

  const accessPack = await resolveUserAccess({
    senderIdStr,
    isMonarch: isMonarchFn,
    provider: identityCtx.transport,
  });

  const globalUserId =
    accessPack?.user?.global_user_id || accessPack?.global_user_id || null;

  // Stage 4 wiring (best-effort, NEVER block telegram flow)
  try {
    const nowIso = new Date().toISOString();
    const title =
      String(msg.chat?.title || "").trim() ||
      [msg.chat?.first_name, msg.chat?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      null;

    await upsertChat({
      chatId: chatIdStr,
      transport: "telegram",
      chatType: chatType || null,
      title,
      isActiveInsert: chatGateMode === "db" ? chatDefaultActive : null,
      lastSeenAt: nowIso,
      meta: null,
    });
  } catch (e) {
    console.error("Stage4 upsertChat failed:", e);
  }

  if (globalUserId) {
    try {
      const nowIso = new Date().toISOString();
      await touchUserChatLink({
        globalUserId,
        chatId: chatIdStr,
        transport: "telegram",
        lastSeenAt: nowIso,
        meta: null,
      });
    } catch (e) {
      console.error("Stage4 touchUserChatLink failed:", e);
    }
  }

  return {
    identityCtx,
    accessPack,
    globalUserId,
    isMonarchUser,
  };
}