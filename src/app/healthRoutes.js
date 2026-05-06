// AGENT NOTE:
// SG 2.0 health HTTP route module.
// Purpose: keep /health route wiring separate from health status building.
// Do not add Telegram, AI, memory, tasks, sources, permissions, or GitHub write logic here.

import { buildHealthStatus } from "./healthStatus.js";

export function attachHealthRoutes(app, { telegramBot } = {}) {
  app.get("/health", (req, res) => {
    res.status(200).json(buildHealthStatus({ telegramBot }));
  });

  return app;
}
