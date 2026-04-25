// src/bot/handlers/confirmProjectAction.js
// ============================================================================
// STAGE 12B — confirmed project action command handler
// Purpose:
// - execute ONLY a previously saved pending SG-core intent
// - require monarch/private scope from dispatcher context
// - convert pending free-text through safe action builder before any write
// - write only supported structured actions into Project Memory
// IMPORTANT:
// - NO arbitrary free-text DB writes
// - NO generic command execution
// - NO repo writes
// ============================================================================

import { consumePendingProjectIntent } from "../../core/projectIntent/projectIntentPendingStore.js";
import { buildConfirmedProjectIntentAction } from "../../core/projectIntent/projectIntentConfirmedActionBuilder.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function buildUnsupportedText(reason = "unsupported_free_text_intent") {
  return [
    "⚠️ Подтверждённый запрос не выполнен.",
    "Причина: не удалось безопасно превратить free-text в структурированное действие.",
    `code: ${safeText(reason) || "unknown"}`,
    "",
    "Используй структурированную запись через /pm_session.",
  ].join("\n");
}

export async function handleConfirmProjectAction({
  bot,
  chatId,
  chatIdStr,
  globalUserId,
  transport = "telegram",
  bypass = false,
  isPrivateChat = false,
  recordProjectWorkSession,
}) {
  if (!bypass || !isPrivateChat) {
    await bot.sendMessage(
      chatId,
      "⛔ Подтверждение действий ядра SG доступно только монарху и только в личке."
    );
    return;
  }

  if (typeof recordProjectWorkSession !== "function") {
    await bot.sendMessage(
      chatId,
      "⛔ recordProjectWorkSession недоступен (ошибка wiring)."
    );
    return;
  }

  const pending = consumePendingProjectIntent({
    globalUserId,
    chatId: chatIdStr,
    transport,
  });

  if (!pending) {
    await bot.sendMessage(
      chatId,
      "⚠️ Нет ожидающего подтверждения или срок подтверждения истёк. Повтори исходный запрос."
    );
    return;
  }

  const built = buildConfirmedProjectIntentAction(pending);

  if (!built?.ok || !built?.action) {
    await bot.sendMessage(chatId, buildUnsupportedText(built?.reason));
    return;
  }

  const action = built.action;

  if (action.type !== "record_project_work_session") {
    await bot.sendMessage(chatId, buildUnsupportedText("unsupported_action_type"));
    return;
  }

  try {
    const saved = await recordProjectWorkSession({
      title: action.title,
      goal: action.goal,
      checked: action.checked,
      changed: action.changed,
      decisions: action.decisions,
      risks: action.risks,
      nextSteps: action.nextSteps,
      notes: action.notes,
      tags: action.tags,
      sourceType: action.sourceType,
      sourceRef:
        action.sourceRef || `telegram:${safeText(chatIdStr || chatId)}:/confirm_project_action`,
      relatedPaths: action.relatedPaths,
      moduleKey: action.moduleKey,
      stageKey: action.stageKey,
      meta: {
        ...(action.meta && typeof action.meta === "object" ? action.meta : {}),
        transport,
        confirmedBy: safeText(globalUserId),
        chatId: safeText(chatIdStr || chatId),
      },
    });

    await bot.sendMessage(
      chatId,
      [
        "✅ Подтверждённое действие выполнено.",
        "Запись сохранена в Project Memory.",
        `id: ${saved?.id ?? "-"}`,
        `section: ${saved?.section ?? "work_sessions"}`,
        `entry_type: ${saved?.entry_type ?? "session_summary"}`,
      ].join("\n")
    );
  } catch (e) {
    console.error("❌ /confirm_project_action error:", e);
    await bot.sendMessage(chatId, "⚠️ Ошибка выполнения подтверждённого действия.");
  }
}

export default {
  handleConfirmProjectAction,
};
