// src/agentWorkspace/AgentWorkspaceChatCommandExecutor.js
// ============================================================================
// Executes allowlisted chat command handlers and captures SG chat output.
// This is NOT a Telegram send. It uses a fake bot to capture sendMessage text.
// ============================================================================

import { handlePmCapabilitiesDiag } from "../bot/handlers/pmCapabilitiesDiag.js";
import { handleMemoryRememberGuardDiag } from "../bot/handlers/memoryRememberGuardDiag.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function makeFakeBot() {
  const messages = [];

  return {
    messages,
    async sendMessage(chatId, text, options = {}) {
      messages.push({
        chatId,
        text: String(text ?? ""),
        options,
      });
      return {
        ok: true,
        message_id: messages.length,
        chat: { id: chatId },
        text: String(text ?? ""),
      };
    },
  };
}

export async function executeAgentWorkspaceChatCommand(commandLine = "") {
  const raw = normalizeString(commandLine);
  const cmd0 = raw.split(/\s+/)[0];
  const fakeChatId = "agent_workspace_capture";
  const fakeBot = makeFakeBot();

  if (!cmd0) {
    return {
      command: raw,
      ok: false,
      error: "empty_command",
      messages: [],
      outputText: "",
    };
  }

  try {
    if (cmd0 === "/pm_capabilities_diag") {
      await handlePmCapabilitiesDiag({
        bot: fakeBot,
        chatId: fakeChatId,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: true,
        handler: "handlePmCapabilitiesDiag",
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/memory_remember_guard_diag") {
      const result = await handleMemoryRememberGuardDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryRememberGuardDiag",
        data: {
          key: result?.key || null,
          first: {
            ok: result?.first?.ok === true,
            stored: result?.first?.stored === true,
            reason: result?.first?.reason || null,
            guardDecision: result?.first?.guardDecision || null,
          },
          duplicate: {
            ok: result?.duplicate?.ok === true,
            stored: result?.duplicate?.stored === true,
            reason: result?.duplicate?.reason || null,
            guardDecision: result?.duplicate?.guardDecision || null,
          },
          conflict: {
            ok: result?.conflict?.ok === true,
            stored: result?.conflict?.stored === true,
            reason: result?.conflict?.reason || null,
            guardDecision: result?.conflict?.guardDecision || null,
          },
          fetch: {
            ok: result?.fetch?.ok === true,
            total: result?.fetch?.total ?? null,
            reason: result?.fetch?.reason || null,
          },
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    return {
      command: cmd0,
      ok: false,
      error: "chat_command_not_implemented_in_workspace_executor",
      messages: [],
      outputText: "",
    };
  } catch (error) {
    return {
      command: cmd0,
      ok: false,
      error: error?.message || "unknown_error",
      messages: fakeBot.messages,
      outputText: fakeBot.messages.map((item) => item.text).join("\n---\n"),
    };
  }
}

export default {
  executeAgentWorkspaceChatCommand,
};
