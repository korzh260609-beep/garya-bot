// src/bot/handlers/arCreateTest.js
// extracted from case "/ar_create_test" — no logic changes (only fix broken "..." part)

import { createAccessRequest } from "../../users/accessRequests.js";

export async function handleArCreateTest({
  bot,
  chatId,
  chatIdStr,
  userRole,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const nowIso = new Date().toISOString();

    const reqRow = await createAccessRequest({
      requesterChatId: chatIdStr,
      requesterName: "MONARCH_SELF_TEST",
      requesterRole: userRole,
      requestedAction: "cmd.admin.stop_all_tasks",
      requestedCmd: "/stop_all_tasks",
      meta: {
        test: true,
        createdBy: chatIdStr,
        at: nowIso,
        note: "Self-test request (7.11 V1).",
      },
    });

    const reqId = reqRow?.id;

    await bot.sendMessage(
      chatId,
      reqId
        ? `🧪 Создана тестовая заявка #${reqId}\nКоманды: /approve ${reqId} | /deny ${reqId}`
        : "⚠️ Не удалось создать тестовую заявку (id отсутствует)."
    );
  } catch (e) {
    console.error("❌ /ar_create_test error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка при создании тестовой заявки.");
  }
}

