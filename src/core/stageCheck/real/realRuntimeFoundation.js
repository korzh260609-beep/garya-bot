// ============================================================================
// === src/core/stageCheck/real/realRuntimeFoundation.js
// === runtime foundation evidence collection
// ============================================================================

import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import { safeReadJson } from "./realEvidenceUtils.js";
import { hasSemanticOverlap } from "./realScopeProfile.js";

export function buildRuntimeFoundationDefs() {
  return [
    {
      key: "package_main",
      file: "package.json",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        return !!String(pkg?.main || "").trim();
      },
      details: "package.json has main entrypoint",
    },
    {
      key: "package_start_script",
      file: "package.json",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        const startScript = String(pkg?.scripts?.start || "").trim();
        return !!startScript && startScript.includes("node");
      },
      details: "package.json has node start script",
    },
    {
      key: "index_exists",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        return evaluationCtx.fileSet.has("index.js");
      },
      details: "root runtime entry file exists",
    },
    {
      key: "express_bootstrap",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["runtime"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("express") &&
          (text.includes("createApp(") || text.includes("express("))
        );
      },
      details: "entrypoint bootstraps express/http app",
    },
    {
      key: "telegram_bot_dependency",
      file: "package.json",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const pkg = await safeReadJson("package.json", evaluationCtx);
        const deps = {
          ...(pkg?.dependencies || {}),
          ...(pkg?.devDependencies || {}),
        };
        return !!deps["node-telegram-bot-api"];
      },
      details: "telegram bot dependency exists",
    },
    {
      key: "telegram_transport_bootstrap",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("initTelegramTransport") &&
          text.includes("telegramTransport")
        );
      },
      details: "entrypoint wires telegram transport bootstrap",
    },
    {
      key: "telegram_adapter_wiring",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return text.includes("TelegramAdapter") && text.includes(".attach(");
      },
      details: "entrypoint wires transport adapter attach",
    },
    {
      key: "core_deps_wiring",
      file: "index.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile("index.js", evaluationCtx);
        if (!text) return false;
        return (
          text.includes("buildCoreDeps") &&
          text.includes("telegramAdapter.deps")
        );
      },
      details: "entrypoint wires core deps into adapter",
    },
    {
      key: "telegram_bot_instantiation",
      file: "src/bot/telegramTransport.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/telegramTransport.js",
          evaluationCtx
        );
        if (!text) return false;
        return (
          text.includes("new TelegramBot(") &&
          text.includes("polling: false")
        );
      },
      details: "telegram transport instantiates TelegramBot",
    },
    {
      key: "webhook_setup",
      file: "src/bot/telegramTransport.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/telegramTransport.js",
          evaluationCtx
        );
        if (!text) return false;
        return text.includes("setWebHook") || text.includes("setWebhook");
      },
      details: "telegram transport sets webhook",
    },
    {
      key: "process_update",
      file: "src/bot/telegramTransport.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/telegramTransport.js",
          evaluationCtx
        );
        if (!text) return false;
        return text.includes("processUpdate");
      },
      details: "telegram transport processes updates",
    },
    {
      key: "telegram_message_listener",
      file: "src/transport/telegramAdapter.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/transport/telegramAdapter.js",
          evaluationCtx
        );
        if (!text) return false;
        return (
          text.includes('this.bot.on("message"') &&
          text.includes("handleMessage(")
        );
      },
      details: "telegram adapter listens to incoming messages and forwards to core",
    },
    {
      key: "chat_message_router",
      file: "src/bot/messageRouter.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/messageRouter.js",
          evaluationCtx
        );
        if (!text) return false;
        return (
          text.includes('bot.on("message"') &&
          text.includes("handleChatMessage(")
        );
      },
      details: "router accepts message updates and routes chat flow",
    },
    {
      key: "basic_reply_pipeline",
      file: "src/bot/handlers/chat/postReplyFlow.js",
      kind: "runtime_foundation",
      strength: "strong",
      tags: ["runtime", "transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/bot/handlers/chat/postReplyFlow.js",
          evaluationCtx
        );
        if (!text) return false;
        return (
          text.includes("finalizeChatReply") &&
          text.includes("bot.sendMessage(")
        );
      },
      details: "chat flow finalizes and sends a telegram reply",
    },
    {
      key: "adapter_reply_surface",
      file: "src/transport/telegramAdapter.js",
      kind: "runtime_foundation",
      strength: "medium",
      tags: ["transport"],
      test: async ({ evaluationCtx }) => {
        const text = await safeFetchTextFile(
          "src/transport/telegramAdapter.js",
          evaluationCtx
        );
        if (!text) return false;
        return (
          text.includes("async reply(") &&
          text.includes("this.bot.sendMessage(")
        );
      },
      details: "transport adapter exposes reply surface via sendMessage",
    },
  ];
}

export async function collectRuntimeFoundationEvidence({
  evaluationCtx,
  scopeSemanticProfile,
}) {
  const defs = buildRuntimeFoundationDefs();
  const scopeTags = scopeSemanticProfile?.tags || [];
  const passed = [];

  for (const def of defs) {
    if (!hasSemanticOverlap(def.tags, scopeTags)) continue;

    try {
      const ok = await def.test({ evaluationCtx });
      if (!ok) continue;

      passed.push({
        side: "real",
        kind: def.kind,
        subkind: def.key,
        file: def.file,
        strength: def.strength,
        tags: def.tags,
        proofRole: "implementation",
        details: def.details,
      });
    } catch (_) {}
  }

  return passed;
}

export default {
  buildRuntimeFoundationDefs,
  collectRuntimeFoundationEvidence,
};