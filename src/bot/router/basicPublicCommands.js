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
        "Основной Render-операторский путь (монарх, личка):",
        "- /render_bridge_service <serviceId|name|slug>",
        "- /render_bridge_logs [minutes] [limit]",
        "- /render_bridge_diagnose [minutes]",
        "- /render_diag <log text>",
        "- /render_log_set <log text>",
        "- /render_diag_last",
        "",
        "ℹ️ /help — краткая подсказка по командам.",
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
        "- /link_confirm <code>",
        "- /link_status",
        "",
        "Основной Render-операторский путь (монарх, личка):",
        "1) Live Render:",
        "- /render_bridge_service <serviceId|name|slug>",
        "- /render_bridge_logs [minutes] [limit]",
        "- /render_bridge_diagnose [minutes]",
        "",
        "2) Если есть только текст лога:",
        "- /render_diag <log text>",
        "",
        "3) Если нужно сохранить один лог и проверять повторно:",
        "- /render_log_set <log text>",
        "- /render_diag_last",
        "",
        "4) История сохранённых snapshot:",
        "- /render_errors_last [limit] [sourceKey]",
        "- /render_deploys_last [limit] [sourceKey]",
        "",
        "Dev/системные команды — только для монарха в личке.",
      ].join("\n"),
      { cmd: cmdBase, handler: "messageRouter", event: "help" }
    );
    return true;
  }

  return false;
}