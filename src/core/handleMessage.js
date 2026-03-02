// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.
//
// Evolution:
//   v1: SKELETON — derived chat meta only
//   v2: STAGE 7.1 — Memory shadow write
//   v3: STAGE 6 LOGIC STEP 1 — Access check + identity resolution (shadow-safe)
//
// IMPORTANT:
//   Still shadow-wired. No replies produced here.
//   TRANSPORT_ENFORCED=false by default — old messageRouter remains authoritative.
//   Access check result is computed and logged but NOT used to block yet.

import { deriveChatMeta } from "./transportMeta.js";
import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";

// ✅ STAGE 6 LOGIC — Access resolution
import { resolveUserAccess } from "../users/userAccess.js";
import { ensureUserProfile } from "../users/userProfile.js";
import { can } from "../users/permissions.js";
import { envStr } from "./config.js";

export async function handleMessage(context = {}) {
  const transport = String(context?.transport || "unknown");
  const chatId = context?.chatId == null ? null : String(context.chatId);
  const senderId = context?.senderId == null ? null : String(context.senderId);
  const text = context?.text == null ? "" : String(context.text);
  const messageId = context?.messageId == null ? null : String(context.messageId);

  let globalUserId =
    context?.globalUserId == null ? null : String(context.globalUserId);

  const derived = deriveChatMeta({
    transport,
    chatId,
    senderId,
    transportChatType: context?.transportChatType ?? context?.chatType ?? null,
  });

  const chatType = derived.chatType || null;
  const isPrivateChat =
    typeof context?.isPrivateChat === "boolean"
      ? context.isPrivateChat
      : derived.isPrivateChat;

  // =========================================================================
  // STAGE 6 LOGIC STEP 1 — Identity + Access (shadow-safe, never blocks flow)
  // =========================================================================

  let accessPack = null;
  let userRole = "guest";
  let userPlan = "free";
  let user = { role: "guest", plan: "free", global_user_id: null };

  // Only resolve for Telegram (other transports: skeleton)
  if (transport === "telegram" && senderId) {
    try {
      // ensureUserProfile needs raw msg shape — in shadow mode we reconstruct minimal shape
      // IMPORTANT: only call if context.raw is available (full Telegram update)
      if (context?.raw && typeof context.raw === "object") {
        await ensureUserProfile(context.raw);
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

      // Use resolved global_user_id if not already provided by transport layer
      if (!globalUserId && user?.global_user_id) {
        globalUserId = user.global_user_id;
      }
    } catch (e) {
      console.error("handleMessage(resolveUserAccess) failed:", e);
    }
  }

  // =========================================================================
  // STAGE 6 LOGIC — isMonarch derived from resolved role (not from env directly)
  // =========================================================================
  const isMonarchUser = userRole === "monarch";

  // =========================================================================
  // STAGE 6 LOGIC — Permission check (shadow: compute but don't block yet)
  // =========================================================================
  // Determine if this is a command
  const trimmed = text.trim();
  const isCommand = trimmed.startsWith("/");
  const cmdBase = isCommand
    ? trimmed.split(/\s+/)[0].split("@")[0]
    : null;

  // Example: check if user can use command (shadow — result logged only)
  let canProceed = true;
  if (isCommand && cmdBase) {
    const { CMD_ACTION } = await import("../bot/cmdActionMap.js").catch(() => ({
      CMD_ACTION: {},
    }));
    const action = CMD_ACTION[cmdBase];
    if (action) {
      canProceed = can(user, action);
    }
  }

  // =========================================================================
  // Trace log (TRANSPORT_TRACE only)
  // =========================================================================
  try {
    if (isTransportTraceEnabled()) {
      console.log("📨 handleMessage(v3)", {
        transport,
        chatId,
        senderId,
        globalUserId,
        chatType,
        isPrivateChat,
        isMonarchUser,
        userRole,
        isCommand,
        cmdBase,
        canProceed,
      });
    }
  } catch {
    // ignore
  }

  // =========================================================================
  // STAGE 7.1 — Memory shadow write (SAFE)
  // Only when messageId is present (avoids duplicate writes)
  // =========================================================================
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);

    if (enabled && chatId && messageId && text) {
      await memory.write({
        chatId,
        globalUserId: globalUserId || null,
        role: "user",
        content: text,
        transport,
        metadata: {
          messageId,
          source: "core.handleMessage.shadow",
          chatType,
          isPrivateChat,
        },
        schemaVersion: 2,
      });
    }
  } catch (e) {
    console.error("handleMessage(memory shadow) failed:", e);
  }

  // No routing, no reply — shadow only.
  // Next step (LOGIC STEP 2): command routing + AI delegation.
  return {
    ok: true,
    stage: "6.logic.1",
    note: "access check wired (shadow). routing + reply — next step.",
    transport,
    userRole,
    isMonarchUser,
    canProceed,
  };
}

export default handleMessage;
