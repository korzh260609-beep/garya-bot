// src/bot/dispatchers/dispatchCryptoDevCommands.js
// ============================================================================
// CRYPTO DEV COMMANDS DISPATCHER
// - extracted 1:1 from commandDispatcher
// - NO logic changes
// - ONLY routing isolation
// ============================================================================

import { handleTaDebug } from "../handlers/taDebug.js";
import { handleTaCore } from "../handlers/taCore.js";
import { handleNewsDebug } from "../handlers/newsDebug.js";
import { handleMultiMonitorDebug } from "../handlers/multiMonitorDebug.js";
import { handleCryptoDiagnostics } from "../handlers/cryptoDiagnostics.js";
import { handleCgVFuse } from "../handlers/cgVFuse.js";
import { handleBinanceDebug } from "../handlers/binanceDebug.js";
import { handleOkxDebug } from "../handlers/okxDebug.js";

export async function dispatchCryptoDevCommands({ cmd0, ctx, reply }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/ta_debug":
    case "/ta_debug_full":
    case "/ta_snapshot":
    case "/ta_snapshot_full": {
      await handleTaDebug({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/ta_core":
    case "/ta_core_full": {
      await handleTaCore({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/news_rss":
    case "/news_rss_full": {
      await handleNewsDebug({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/multi_monitor":
    case "/multi_monitor_full": {
      await handleMultiMonitorDebug({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/crypto_diag":
    case "/crypto_diag_full": {
      await handleCryptoDiagnostics({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/cg_vfuse":
    case "/cg_vfuse_full": {
      await handleCgVFuse({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/bn_ticker":
    case "/bn_ticker_full": {
      await handleBinanceDebug({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    case "/okx_ticker":
    case "/okx_ticker_full": {
      await handleOkxDebug({
        bot,
        chatId,
        rest: ctx.rest,
        reply,
        bypass: !!ctx.bypass,
        cmd: cmd0,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchCryptoDevCommands,
};