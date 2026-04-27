// src/agentWorkspace/AgentWorkspaceChatCommandExecutor.js
// ============================================================================
// Executes allowlisted chat command handlers and captures SG chat output.
// This is NOT a Telegram send. It uses a fake bot to capture sendMessage text.
// ============================================================================

import { handlePmCapabilitiesDiag } from "../bot/handlers/pmCapabilitiesDiag.js";
import { handlePmWiringDiag } from "../bot/handlers/pmWiringDiag.js";
import { handlePmShowDiag } from "../bot/handlers/pmShowDiag.js";
import { handlePmControlledWriteDiag } from "../bot/handlers/pmControlledWriteDiag.js";
import { handlePmReadSurfaceDiag } from "../bot/handlers/pmReadSurfaceDiag.js";
import { handlePmFindDiag } from "../bot/handlers/pmFindDiag.js";
import { handleMemoryRememberGuardDiag } from "../bot/handlers/memoryRememberGuardDiag.js";
import { handleMemoryLongTermReadDiag } from "../bot/handlers/memoryLongTermReadDiag.js";
import { handleMemoryConfirmedRestoreDiag } from "../bot/handlers/memoryConfirmedRestoreDiag.js";
import { handleMemoryArchiveWriteDiag } from "../bot/handlers/memoryArchiveWriteDiag.js";
import { handleMemoryTopicDigestDiag } from "../bot/handlers/memoryTopicDigestDiag.js";
import { handleMemoryRestoreBeforeAnswerDiag } from "../bot/handlers/memoryRestoreBeforeAnswerDiag.js";
import { dispatchMemoryDiagnosticsCommands } from "../bot/dispatchers/dispatchMemoryDiagnosticsCommands.js";
import {
  getProjectSection,
  getProjectMemoryList,
  upsertProjectSection,
  recordProjectWorkSession,
  updateProjectWorkSession,
  listConfirmedProjectMemoryEntries,
  writeConfirmedProjectMemory,
} from "../../projectMemory.js";

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

function buildFakeProjectMemoryCtx({ fakeChatId } = {}) {
  return {
    bot: null,
    chatId: fakeChatId,
    chatIdStr: fakeChatId,
    transport: "agent_workspace",
    chatType: "private",
    isPrivateChat: true,
    bypass: true,
    isMonarchUser: true,
    getProjectSection,
    upsertProjectSection,
    getProjectMemoryList,
    recordProjectWorkSession,
    updateProjectWorkSession,
    listConfirmedProjectMemoryEntries,
    writeConfirmedProjectMemory,
  };
}

async function executeDispatcherCommand({ cmd0, fakeBot, fakeChatId }) {
  const reply = async (text, options = {}) => fakeBot.sendMessage(fakeChatId, text, options);

  return dispatchMemoryDiagnosticsCommands({
    cmd0,
    ctx: {
      chatId: fakeChatId,
      chatIdStr: fakeChatId,
      rest: "",
      user: {
        role: "monarch",
        plan: "admin",
        global_user_id: null,
      },
      bypass: true,
      isMonarchUser: true,
    },
    reply,
  });
}

