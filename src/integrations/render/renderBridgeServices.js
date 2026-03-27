// src/bot/handlers/renderBridgeServices.js

import renderBridge from "../../integrations/render/RenderBridge.js";

async function sendChunked(bot, chatId, text) {
  const MAX = 3500;
  const full = String(text || "");

  if (full.length <= MAX) {
    await bot.sendMessage(chatId, full);
    return;
  }

  const lines = full.split("\n");
  let chunk = "";

  for (const line of lines) {
    const candidate = chunk ? `${chunk}\n${line}` : line;

    if (candidate.length > MAX) {
      if (chunk) {
        await bot.sendMessage(chatId, chunk);
        chunk = line;
      } else {
        await bot.sendMessage(chatId, line.slice(0, MAX - 1) + "…");
        chunk = "";
      }
    } else {
      chunk = candidate;
    }
  }

  if (chunk) {
    await bot.sendMessage(chatId, chunk);
  }
}

export async function handleRenderBridgeServices({
  bot,
  chatId,
  rest,
  bypass,
}) {
  if (!bypass) {
    await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
    return;
  }

  try {
    const items = await renderBridge.listServices({
      filter: typeof rest === "string" ? rest.trim() : "",
    });

    if (!items.length) {
      await bot.sendMessage(chatId, "Render services не найдены.");
      return;
    }

    let out = `🧩 Render services (${items.length})\n\n`;

    for (const item of items.slice(0, 25)) {
      out += `${item.name || "-"}\n`;
      out += `id=${item.id || "-"}\n`;
      out += `slug=${item.slug || "-"} type=${item.type || "-"} region=${item.region || "-"}\n`;
      out += `url=${item.url || "-"} suspended=${String(item.suspended)}\n\n`;
    }

    await sendChunked(bot, chatId, out);
  } catch (error) {
    await bot.sendMessage(
      chatId,
      `Ошибка RenderBridge services: ${error?.message || "unknown_error"}`
    );
  }
}

export default {
  handleRenderBridgeServices,
};