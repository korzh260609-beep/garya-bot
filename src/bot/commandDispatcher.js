// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handlePrice } from "./handlers/price.js";

import { handleProfile } from "./handlers/profile.js";

import { handleMode } from "./handlers/mode.js";

import pool from "../../db.js";

import { handleStopTasksType } from "./handlers/stopTasksType.js";

import { handleUsersStats } from "./handlers/usersStats.js";

export async function dispatchCommand(cmd, ctx) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd) {
    case "/profile":
    case "/me":
    case "/whoami": {
      await handleProfile({ bot, chatId, chatIdStr });
      return { handled: true };
    }

case "/mode": {
  await handleMode({
    bot,
    chatId,
    chatIdStr,
    rest: ctx.rest,
    getAnswerMode: ctx.getAnswerMode,
    setAnswerMode: ctx.setAnswerMode,
  });
  return { handled: true };
}

    case "/price": {
      return await handlePrice({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceById,
        userRole,
        userPlan,
        bypass,
      });
    }

    case "/prices": {
      if (typeof ctx.rest !== "string") return { handled: false };
      if (typeof ctx.getCoinGeckoSimplePriceMulti !== "function") return { handled: false };

      const idsArg = (ctx.rest || "").trim().toLowerCase();
      const ids = idsArg
        ? idsArg
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : ["bitcoin", "ethereum", "solana"];

      const result = await ctx.getCoinGeckoSimplePriceMulti(ids, "usd", {
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypassPermissions: ctx.bypass,
      });

      if (!result.ok) {
        const errText = String(result.error || "");
        if (result.httpStatus === 429 || errText.includes("429")) {
          await bot.sendMessage(chatId, "⚠️ CoinGecko вернул лимит (HTTP 429). Попробуй ещё раз через 1–2 минуты.");
        } else {
          await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
        return { handled: true };
      }

      let out = "💰 Цены (CoinGecko, USD):\n\n";
      for (const id of ids) {
        const item = result.items?.[id];
        out += item ? `• ${item.id.toUpperCase()}: $${item.price}\n` : `• ${id.toUpperCase()}: нет данных\n`;
      }

      await bot.sendMessage(chatId, out);
      return { handled: true };
    }

    case "/users_stats": {
      await handleUsersStats({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

      case "/stop_tasks_type": {
  await handleStopTasksType({
    bot,
    chatId,
    rest: ctx.rest,
    bypass: ctx.bypass,
    pool,
  });
  return { handled: true };
}

    case "/help": {
      if (typeof ctx.handleHelpLegacy !== "function") return { handled: false };
      await ctx.handleHelpLegacy();
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
