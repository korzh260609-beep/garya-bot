// src/bot/router/basicPublicCommands.js

export async function handleBasicPublicCommands({ cmdBase, ctxReply }) {
  if (cmdBase === "/start") {
    await ctxReply(
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
      { cmd: cmdBase, handler: "messageRouter", event: "start" }
    );
    return true;
  }

  if (cmdBase === "/help") {
    await ctxReply(
      [
        "ℹ️ Help",
        "",
        "Базовые команды:",
        "- /link_start",
        "- /link_confirm <code> ",
        "- /link_status",
        "",
        "Dev/системные команды — только для монарха в личке.",
      ].join("\n"),
      { cmd: cmdBase, handler: "messageRouter", event: "help" }
    );
    return true;
  }

  return false;
}