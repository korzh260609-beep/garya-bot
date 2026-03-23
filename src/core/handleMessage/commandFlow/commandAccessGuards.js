// src/core/handleMessage/commandFlow/commandAccessGuards.js

import { checkRateLimit } from "../../../bot/rateLimiter.js";
import { BehaviorEventsService } from "../../../logging/BehaviorEventsService.js";
import {
  CMD_RL_WINDOW_MS,
  CMD_RL_MAX,
  IDEMPOTENCY_BYPASS,
} from "../shared.js";

const behaviorEvents = new BehaviorEventsService();

export async function handleCommandRateLimitAndPermission({
  transport,
  chatIdStr,
  globalUserId,
  senderId,
  cmdBase,
  userRole,
  userPlan,
  isMonarchUser,
  canProceed,
  replyAndLog,
}) {
  if (!isMonarchUser && cmdBase !== "/start" && cmdBase !== "/help") {
    const rlKey = `${senderId || ""}:${chatIdStr}:cmd`;
    const rl = checkRateLimit({
      key: rlKey,
      windowMs: CMD_RL_WINDOW_MS,
      max: CMD_RL_MAX,
    });

    if (!rl.allowed) {
      try {
        await behaviorEvents.logEvent({
          globalUserId: globalUserId || null,
          chatId: chatIdStr,
          transport,
          eventType: "rate_limited",
          metadata: {
            cmd: cmdBase,
            windowMs: CMD_RL_WINDOW_MS,
            max: CMD_RL_MAX,
            senderId: senderId || null,
          },
          schemaVersion: 1,
        });
      } catch (e) {
        console.error("handleMessage(rate_limited logEvent) failed:", e);
      }

      const sec = Math.ceil(rl.retryAfterMs / 1000);
      await replyAndLog(`⛔ Слишком часто. Подожди ${sec} сек.`, {
        cmd: cmdBase,
        event: "rate_limited",
      });

      return {
        handled: true,
        response: { ok: true, stage: "3.5", result: "rate_limited", cmdBase },
      };
    }
  }

  if (!canProceed && !IDEMPOTENCY_BYPASS.has(cmdBase)) {
    try {
      await behaviorEvents.logEvent({
        globalUserId: globalUserId || null,
        chatId: chatIdStr,
        transport,
        eventType: "permission_denied",
        metadata: {
          cmd: cmdBase,
          userRole,
          userPlan,
          senderId: senderId || null,
        },
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("handleMessage(permission_denied logEvent) failed:", e);
    }

    await replyAndLog("⛔ Недостаточно прав.", {
      cmd: cmdBase,
      event: "permission_denied",
    });

    return {
      handled: true,
      response: { ok: true, stage: "6.logic.2", result: "permission_denied", cmdBase },
    };
  }

  return { handled: false };
}