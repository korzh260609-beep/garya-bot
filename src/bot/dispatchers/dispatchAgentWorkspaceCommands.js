// src/bot/dispatchers/dispatchAgentWorkspaceCommands.js
// ============================================================================
// AGENT WORKSPACE COMMANDS DISPATCHER
//
// INTERFACE MODE MARKER:
// - This file belongs to Technical Mode.
// - It routes explicit slash commands for AgentWorkspace diagnostics/actions.
// - It must not be treated as Human Mode / normal SG intelligence.
// - AgentWorkspace remains a controlled command/report bridge.
// - Keep temporarily for diagnostics/backward compatibility.
// ============================================================================

import { handleAgentWorkspaceDiag } from "../handlers/agentWorkspaceDiag.js";
import { handleAgentWorkspaceRenderReport } from "../handlers/agentWorkspaceRenderReport.js";
import { handleAgentWorkspaceTestNote } from "../handlers/agentWorkspaceTestNote.js";
import { handleAgentWorkspaceRun } from "../handlers/agentWorkspaceRun.js";

export async function dispatchAgentWorkspaceCommands({ cmd0, ctx }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/agent_workspace_diag": {
      await handleAgentWorkspaceDiag({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/agent_workspace_run": {
      await handleAgentWorkspaceRun({
        bot,
        chatId,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/agent_workspace_render_report": {
      await handleAgentWorkspaceRenderReport({
        bot,
        chatId,
        senderIdStr: ctx.senderIdStr,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    case "/agent_workspace_test_note": {
      await handleAgentWorkspaceTestNote({
        bot,
        chatId,
        rest: ctx.rest,
        bypass: ctx.bypass,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchAgentWorkspaceCommands,
};
