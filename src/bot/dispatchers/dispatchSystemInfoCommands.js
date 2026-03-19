// src/bot/dispatchers/dispatchSystemInfoCommands.js
// Extracted 1:1 from commandDispatcher.js
// Purpose: keep commandDispatcher smaller without changing behavior.

import { handleProjectStatus } from "../handlers/projectStatus.js";
import { handleHealth } from "../handlers/health.js";
import { getPublicEnvSnapshot } from "../../core/config.js";

export async function dispatchSystemInfoCommands({ cmd0, ctx, reply }) {
  const { bot, chatId } = ctx;

  switch (cmd0) {
    case "/health": {
      await handleHealth({ bot, chatId });
      return { handled: true };
    }

    case "/project_status": {
      await handleProjectStatus({ bot, chatId });
      return { handled: true };
    }

    case "/build_info": {
      const pub = getPublicEnvSnapshot();

      const commit =
        String(pub.RENDER_GIT_COMMIT || "").trim() ||
        String(pub.GIT_COMMIT || "").trim() ||
        "unknown";

      const serviceId = String(pub.RENDER_SERVICE_ID || "").trim() || "unknown";

      const instanceId =
        String(pub.RENDER_INSTANCE_ID || "").trim() ||
        String(pub.HOSTNAME || "").trim() ||
        "unknown";

      const nodeEnv = String(pub.NODE_ENV || "").trim() || "unknown";

      await reply(
        ["🧩 BUILD INFO", `commit: ${commit}`, `service: ${serviceId}`, `instance: ${instanceId}`, `node_env: ${nodeEnv}`].join(
          "\n"
        ),
        { cmd: cmd0, handler: "commandDispatcher" }
      );

      return { handled: true };
    }

    default:
      return { handled: false };
  }
}