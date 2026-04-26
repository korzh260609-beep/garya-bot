// src/bot/commandDispatcher.js
// Central command dispatcher.
// IMPORTANT: keep behavior identical; we only move cases 1:1.


// ✅ CRYPTO DEV dispatcher (extracted 1:1 block)
import { dispatchCryptoDevCommands } from "./dispatchers/dispatchCryptoDevCommands.js";

// ✅ SOURCES dispatcher (extracted 1:1 block)
import { dispatchSourcesCommands } from "./dispatchers/dispatchSourcesCommands.js";

// ✅ PROJECT MEMORY dispatcher (extracted 1:1 block)
import { dispatchProjectMemoryCommands } from "./dispatchers/dispatchProjectMemoryCommands.js";

// ✅ IDENTITY / LINK dispatcher (extracted 1:1 block)
import { dispatchIdentityCommands } from "./dispatchers/dispatchIdentityCommands.js";

// ✅ TASK dispatcher (extracted 1:1 block)
import { dispatchTaskCommands } from "./dispatchers/dispatchTaskCommands.js";

// ✅ RECALL dispatcher (extracted 1:1 block)
import { dispatchRecallCommands } from "./dispatchers/dispatchRecallCommands.js";

// ✅ MEMORY DIAGNOSTICS dispatcher (extracted 1:1 block)
import { dispatchMemoryDiagnosticsCommands } from "./dispatchers/dispatchMemoryDiagnosticsCommands.js";

// ✅ DECISION DIAGNOSTICS dispatcher (extracted 1:1 block)
import { dispatchDecisionDiagnosticsCommands } from "./dispatchers/dispatchDecisionDiagnosticsCommands.js";

// ✅ PROFILE / MODE dispatcher (extracted 1:1 block)
import { dispatchProfileModeCommands } from "./dispatchers/dispatchProfileModeCommands.js";

// ✅ SYSTEM INFO dispatcher (extracted 1:1 block)
import { dispatchSystemInfoCommands } from "./dispatchers/dispatchSystemInfoCommands.js";

// ✅ DIAGNOSTICS / UTILITY dispatcher (extracted 1:1 block)
import { dispatchDiagnosticsUtilityCommands } from "./dispatchers/dispatchDiagnosticsUtilityCommands.js";

// ✅ RENDER BRIDGE dispatcher
import { dispatchRenderBridgeCommands } from "./dispatchers/dispatchRenderBridgeCommands.js";

// ✅ AGENT WORKSPACE dispatcher
import { dispatchAgentWorkspaceCommands } from "./dispatchers/dispatchAgentWorkspaceCommands.js";

// ✅ META DEBUG dispatcher (extracted 1:1 block)
import { dispatchMetaDebugCommands } from "./dispatchers/dispatchMetaDebugCommands.js";

// ✅ PRICE dispatcher (extracted 1:1 block)
import { dispatchPriceCommands } from "./dispatchers/dispatchPriceCommands.js";

// ✅ PROJECT REPO dispatcher (extracted 1:1 block)
import { dispatchProjectRepoCommands } from "./dispatchers/dispatchProjectRepoCommands.js";

// ✅ CAPABILITIES dispatcher (extracted 1:1 block)
import { dispatchCapabilitiesCommands } from "./dispatchers/dispatchCapabilitiesCommands.js";

// ✅ LEGACY / LOCAL dispatcher (extracted 1:1 block)
import { dispatchLegacyLocalCommands } from "./dispatchers/dispatchLegacyLocalCommands.js";

import { PRIVATE_ONLY_COMMANDS } from "./constants/privateOnlyCommands.js";
import { CommandPolicyService } from "../core/commandPolicy/CommandPolicyService.js";
import { COMMAND_POLICIES } from "../core/commandPolicy/commandPolicies.js";
import { recordCommandPolicyShadow } from "../core/commandPolicy/CommandPolicyShadowStore.js";

// ✅ SG project-only repo/github access guard
import {
  isProjectOnlyCommand,
  resolveProjectFeatureByCommand,
} from "./handlers/projectAccessScope.js";
import { requireProjectMonarchPrivateAccess } from "./handlers/projectAccessGuard.js";

const commandPolicyShadowService = new CommandPolicyService({
  policies: COMMAND_POLICIES,
});

function buildCommandPolicyShadowComparison({
  legacyPrivateBlocked,
  legacyPrivateOnly,
  policyDecision,
} = {}) {
  const policyBlocked = policyDecision?.blocked === true;
  const policyReason = policyDecision?.reason || null;
  const policyScope = policyDecision?.policy?.scope || null;

  const privateGateMatches = legacyPrivateBlocked
    ? policyBlocked && policyReason === "private_only"
    : true;

  return {
    privateGateMatches,
    policyHasKnownCommand: policyReason !== "allowed_by_default",
    policyBlocked,
    policyReason,
    policyScope,
    legacyPrivateOnly: !!legacyPrivateOnly,
    legacyPrivateBlocked: !!legacyPrivateBlocked,
    shadowMismatch: !privateGateMatches,
  };
}

