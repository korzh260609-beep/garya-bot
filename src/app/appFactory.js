// AGENT NOTE:
// SG 2.0 Express app factory.
// Purpose: assemble HTTP middleware, approved transports, and public routes without bloating index.js.
// Do not add AI, memory, tasks, sources, permissions, or GitHub write logic here.

import express from "express";
import { initTelegramTransport } from "../transport/telegram.js";
import { attachRootRoutes } from "./rootRoutes.js";
import { attachHealthRoutes } from "./healthRoutes.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "256kb" }));

  const telegramBot = initTelegramTransport(app);

  attachRootRoutes(app);
  attachHealthRoutes(app, { telegramBot });

  return {
    app,
    telegramBot,
  };
}
