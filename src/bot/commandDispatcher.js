// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handleStopTasksType } from "./handlers/stopTasksType.js";

import { handleUsersStats } from "./handlers/usersStats.js";

export async function dispatchCommand(cmd, ctx) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd) {
    case "/profile":
    case "/me":
    case "/whoami": {
      const res = await pool.query(
        "SELECT chat_id, name, role, language, created_at FROM users WHERE chat_id = $1",
        [chatIdStr]
      );

      if (!res.rows.length) {
        await bot.sendMessage(chatId, "Профиль не найден.");
        return { handled: true };
      }

      const u = res.rows[0];
      await bot.sendMessage(
        chatId,
        `🧾 Профиль\nID: ${u.chat_id}\nИмя: ${u.name}\nРоль: ${u.role}\nСоздан: ${u.created_at}`
      );
      return { handled: true };
    }

    case "/mode": {
      // Current behavior kept as you have it now (no changes).
      if (typeof ctx.getAnswerMode !== "function") return { handled: false };
      if (typeof ctx.setAnswerMode !== "function") return { handled: false };
      if (typeof ctx.rest !== "string") return { handled: false };

      const { rest } = ctx;

      if (!rest) {
        const mode = await ctx.getAnswerMode(chatIdStr);
        await bot.sendMessage(chatId, `Текущий режим ответов: ${mode}`);
        return { handled: true };
      }

      const ok = await ctx.setAnswerMode(chatIdStr, rest);
      if (!ok) {
        await bot.sendMessage(chatId, "Недопустимый режим. Используй: short | normal | long");
        return { handled: true };
      }

      await bot.sendMessage(chatId, `Режим ответов установлен: ${rest}`);
      return { handled: true };
    }

    case "/price": {
      if (typeof ctx.rest !== "string") return { handled: false };
      if (typeof ctx.getCoinGeckoSimplePriceById !== "function") return { handled: false };

      const coinId = ctx.rest.trim().toLowerCase();

      if (!coinId) {
        await bot.sendMessage(chatId, "Использование: /price <coinId>\nПример: /price bitcoin");
        return { handled: true };
      }

      const result = await ctx.getCoinGeckoSimplePriceById(coinId, "usd", {
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypassPermissions: ctx.bypass,
      });

      if (!result.ok) {
        const err = String(result.error || "");
        if (result.httpStatus === 429 || err.includes("429")) {
          await bot.sendMessage(chatId, "⚠️ CoinGecko вернул лимит (429). Попробуй через 1–2 минуты.");
        } else {
          await bot.sendMessage(chatId, `❌ Ошибка: ${result.error}`);
        }
        return { handled: true };
      }

      await bot.sendMessage(chatId, `💰 ${result.id.toUpperCase()}: $${result.price}`);
      return { handled: true };
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
