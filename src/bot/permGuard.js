// src/bot/permGuard.js
// V1: permissions guard + access request notification
// ВАЖНО: логика скопирована из messageRouter.js и вынесена без "улучшений".
// Stage 4: монарх определяется ТОЛЬКО по MONARCH_USER_ID (msg.from.id), не по chat_id.

import * as AccessRequests from "../users/accessRequests.js";
import { can } from "../users/permissions.js";

/**
 * Возвращает функцию requirePermOrReply(cmd, {rest})
 * - если action не найден в карте => true
 * - если can(user, action) => true
 * - иначе создаёт access request (если доступно) + отвечает гостю + уведомляет монарха
 */
export function buildRequirePermOrReply({
  bot,
  msg,
  MONARCH_USER_ID, // ✅ Stage 4 source of truth (Telegram user_id)
  user, // { role, plan, bypassPermissions }
  userRole,
  userPlan,
  trimmed,
  CMD_ACTION,
}) {
  const chatId = msg.chat.id;

  const senderId = msg.from?.id;
  const senderIdStr = senderId?.toString() || "";

  return async function requirePermOrReply(cmd, context = {}) {
    const action = CMD_ACTION?.[cmd];
    if (!action) return true;
    if (can(user, action)) return true;

    const requesterName =
      msg?.from?.username
        ? `@${msg.from.username}`
        : [msg?.from?.first_name, msg?.from?.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || null;

    try {
      if (typeof AccessRequests.createAccessRequestAndNotify === "function") {
        const pack = await AccessRequests.createAccessRequestAndNotify({
          bot,

          // ✅ IMPORTANT: AccessRequests expects "monarchChatId".
          // In Telegram private chat: chat_id == user_id, so MONARCH_USER_ID is valid target.
          monarchChatId: MONARCH_USER_ID,

          // We store requester id as senderIdStr (Telegram user_id).
          // This keeps stage4 identity and avoids mixing by chat_id in groups.
          requesterChatId: senderIdStr,

          requesterName,
          requesterRole: userRole,
          requestedAction: action,
          requestedCmd: cmd,
          meta: {
            cmd,
            action,
            role: userRole,
            plan: userPlan,
            text: (trimmed || "").slice(0, 800),
            rest: (context?.rest || "").slice(0, 1200),
            at: new Date().toISOString(),
          },
        });

        await bot.sendMessage(chatId, pack?.guestText || "⛔ Недостаточно прав.");
      } else if (typeof AccessRequests.createAccessRequest === "function") {
        const reqRow = await AccessRequests.createAccessRequest({
          requesterChatId: senderIdStr,
          requesterName,
          requesterRole: userRole,
          requestedAction: action,
          requestedCmd: cmd,
          meta: {
            cmd,
            action,
            role: userRole,
            plan: userPlan,
            text: (trimmed || "").slice(0, 800),
            rest: (context?.rest || "").slice(0, 1200),
            at: new Date().toISOString(),
          },
        });

        const reqId = reqRow?.id;

        await bot.sendMessage(
          chatId,
          reqId
            ? `⛔ Недостаточно прав.\n✅ Заявка #${reqId} отправлена монарху.`
            : "⛔ Недостаточно прав."
        );

        if (reqId) {
          try {
            await bot.sendMessage(
              Number(MONARCH_USER_ID),
              [
                `🛡️ ACCESS REQUEST #${reqId}`,
                `requester_user_id: ${senderIdStr}`,
                requesterName ? `name: ${requesterName}` : "",
                `role: ${userRole}`,
                `plan: ${userPlan}`,
                `requested_action: ${action}`,
                `requested_cmd: ${cmd}`,
                trimmed ? `text: ${(trimmed || "").slice(0, 500)}` : "",
                ``,
                `Команды: /approve ${reqId}  |  /deny ${reqId}`,
              ]
                .filter(Boolean)
                .join("\n")
            );
          } catch {
            // ignore
          }
        }
      } else {
        await bot.sendMessage(chatId, "⛔ Недостаточно прав.");
      }
    } catch {
      await bot.sendMessage(chatId, "⛔ Недостаточно прав.");
    }

    return false;
  };
}
