// src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js
// ============================================================================
// PROJECT MEMORY BASIC COMMANDS DISPATCHER
// Purpose:
// - isolate basic Project Memory command routing
// - keep Telegram transport thin
// - keep business logic inside handlers/services, not dispatcher
// - preserve existing behavior 1:1
// ============================================================================

import { handlePmSet } from "../handlers/pmSet.js";
import { handlePmShow } from "../handlers/pmShow.js";
import { handlePmList } from "../handlers/pmList.js";
import { handlePmDigest } from "../handlers/pmDigest.js";
import { handlePmLatest } from "../handlers/pmLatest.js";
import { handlePmFind } from "../handlers/pmFind.js";
import { handlePmWiringDiag } from "../handlers/pmWiringDiag.js";
import { handlePmCapabilities } from "../handlers/pmCapabilities.js";

export async function dispatchProjectMemoryBasicCommands({
  cmd0,
  ctx,
  reply,
}) {
  const { bot, chatId, chatIdStr } = ctx;

  switch (cmd0) {
    case "/pm_wiring_diag": {
      await handlePmWiringDiag({
        bot,
        chatId,
        ctx,
      });

      return { handled: true };
    }

    case "/pm_capabilities": {
      await handlePmCapabilities({
        bot,
        chatId,
        input: {
          projectKey: "SG",
          projectName: "Советник GARYA",
          stageKey: "7A.13",
          repoRef: "main",
          verifiedFiles: [
            "pillars/workflow/02_STAGE_07_MEMORY.md",
            "pillars/workflow/00_RULES_AND_ORDER.md",
            "src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js",
            "src/bot/handlers/pmWiringDiag.js",
            "src/bot/handlers/pmList.js",
            "src/bot/handlers/pmCapabilities.js",
            "src/projectMemory/ProjectCapabilitySnapshotShape.js",
            "src/projectMemory/ProjectCapabilitySnapshotBuilder.js",
            "src/projectMemory/ProjectCapabilitySnapshotValidator.js",
            "src/projectMemory/ProjectCapabilitySnapshotFactory.js",
          ],
          verifiedCommands: [
            "/pm_wiring_diag",
            "/pm_list",
            "/pm_set",
            "/pm_show",
            "/pm_confirmed_write",
            "/pm_confirmed_latest",
            "/pm_session",
            "/pm_sessions",
          ],
          verifiedCommits: [
            "adfed4d7dd091e39f89c5dd9b8721d95553dd171",
            "d4880014bc2e082bf2375ed76f4d788401d49b0f",
            "33c9416488cd4966394ec6ebfc66498606b2c389",
            "ca7567c2b9e1c5ee1a528ce17e99bdf8c8be6e8c",
            "70e858c857a604f36a208b3614f6694e5a029ee5",
            "a7c6f6368bd117d5230b127279eb2a3f5dca3abe",
            "ed96d8b051db16dd5332b2cf3e5c7df7b9c06e31",
            "0f443dbe941facb649388254ed99aefc22222d37",
            "7aaa9f242aa39e122e3ab0104b4886f45fb51cdb",
            "a68860f61460c0bd8bf04e26ab933f5fcee77c96",
          ],
          facts: {
            sourceOfTruth: "repo/runtime/tests",
            snapshotRole: "advisory_status_view",
            manualPillarStatusMarkersAllowed: false,
            legacyProjectMemoryRouterLivePath: false,
          },
          runtime: {
            transportPath:
              "core/TelegramAdapter -> handleMessage -> commandDispatcher",
            transportEnforced: true,
            dispatcherPath:
              "src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js",
            handlerPath: "src/bot/handlers/pmCapabilities.js",
            dbWrites: false,
          },
          tests: {
            projectMemoryReadWriteCommandsManualTelegramVerified: true,
            pmCapabilitiesRuntimeVerified: false,
          },
          capabilities: [
            {
              key: "project_memory_core_commands",
              title: "Project Memory core commands",
              status: "runtime_verified",
              userBenefit:
                "Монарх может вручную читать, писать и проверять Project Memory через Telegram-команды.",
              evidenceRefs: [
                "/pm_wiring_diag",
                "/pm_list",
                "/pm_set",
                "/pm_show",
              ],
              limitations: [
                "Snapshot не является источником истины.",
                "Источник истины остаётся repo/runtime/tests.",
              ],
            },
            {
              key: "capability_snapshot_read_only",
              title: "Project Capability Snapshot read-only view",
              status: "read_only",
              userBenefit:
                "СГ может показать понятный статус своих текущих возможностей без записи в память.",
              evidenceRefs: [
                "src/projectMemory/ProjectCapabilitySnapshotFactory.js",
                "src/bot/handlers/pmCapabilities.js",
              ],
              limitations: [
                "Команду нужно дополнительно проверить вручную в Telegram после deploy.",
                "Автоматическая запись snapshot в project_memory пока запрещена.",
              ],
            },
          ],
          limitations: [
            "Capability snapshot advisory only.",
            "No automatic DB writes.",
            "No manual pillar completion marks.",
            "No raw chat as uncontrolled prompt memory.",
          ],
          nextSafeStep:
            "Deploy and manually test /pm_capabilities in Telegram, then verify Render logs.",
        },
      });

      return { handled: true };
    }

    case "/pm_show": {
      if (typeof ctx.getProjectSection !== "function") {
        await reply("⛔ getProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmShow({
        bot,
        chatId,
        rest: ctx.rest,
        getProjectSection: ctx.getProjectSection,
      });

      return { handled: true };
    }

    case "/pm_set": {
      if (typeof ctx.upsertProjectSection !== "function") {
        await reply("⛔ upsertProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmSet({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        rest: ctx.rest,
        bypass: !!ctx.bypass,
        upsertProjectSection: ctx.upsertProjectSection,
      });

      return { handled: true };
    }

    case "/pm_list": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmList({
        bot,
        chatId,
        rest: ctx.rest,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_latest": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmLatest({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_digest": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmDigest({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_find": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmFind({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

export default {
  dispatchProjectMemoryBasicCommands,
};
