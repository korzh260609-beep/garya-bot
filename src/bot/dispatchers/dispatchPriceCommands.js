// src/bot/dispatchers/dispatchPriceCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handlePrice } from "../handlers/price.js";
import { handlePrices } from "../handlers/prices.js";

export async function dispatchPriceCommands({ cmd0, ctx }) {
  const { bot, chatId, rest } = ctx;

  switch (cmd0) {
    case "/price": {
      return await handlePrice({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceById: ctx.getCoinGeckoSimplePriceById,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
    }

    case "/prices": {
      return await handlePrices({
        bot,
        chatId,
        rest,
        getCoinGeckoSimplePriceMulti: ctx.getCoinGeckoSimplePriceMulti,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        bypass: ctx.bypass,
      });
    }

    default:
      return { handled: false };
  }
}