// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handlePrices } from "./handlers/prices.js";

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
      return await handlePrices({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceMulti,
        userRole,
        userPlan,
        bypass,
      });
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
