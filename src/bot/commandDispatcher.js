// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.

import { handleProjectStatus } from "./handlers/projectStatus.js";
import { handlePrices } from "./handlers/prices.js";
import { handlePrice } from "./handlers/price.js";
import { handleProfile } from "./handlers/profile.js";
import { handleMode } from "./handlers/mode.js";
import { handleHealth } from "./handlers/health.js"; // Stage 5 — skeleton

import pool from "../../db.js";

import { handleStopTasksType } from "./handlers/stopTasksType.js";
import { handleUsersStats } from "./handlers/usersStats.js";

/**
 * Backward-compatible dispatcher.
 *
 * Supports BOTH call styles:
 * 1) dispatchCommand(cmd, ctx)  // expected
 * 2) dispatchCommand(ctx)       // legacy / accidental call (prevents crash)
 */
export async function dispatchCommand(cmd, ctx) {
  // ---- Normalize arguments (prevent "ctx is undefined" crash) ----
  // If called as dispatchCommand(ctxObj), then `cmd` is actually ctxObj and ctx is undefined.
  if (ctx === undefined && cmd && typeof cmd === "object") {
    const ctxObj = cmd;

    // Try to derive command string:
    // 1) ctx.cmd / ctx.command
    // 2) first token of msg.text
    let derivedCmd = ctxObj.cmd || ctxObj.command;

    const rawText =
      typeof ctxObj?.msg?.text === "string"
        ? ctxObj.msg.text
        : typeof ctxObj?.message?.text === "string"
        ? ctxObj.message.text
        : null;

    if (!derivedCmd && rawText) {
      derivedCmd = rawText.trim().split(/\s+/)[0];
    }

    // Ensure "rest" exists if we had raw text
    if (ctxObj && (ctxObj.rest === undefined || ctxObj.rest === null) && rawText) {
      const parts = rawText.trim().split(/\s+/);
      ctxObj.rest = parts.slice(1).join(" ");
    }

    ctx = ctxObj;
    cmd = derivedCmd;
  }

  // Guard: still no ctx -> nothing to do (but do NOT crash)
  if (!ctx || typeof ctx !== "object") {
    return { handled: false, error: "CTX_MISSING" };
  }

  // Guard: command must be a string
  if (typeof cmd !== "string" || !cmd.startsWith("/")) {
    return { handled: false };
  }

  const { bot, chatId, chatIdStr, rest } = ctx;

  // If critical fields missing, don't crash
  if (!bot || !chatId) {
    return { handled: false, error: "CTX_INVALID" };
  }

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

    // Stage 5 — Observability V1 (SKELETON)
    case "/health": {
      await handleHealth({ bot, chatId });
      return { handled: true };
    }

      case "/project_status": {
  await handleProjectStatus({ bot, chatId });
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
