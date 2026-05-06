// AGENT NOTE:
// SG 2.0 root HTTP route module.
// Purpose: keep / route wiring separate from root status building.
// Do not add Telegram, AI, memory, tasks, sources, permissions, or GitHub write logic here.

import { buildRootStatus } from "./rootStatus.js";

export function attachRootRoutes(app) {
  app.get("/", (req, res) => {
    res.status(200).json(buildRootStatus());
  });

  return app;
}
