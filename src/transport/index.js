// src/transport/index.js
// STAGE 6.4 — Transport Layer Barrel File (SKELETON)
//
// Purpose:
//   Centralized export point for all transport adapters.
//   Does NOT wire anything into production yet.
//   Only defines structure.
//
// IMPORTANT:
//   No side-effects.
//   No runtime initialization here.

export { TransportAdapter } from "./TransportAdapter.js";
export { TelegramAdapter } from "./telegramAdapter.js";
export { DiscordAdapter } from "./discordAdapter.js";
export { WebAdapter } from "./webAdapter.js";
export { EmailAdapter } from "./emailAdapter.js";

export { createUnifiedContext } from "./unifiedContext.js";
