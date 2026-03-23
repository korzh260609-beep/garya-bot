// src/core/handleMessage/resolveIdentityAndAccess.js

import { ensureUserProfile } from "../../users/userProfile.js";
import { resolveUserAccess } from "../../users/userAccess.js";
import { envStr } from "../config.js";

export async function resolveIdentityAndAccess({
  transport,
  senderId,
  raw,
  globalUserId,
}) {
  let accessPack = null;
  let userRole = "guest";
  let userPlan = "free";
  let user = { role: "guest", plan: "free", global_user_id: null };
  let resolvedGlobalUserId = globalUserId || null;

  if (transport === "telegram" && senderId) {
    try {
      if (raw) {
        await ensureUserProfile(raw);
      }
    } catch (e) {
      console.error("handleMessage(ensureUserProfile) failed:", e);
    }

    try {
      const MONARCH_USER_ID = envStr("MONARCH_USER_ID", "").trim();
      const isMonarchFn = (id) => String(id || "") === MONARCH_USER_ID;

      accessPack = await resolveUserAccess({
        senderIdStr: senderId,
        isMonarch: isMonarchFn,
        provider: transport,
      });

      userRole = accessPack?.userRole || "guest";
      userPlan = accessPack?.userPlan || "free";
      user = accessPack?.user || user;

      if (!resolvedGlobalUserId && user?.global_user_id) {
        resolvedGlobalUserId = user.global_user_id;
      }
    } catch (e) {
      console.error("handleMessage(resolveUserAccess) failed:", e);
    }
  }

  return {
    accessPack,
    userRole,
    userPlan,
    user,
    globalUserId: resolvedGlobalUserId,
    isMonarchUser: userRole === "monarch",
  };
}