export async function executeAgentWorkspaceChatCommand(commandLine = "") {
  const raw = normalizeString(commandLine);
  const cmd0 = raw.split(/\s+/)[0];
  const rest = raw.split(/\s+/).slice(1).join(" ").trim();
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

    if (cmd0 === "/pm_wiring_diag") {
      await handlePmWiringDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        ctx: buildFakeProjectMemoryCtx({ fakeChatId }),
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk =
        outputText.includes("getProjectSection: OK") &&
        outputText.includes("upsertProjectSection: OK") &&
        outputText.includes("getProjectMemoryList: OK") &&
        outputText.includes("recordProjectWorkSession: OK") &&
        outputText.includes("updateProjectWorkSession: OK") &&
        outputText.includes("listConfirmedProjectMemoryEntries: OK") &&
        outputText.includes("writeConfirmedProjectMemory: OK");

      return {
        command: cmd0,
        ok: validationOk,
        handler: "handlePmWiringDiag",
        data: {
          validationOk,
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/pm_show_diag") {
      const result = await handlePmShowDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        rest,
        getProjectSection,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk =
        result?.ok === true &&
        outputText.includes("readOnly: yes") &&
        outputText.includes("dbWrites: no") &&
        outputText.includes("getProjectSection: OK") &&
        outputText.includes("Result: OK");

      return {
        command: cmd0,
        ok: validationOk,
        handler: "handlePmShowDiag",
        data: {
          validationOk,
          diag: result?.diag || null,
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/pm_surface_diag") {
      const result = await handlePmReadSurfaceDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        globalUserId: null,
        getProjectMemoryList,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk =
        result?.ok === true &&
        outputText.includes("readOnly: yes") &&
        outputText.includes("dbWrites: no") &&
        outputText.includes("getProjectMemoryList: OK") &&
        outputText.includes("/pm_list: OK") &&
        outputText.includes("/pm_latest: OK") &&
        outputText.includes("/pm_digest: OK") &&
        outputText.includes("Result: OK");

      return {
        command: cmd0,
        ok: validationOk,
        handler: "handlePmReadSurfaceDiag",
        data: {
          validationOk,
          diag: result?.diag || null,
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/pm_find_diag") {
      const result = await handlePmFindDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        rest,
        globalUserId: null,
        getProjectMemoryList,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk =
        result?.ok === true &&
        outputText.includes("readOnly: yes") &&
        outputText.includes("dbWrites: no") &&
        outputText.includes("getProjectMemoryList: OK") &&
        outputText.includes("handlerOk: yes") &&
        outputText.includes("Result: OK");

      return {
        command: cmd0,
        ok: validationOk,
        handler: "handlePmFindDiag",
        data: {
          validationOk,
          diag: result?.diag || null,
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/pm_controlled_diag") {
      const result = await handlePmControlledWriteDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        transport: "agent_workspace",
        bypass: true,
        upsertProjectSection,
        getProjectSection,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk =
        result?.ok === true &&
        outputText.includes("controlledWrite: yes") &&
        outputText.includes("dbWrites: yes") &&
        outputText.includes("touchesRealProjectSections: no") &&
        outputText.includes("writeOk: yes") &&
        outputText.includes("readBackOk: yes") &&
        outputText.includes("contentMatches: yes") &&
        outputText.includes("Result: OK");

      return {
        command: cmd0,
        ok: validationOk,
        handler: "handlePmControlledWriteDiag",
        data: {
          validationOk,
          diag: result?.diag || null,
        },
        messages: fakeBot.messages,
        outputText,
      };
    }

    if (cmd0 === "/memory_monarch_diag") {
      const result = await executeDispatcherCommand({
        cmd0,
        fakeBot,
        fakeChatId,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");
      const validationOk = outputText.includes("validation: OK") &&
        outputText.includes("core=true") &&
        outputText.includes("db=true") &&
        outputText.includes("archive=true") &&
        outputText.includes("digest=true") &&
        outputText.includes("recall=true") &&
        outputText.includes("guards=true") &&
        outputText.includes("diagnostics=true");

      return {
        command: cmd0,
        ok: result?.handled === true && validationOk,
        handler: "dispatchMemoryDiagnosticsCommands",
        data: {
          handled: result?.handled === true,
          validationOk,
          checksLine: (outputText.match(/checks: .*/)?.[0]) || null,
        },
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

    if (cmd0 === "/memory_restore_before_answer_diag") {
      const result = await handleMemoryRestoreBeforeAnswerDiag({
        bot: fakeBot,
        chatId: fakeChatId,
        chatIdStr: fakeChatId,
        globalUserId: null,
      });

      const outputText = fakeBot.messages.map((item) => item.text).join("\n---\n");

      return {
        command: cmd0,
        ok: result?.ok === true,
        handler: "handleMemoryRestoreBeforeAnswerDiag",
        data: {
          isolatedChatId: result?.isolatedChatId || null,
          confirmedNeedle: result?.confirmedNeedle || null,
          archiveNeedle: result?.archiveNeedle || null,
          digestNeedle: result?.digestNeedle || null,
          remember: result?.remember || {},
          archive: result?.archive || {},
          digest: result?.digest || {},
          bridge: result?.bridge || {},
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
