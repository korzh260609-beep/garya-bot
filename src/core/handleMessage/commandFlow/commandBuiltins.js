// src/core/handleMessage/commandFlow/commandBuiltins.js

export async function handleBuiltInCommand({
  cmdBase,
  replyAndLog,
}) {
  if (cmdBase === "/start") {
    await replyAndLog(
      [
        "✅ SG online.",
        "",
        "Базовые команды:",
        "- /link_start — начать привязку identity",
        "- /link_confirm <code> — подтвердить привязку",
        "- /link_status — проверить статус",
        "",
        "ℹ️ /help — подсказка по командам (в зависимости от прав).",
      ].join("\n"),
      { cmd: cmdBase, event: "start" }
    );

    return {
      handled: true,
      response: { ok: true, stage: "6.logic.2", result: "start_replied", cmdBase },
    };
  }

  if (cmdBase === "/help") {
    await replyAndLog(
      [
        "ℹ️ Help",
        "",
        "Базовые команды:",
        "- /link_start",
        "- /link_confirm <code>",
        "- /link_status",
        "",
        "Dev/системные команды — только для монарха в личке.",
      ].join("\n"),
      { cmd: cmdBase, event: "help" }
    );

    return {
      handled: true,
      response: { ok: true, stage: "6.logic.2", result: "help_replied", cmdBase },
    };
  }

  return { handled: false };
}