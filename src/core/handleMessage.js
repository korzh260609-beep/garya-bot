// src/core/handleMessage.js
// STAGE 6.4 — handleMessage(context) — Core entrypoint for any transport.

import { isTransportTraceEnabled } from "../transport/transportConfig.js";
import { getMemoryService } from "./memoryServiceFactory.js";
import { envBool } from "./handleMessage/shared.js";
import { dedupeSeenHasFresh, dedupeRemember } from "./handleMessage/dedupeMemory.js";
import { normalizeContext } from "./handleMessage/normalizeContext.js";
import { resolveIdentityAndAccess } from "./handleMessage/resolveIdentityAndAccess.js";
import { parseCommandAccess } from "./handleMessage/commandParsing.js";
import { buildReplyAndLog } from "./handleMessage/buildReplyAndLog.js";
import { handleCommandFlow } from "./handleMessage/handleCommandFlow.js";
import { handleChatFlow } from "./handleMessage/handleChatFlow.js";

export async function handleMessage(context = {}) {
  const normalized = normalizeContext(context);

  const {
    transport,
    chatId,
    senderId,
    text,
    messageId,
    raw,
    deps,
    hasReply,
    hasCallAI,
    isEnforced,
    globalUserId: initialGlobalUserId,
    chatType,
    isPrivateChat,
    bypassParsed,
    trimmed,
  } = normalized;

  let globalUserId = initialGlobalUserId;

  // =========================================================================
  // STAGE 6.8 — Enforced guard: no processing without dedupe key/messageId
  // =========================================================================
  if (isEnforced) {
    const dedupeKey = context?.dedupeKey || null;
    if (!dedupeKey || !messageId) {
      try {
        if (isTransportTraceEnabled()) {
          console.warn("ENFORCED_DROP_NO_DEDUPE", {
            transport,
            chatId,
            senderId,
            messageId,
            dedupeKey,
          });
        }
      } catch (_) {}
      return { ok: false, reason: "missing_dedupeKey", stage: "6.8" };
    }

    // =========================================================================
    // STAGE 8D — In-memory dedupe drop
    // =========================================================================
    try {
      if (!bypassParsed.isBypass) {
        const now = Date.now();
        const key = String(dedupeKey);

        if (dedupeSeenHasFresh(key, now)) {
          if (isTransportTraceEnabled()) {
            console.warn("ENFORCED_DROP_DUPLICATE", {
              transport,
              chatId,
              senderId,
              messageId,
              dedupeKey: key,
            });
          }
          return { ok: true, stage: "8D", result: "dup_drop" };
        }

        dedupeRemember(key, now);
      }
    } catch (e) {
      try {
        console.error("dedupe guard failed (fail-open):", e);
      } catch (_) {}
    }
  }

  // =========================================================================
  // STAGE 6 LOGIC STEP 1 — Identity + Access
  // =========================================================================
  const identity = await resolveIdentityAndAccess({
    transport,
    senderId,
    raw,
    globalUserId,
  });

  globalUserId = identity.globalUserId;

  const {
    accessPack,
    userRole,
    userPlan,
    user,
    isMonarchUser,
  } = identity;

  // =========================================================================
  // STAGE 6 LOGIC STEP 2 — Routing parse
  // =========================================================================
  const routing = parseCommandAccess({
    trimmed,
    user,
    isMonarchUser,
  });

  const {
    isCommand,
    parsed,
    cmdBase,
    rest,
    canProceed,
  } = routing;

  // =========================================================================
  // Trace log
  // =========================================================================
  try {
    if (isTransportTraceEnabled()) {
      console.log("📨 handleMessage(core)", {
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
        isEnforced,
      });
    }
  } catch {
    // ignore
  }

  // =========================================================================
  // STAGE 7.1 — Memory shadow write (OFF by default)
  // =========================================================================
  try {
    const memory = getMemoryService();
    const enabled = Boolean(memory?.config?.enabled);
    const shadowWriteEnabled = envBool("MEMORY_SHADOW_WRITE", false);

    if (!isEnforced && enabled && shadowWriteEnabled && chatId && messageId && text) {
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

  // =========================================================================
  // Shadow mode: compute routing but don't act
  // =========================================================================
  if (!isEnforced) {
    return {
      ok: true,
      stage: "6.shadow",
      note: "routing computed (shadow). deps not provided — no reply.",
      transport,
      userRole,
      isMonarchUser,
      isCommand,
      cmdBase,
      canProceed,
    };
  }

  // =========================================================================
  // ENFORCED MODE — real routing + reply
  // =========================================================================
  const chatIdNum = chatId ? Number(chatId) : null;
  const chatIdStr = chatId || "";

  if (!chatIdNum) {
    return { ok: false, reason: "missing_chatId" };
  }

  const replyAndLog = buildReplyAndLog({
    deps,
    context,
    transport,
    chatIdStr,
    chatType,
    globalUserId,
    senderId,
    messageId,
  });

  if (isCommand && cmdBase) {
    return handleCommandFlow({
      context,
      deps,
      transport,
      chatIdStr,
      chatIdNum,
      chatType,
      globalUserId,
      senderId,
      messageId,
      raw,
      trimmed,
      rest,
      cmdBase,
      user,
      userRole,
      userPlan,
      isMonarchUser,
      isPrivateChat,
      canProceed,
      replyAndLog,
      accessPack,
      parsed,
    });
  }

  if (typeof deps?.handleChatMessage === "function") {
    return handleChatFlow({
      context,
      deps,
      transport,
      chatIdStr,
      chatIdNum,
      chatType,
      globalUserId,
      senderId,
      messageId,
      raw,
      trimmed,
      userRole,
      isMonarchUser,
      isPrivateChat,
      replyAndLog,
    });
  }

  return { ok: false, reason: "no_handler" };
}

export default handleMessage;