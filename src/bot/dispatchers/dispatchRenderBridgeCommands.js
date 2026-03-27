// src/bot/dispatchers/dispatchRenderBridgeCommands.js

import { handleRenderBridgeService } from "../handlers/renderBridgeService.js";
import { handleRenderBridgeServices } from "../handlers/renderBridgeServices.js";
import { handleRenderBridgeErrors } from "../handlers/renderBridgeErrors.js";
import { handleRenderBridgeLogs } from "../handlers/renderBridgeLogs.js";
import { handleRenderBridgeDiagnose } from "../handlers/renderBridgeDiagnose.js";
import { handleRenderBridgeDeploys } from "../handlers/renderBridgeDeploys.js";
import { handleRenderBridgeDeploy } from "../handlers/renderBridgeDeploy.js";
import { handleRenderBridgeDiag } from "../handlers/renderBridgeDiag.js";

export async function dispatchRenderBridgeCommands({ cmd0, ctx }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/render_bridge_service": {
      await handleRenderBridgeService({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_services": {
      await handleRenderBridgeServices({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_errors": {
      await handleRenderBridgeErrors({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_logs": {
      await handleRenderBridgeLogs({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_diagnose": {
      await handleRenderBridgeDiagnose({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_deploys": {
      await handleRenderBridgeDeploys({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_deploy": {
      await handleRenderBridgeDeploy({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_bridge_diag": {
      await handleRenderBridgeDiag({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchRenderBridgeCommands,
};