function traceCommandPolicyShadow({
  cmd0,
  transport,
  chatType,
  isPrivate,
  isMonarch,
  bypass,
  legacyPrivateOnly,
  legacyPrivateBlocked,
  policyDecision,
} = {}) {
  try {
    const comparison = buildCommandPolicyShadowComparison({
      legacyPrivateOnly,
      legacyPrivateBlocked,
      policyDecision,
    });

    const entry = {
      cmd: cmd0,
      transport: transport || "telegram",
      chatType: chatType || "unknown",
      isPrivate: !!isPrivate,
      isMonarch: !!isMonarch,
      bypass: !!bypass,
      legacyPrivateOnly: !!legacyPrivateOnly,
      legacyPrivateBlocked: !!legacyPrivateBlocked,
      policyAllowed: policyDecision?.allowed === true,
      policyBlocked: comparison.policyBlocked,
      policyReason: comparison.policyReason,
      policyScope: comparison.policyScope,
      privateGateMatches: comparison.privateGateMatches,
      policyHasKnownCommand: comparison.policyHasKnownCommand,
      shadowMismatch: comparison.shadowMismatch,
      shadowOnly: true,
    };

    recordCommandPolicyShadow(entry);
    console.log("🛡️ COMMAND_POLICY_SHADOW", entry);
  } catch (e) {
    console.error("⚠️ COMMAND_POLICY_SHADOW_LOG_ERROR", e);
  }
}

/**
 * Backward-compatible dispatcher.
 *
 * Supports BOTH call styles:
 * 1) dispatchCommand(cmd, ctx)  // expected
 * 2) dispatchCommand(ctx)       // legacy / accidental call (prevents crash)
 */
