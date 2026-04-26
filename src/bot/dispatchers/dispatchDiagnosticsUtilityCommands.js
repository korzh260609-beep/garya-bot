// src/bot/dispatchers/dispatchDiagnosticsUtilityCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleLastErrors } from "../handlers/lastErrors.js";
import { handleTaskStatus } from "../handlers/taskStatus.js";
import { handleFileLogs } from "../handlers/fileLogs.js";
import { handleRenderDiag } from "../handlers/renderDiag.js";
import { handleRenderLogSet } from "../handlers/renderLogSet.js";
import { handleRenderDiagLast } from "../handlers/renderDiagLast.js";
import { handleRenderLogShow } from "../handlers/renderLogShow.js";
import { handleRenderErrorsLast } from "../handlers/renderErrorsLast.js";
import { handleRenderDeploysLast } from "../handlers/renderDeploysLast.js";
import { formatCommandPolicyCoverageReport } from "../diagnostics/commandPolicyCoverage.js";
import { formatCommandPolicySelfTestReport } from "../diagnostics/commandPolicySelfTest.js";
import { formatIntentActionRouterSelfTestReport } from "../diagnostics/intentActionRouterSelfTest.js";
import { formatMeaningIntentBoundarySelfTestReport } from "../diagnostics/meaningIntentBoundarySelfTest.js";
import { formatMeaningIntentRouterIntegrationSelfTestReport } from "../diagnostics/meaningIntentRouterIntegrationSelfTest.js";
import { formatCommandPolicyShadowLast } from "../../core/commandPolicy/CommandPolicyShadowStore.js";

// ✅ STAGE 12A — capability skeleton handlers
import {
  handleCapabilitiesRegistry,
  handleCapabilityLookup,
} from "../handlers/capabilitiesRegistry.js";
import { handleCapabilityDiagram } from "../handlers/capabilityDiagram.js";
import { handleCapabilityDocument } from "../handlers/capabilityDocument.js";
import { handleCapabilityAutomation } from "../handlers/capabilityAutomation.js";

// ✅ STAGE 12.1 — vision diag
import { handleVisionDiag } from "../handlers/visionDiag.js";

export async function dispatchDiagnosticsUtilityCommands({ cmd0, ctx }) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/last_errors": {
      await handleLastErrors({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/task_status": {
      await handleTaskStatus({ bot, chatId, rest: ctx.rest });
      return { handled: true };
    }

    case "/file_logs": {
      await handleFileLogs({
        bot,
        chatId,
        chatIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/command_policy_diag": {
      await bot.sendMessage(chatId, formatCommandPolicyCoverageReport());
      return { handled: true };
    }

    case "/command_policy_selftest": {
      await bot.sendMessage(chatId, formatCommandPolicySelfTestReport());
      return { handled: true };
    }

    case "/command_policy_shadow_last": {
      await bot.sendMessage(chatId, formatCommandPolicyShadowLast());
      return { handled: true };
    }

    case "/intent_action_selftest": {
      await bot.sendMessage(chatId, formatIntentActionRouterSelfTestReport());
      return { handled: true };
    }

    case "/meaning_intent_selftest": {
      await bot.sendMessage(chatId, formatMeaningIntentBoundarySelfTestReport());
      return { handled: true };
    }

    case "/meaning_router_selftest": {
      await bot.sendMessage(chatId, formatMeaningIntentRouterIntegrationSelfTestReport());
      return { handled: true };
    }

    case "/render_diag": {
      await handleRenderDiag({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
        msg: ctx.msg,
      });
      return { handled: true };
    }

    case "/render_log_set": {
      await handleRenderLogSet({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
        msg: ctx.msg,
      });
      return { handled: true };
    }

    case "/render_diag_last": {
      await handleRenderDiagLast({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_log_show": {
      await handleRenderLogShow({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_errors_last": {
      await handleRenderErrorsLast({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/render_deploys_last": {
      await handleRenderDeploysLast({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/capabilities": {
      await handleCapabilitiesRegistry({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    case "/capability": {
      await handleCapabilityLookup({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    case "/cap_diagram": {
      await handleCapabilityDiagram({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    case "/cap_doc": {
      await handleCapabilityDocument({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    case "/cap_automation": {
      await handleCapabilityAutomation({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    case "/vision_diag": {
      await handleVisionDiag({
        bot,
        chatId,
        chatIdStr,
        senderIdStr: ctx.senderIdStr,
        user: ctx.user,
        userRole: ctx.userRole,
        userPlan: ctx.userPlan,
        globalUserId: ctx.globalUserId ?? ctx?.user?.global_user_id ?? null,
        isMonarchUser:
          typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx.bypass,
        isPrivateChat:
          typeof ctx.isPrivateChat === "boolean"
            ? ctx.isPrivateChat
            : ctx?.identityCtx?.isPrivateChat === true,
        transport: ctx?.identityCtx?.transport || ctx.transport || "telegram",
        chatType:
          ctx.chatType ||
          ctx?.identityCtx?.chatType ||
          ctx?.identityCtx?.chat_type ||
          null,
        identityCtx: ctx.identityCtx,
        reply: ctx.reply,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}