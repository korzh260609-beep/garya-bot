// AGENT NOTE:
// SG 2.0 health status builder.
// Purpose: build the public /health response separately from HTTP route wiring.
// Do not add secrets, Telegram setup, AI calls, memory, tasks, sources, permissions, or GitHub write logic here.

import { buildRuntimeStatusBlock } from "./runtimeStatusPresenter.js";

export function buildHealthStatus({ telegramBot } = {}) {
  return {
    ok: true,
    service: "sg2-foundation",
    status: "healthy",
    telegram: Boolean(telegramBot),
    runtime: buildRuntimeStatusBlock(),
  };
}
