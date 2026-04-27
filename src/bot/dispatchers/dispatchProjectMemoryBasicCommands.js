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
import { handlePmShowDiag } from "../handlers/pmShowDiag.js";
import { handlePmControlledWriteDiag } from "../handlers/pmControlledWriteDiag.js";
import { handlePmContextDiag } from "../handlers/pmContextDiag.js";
import { handlePmShadowContextDiag } from "../handlers/pmShadowContextDiag.js";
import { handlePmReadSurfaceDiag } from "../handlers/pmReadSurfaceDiag.js";
import { handlePmFindDiag } from "../handlers/pmFindDiag.js";
import { handlePmList } from "../handlers/pmList.js";
import { handlePmDigest } from "../handlers/pmDigest.js";
import { handlePmLatest } from "../handlers/pmLatest.js";
import { handlePmFind } from "../handlers/pmFind.js";
import { handlePmWiringDiag } from "../handlers/pmWiringDiag.js";
import { handlePmCapabilities } from "../handlers/pmCapabilities.js";
import { handlePmCapabilitiesDiag } from "../handlers/pmCapabilitiesDiag.js";
import { getProjectCapabilitySnapshotFacts } from "../../projectMemory/ProjectCapabilitySnapshotFactsProvider.js";

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

    case "/pm_show_diag": {
      if (typeof ctx.getProjectSection !== "function") {
        await reply("⛔ getProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmShowDiag({
        bot,
        chatId,
        rest: ctx.rest,
        getProjectSection: ctx.getProjectSection,
      });

      return { handled: true };
    }

    case "/pm_context_diag": {
      if (typeof ctx.buildProjectMemoryContext !== "function") {
        await reply("⛔ buildProjectMemoryContext недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      if (typeof ctx.buildProjectMemoryDigest !== "function") {
        await reply("⛔ buildProjectMemoryDigest недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmContextDiag({
        bot,
        chatId,
        buildProjectMemoryContext: ctx.buildProjectMemoryContext,
        buildProjectMemoryDigest: ctx.buildProjectMemoryDigest,
      });

      return { handled: true };
    }

    case "/pm_shadow_context_diag": {
      const buildProjectMemoryContext =
        typeof ctx.buildProjectMemoryContext === "function"
          ? ctx.buildProjectMemoryContext
          : ctx.buildConfirmedProjectMemoryContext;

      const buildProjectMemoryDigest =
        typeof ctx.buildProjectMemoryDigest === "function"
          ? ctx.buildProjectMemoryDigest
          : ctx.buildConfirmedProjectMemoryDigest;

      if (typeof buildProjectMemoryContext !== "function") {
        await reply("⛔ buildProjectMemoryContext недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      if (typeof buildProjectMemoryDigest !== "function") {
        await reply("⛔ buildProjectMemoryDigest недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      if (typeof ctx.listConfirmedProjectMemoryEntries !== "function") {
        await reply("⛔ listConfirmedProjectMemoryEntries недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmShadowContextDiag({
        bot,
        chatId,
        buildProjectMemoryContext,
        buildProjectMemoryDigest,
        listConfirmedProjectMemoryEntries: ctx.listConfirmedProjectMemoryEntries,
      });

      return { handled: true };
    }

    case "/pm_surface_diag": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmReadSurfaceDiag({
        bot,
        chatId,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_find_diag": {
      if (typeof ctx.getProjectMemoryList !== "function") {
        await reply("⛔ getProjectMemoryList недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmFindDiag({
        bot,
        chatId,
        rest: ctx.rest,
        globalUserId: ctx.globalUserId ?? null,
        getProjectMemoryList: ctx.getProjectMemoryList,
      });

      return { handled: true };
    }

    case "/pm_controlled_diag": {
      if (typeof ctx.upsertProjectSection !== "function") {
        await reply("⛔ upsertProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      if (typeof ctx.getProjectSection !== "function") {
        await reply("⛔ getProjectSection недоступен (ошибка wiring).", {
          cmd: cmd0,
        });
        return { handled: true };
      }

      await handlePmControlledWriteDiag({
        bot,
        chatId,
        chatIdStr,
        transport: ctx.transport,
        bypass: !!ctx.bypass,
        upsertProjectSection: ctx.upsertProjectSection,
        getProjectSection: ctx.getProjectSection,
      });

      return { handled: true };
    }

    case "/pm_capabilities": {
      await handlePmCapabilities({
        bot,
        chatId,
        input: getProjectCapabilitySnapshotFacts(),
      });

      return { handled: true };
    }

    case "/pm_capabilities_diag": {
      await handlePmCapabilitiesDiag({
        bot,
        chatId,
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