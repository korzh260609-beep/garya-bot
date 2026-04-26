// src/agentWorkspace/AgentWorkspaceChatCommandExecutor.js
// ============================================================================
// Executes allowlisted chat command handlers and captures SG chat output.
// This is NOT a Telegram send. It uses a fake bot to capture sendMessage text.
// ============================================================================

import { handlePmCapabilitiesDiag } from "../bot/handlers/pmCapabilitiesDiag.js";
import { handleMemoryRememberGuardDiag } from "../bot/handlers/memoryRememberGuardDiag.js";
import { handleMemoryLongTermReadDiag } from "../bot/handlers/memoryLongTermReadDiag.js";
import { handleMemoryConfirmedRestoreDiag } from "../bot/handlers/memoryConfirmedRestoreDiag.js";
import { handleMemoryArchiveWriteDiag } from "../bot/handlers/memoryArchiveWriteDiag.js";
import { handleMemoryTopicDigestDiag } from "../bot/handlers/memoryTopicDigestDiag.js";

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

    if (cmd0 === "/memory_long_term_read_diag") {
      const result = await handleMemoryLongTermReadDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryLongTermReadDiag",
        data: {
          key: result?.key || null,
          remember: {
            ok: result?.remember?.ok === true,
            stored: result?.remember?.stored === true,
            reason: result?.remember?.reason || null,
            guardDecision: result?.remember?.guardDecision || null,
          },
          byKey: {
            ok: result?.byKey?.ok === true,
            total: result?.byKey?.total ?? null,
            reason: result?.byKey?.reason || null,
          },
          byType: {
            ok: result?.byType?.ok === true,
            total: result?.byType?.total ?? null,
            reason: result?.byType?.reason || null,
          },
          byDomain: {
            ok: result?.byDomain?.ok === true,
            total: result?.byDomain?.total ?? null,
            reason: result?.byDomain?.reason || null,
          },
          bySlot: {
            ok: result?.bySlot?.ok === true,
            total: result?.bySlot?.total ?? null,
            reason: result?.bySlot?.reason || null,
          },
          byDomainSlot: {
            ok: result?.byDomainSlot?.ok === true,
            total: result?.byDomainSlot?.total ?? null,
            reason: result?.byDomainSlot?.reason || null,
          },
          summary: {
            ok: result?.summary?.ok === true,
            reason: result?.summary?.reason || null,
          },
          selected: {
            ok: result?.selected?.ok === true,
            total: result?.selected?.total ?? null,
            reason: result?.selected?.reason || null,
          },
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/memory_confirmed_restore_diag") {
      const result = await handleMemoryConfirmedRestoreDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryConfirmedRestoreDiag",
        data: {
          key: result?.key || null,
          remember: {
            ok: result?.remember?.ok === true,
            stored: result?.remember?.stored === true,
            reason: result?.remember?.reason || null,
            guardDecision: result?.remember?.guardDecision || null,
          },
          emptySelector: {
            ok: result?.emptySelector?.ok === true,
            total: result?.emptySelector?.total ?? null,
            reason: result?.emptySelector?.reason || null,
          },
          selected: {
            ok: result?.selected?.ok === true,
            total: result?.selected?.total ?? null,
            reason: result?.selected?.reason || null,
            warnings: result?.selected?.warnings || [],
          },
          checks: result?.checks || {},
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/memory_archive_write_diag") {
      const result = await handleMemoryArchiveWriteDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryArchiveWriteDiag",
        data: {
          needle: result?.needle || null,
          archive: {
            ok: result?.archive?.ok === true,
            stored: result?.archive?.stored === true,
            reason: result?.archive?.reason || null,
            size: result?.archive?.size ?? null,
            truncated: result?.archive?.truncated === true,
          },
          context: result?.context || {},
          checks: result?.checks || {},
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/memory_topic_digest_diag") {
      const result = await handleMemoryTopicDigestDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryTopicDigestDiag",
        data: {
          topicKey: result?.topicKey || null,
          needle: result?.needle || null,
          selected: result?.selected || {},
          listed: result?.listed || {},
          context: result?.context || {},
          checks: result?.checks || {},
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