export async function dispatchCommand(cmd, ctx) {
  if (ctx === undefined && cmd && typeof cmd === "object") {
    const ctxObj = cmd;

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

    if (
      ctxObj &&
      (ctxObj.rest === undefined || ctxObj.rest === null) &&
      rawText
    ) {
      ctxObj.rest = rawText.trim().split(/\s+/).slice(1).join(" ");
    }

    ctx = ctxObj;
    cmd = derivedCmd;
  }

  if (!ctx || typeof ctx !== "object") {
    return { handled: false, error: "CTX_MISSING" };
  }

  if (typeof cmd !== "string" || !cmd.startsWith("/")) {
    return { handled: false };
  }

  const { bot, chatId } = ctx;

  const reply =
    typeof ctx.reply === "function"
      ? ctx.reply
      : async (text) => bot.sendMessage(chatId, String(text ?? ""));

  if (!bot || !chatId) {
    return { handled: false, error: "CTX_INVALID" };
  }

  const cmd0 = cmd.split("@")[0];

  const chatType =
    ctx?.chatType ||
    ctx?.identityCtx?.chat_type ||
    ctx?.identityCtx?.chatType ||
    null;

  const fromId = ctx?.senderIdStr ?? "";

  const effectiveChatIdStr = String(ctx?.chatIdStr ?? ctx?.chatId ?? chatId ?? "");
  const effectiveFromIdStr = String(fromId ?? "");

  const isPrivate =
    ctx?.isPrivateChat === true ||
    ctx?.identityCtx?.isPrivateChat === true ||
    chatType === "private" ||
    (effectiveChatIdStr &&
      effectiveFromIdStr &&
      effectiveChatIdStr === effectiveFromIdStr);

  const transport = ctx?.identityCtx?.transport || ctx?.transport || "telegram";
  const isMonarch =
    typeof ctx.isMonarchUser === "boolean" ? ctx.isMonarchUser : !!ctx?.bypass;
  const legacyPrivateOnly = PRIVATE_ONLY_COMMANDS.has(cmd0);
  const legacyPrivateBlocked = !isPrivate && legacyPrivateOnly;

  const policyDecision = commandPolicyShadowService.evaluate({
    command: cmd0,
    transport,
    isPrivate,
    isMonarch,
    bypass: !!ctx?.bypass,
  });

  traceCommandPolicyShadow({
    cmd0,
    transport,
    chatType,
    isPrivate,
    isMonarch,
    bypass: !!ctx?.bypass,
    legacyPrivateOnly,
    legacyPrivateBlocked,
    policyDecision,
  });

  if (!isPrivate && PRIVATE_ONLY_COMMANDS.has(cmd0)) {
    await reply(
      [
        "⛔ DEV only.",
        `cmd=${cmd0}`,
        `chatType=${chatType || "unknown"}`,
        `private=${String(isPrivate)}`,
        `monarch=${String(!!ctx?.bypass)}`,
        `from=${String(fromId)}`,
      ].join("\n"),
      { cmd: cmd0, handler: "commandDispatcher", event: "private_only_gate" }
    );

    return { handled: true };
  }

  // ===========================================================================
  // SG PROJECT-ONLY GUARD
  // - repo/github/project internal work is monarch-only
  // - private chat only
  // - read-only repo access only
  // ===========================================================================
  if (isProjectOnlyCommand(cmd0)) {
    const feature = resolveProjectFeatureByCommand(cmd0);

    const allowed = await requireProjectMonarchPrivateAccess(
      {
        ...ctx,
        bot,
        chatId,
        reply,
        command: cmd0,
      },
      {
        feature,
        command: cmd0,
      }
    );

    if (!allowed) {
      return { handled: true };
    }
  }

  const cryptoHandled = await dispatchCryptoDevCommands({
    cmd0,
    ctx,
    reply,
  });

  if (cryptoHandled?.handled) {
    return cryptoHandled;
  }

  const sourcesHandled = await dispatchSourcesCommands({
    cmd0,
    ctx,
    reply,
  });

  if (sourcesHandled?.handled) {
    return sourcesHandled;
  }

  const projectMemoryHandled = await dispatchProjectMemoryCommands({
    cmd0,
    ctx,
    reply,
  });

  if (projectMemoryHandled?.handled) {
    return projectMemoryHandled;
  }

  const identityHandled = await dispatchIdentityCommands({
    cmd0,
    ctx,
    reply,
  });

  if (identityHandled?.handled) {
    return identityHandled;
  }

  const taskHandled = await dispatchTaskCommands({
    cmd0,
    ctx,
    reply,
  });

  if (taskHandled?.handled) {
    return taskHandled;
  }

  const recallHandled = await dispatchRecallCommands({
    cmd0,
    ctx,
    reply,
  });

  if (recallHandled?.handled) {
    return recallHandled;
  }

  const memoryDiagnosticsHandled = await dispatchMemoryDiagnosticsCommands({
    cmd0,
    ctx,
    reply,
  });

  if (memoryDiagnosticsHandled?.handled) {
    return memoryDiagnosticsHandled;
  }

  const decisionDiagnosticsHandled = await dispatchDecisionDiagnosticsCommands({
    cmd0,
    ctx,
    reply,
  });

  if (decisionDiagnosticsHandled?.handled) {
    return decisionDiagnosticsHandled;
  }

  const profileModeHandled = await dispatchProfileModeCommands({
    cmd0,
    ctx,
    reply,
  });

  if (profileModeHandled?.handled) {
    return profileModeHandled;
  }

  const systemInfoHandled = await dispatchSystemInfoCommands({
    cmd0,
    ctx,
    reply,
  });

  if (systemInfoHandled?.handled) {
    return systemInfoHandled;
  }

  const diagnosticsUtilityHandled = await dispatchDiagnosticsUtilityCommands({
    cmd0,
    ctx,
    reply,
  });

  if (diagnosticsUtilityHandled?.handled) {
    return diagnosticsUtilityHandled;
  }

  const renderBridgeHandled = await dispatchRenderBridgeCommands({
    cmd0,
    ctx,
    reply,
  });

  if (renderBridgeHandled?.handled) {
    return renderBridgeHandled;
  }

  const agentWorkspaceHandled = await dispatchAgentWorkspaceCommands({
    cmd0,
    ctx,
    reply,
  });

  if (agentWorkspaceHandled?.handled) {
    return agentWorkspaceHandled;
  }

  const metaDebugHandled = await dispatchMetaDebugCommands({
    cmd0,
    ctx,
    reply,
  });

  if (metaDebugHandled?.handled) {
    return metaDebugHandled;
  }

  const priceHandled = await dispatchPriceCommands({
    cmd0,
    ctx,
    reply,
  });

  if (priceHandled?.handled) {
    return priceHandled;
  }

  const projectRepoHandled = await dispatchProjectRepoCommands({
    cmd0,
    ctx,
    reply,
  });

  if (projectRepoHandled?.handled) {
    return projectRepoHandled;
  }

  const capabilitiesHandled = await dispatchCapabilitiesCommands({
    cmd0,
    ctx,
  });

  if (capabilitiesHandled?.handled) {
    return capabilitiesHandled;
  }

  const legacyLocalHandled = await dispatchLegacyLocalCommands({
    cmd0,
    ctx,
  });

  if (legacyLocalHandled?.handled) {
    return legacyLocalHandled;
  }

  return { handled: false };
}
