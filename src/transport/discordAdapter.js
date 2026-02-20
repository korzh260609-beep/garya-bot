import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";

/**
 * DiscordAdapter — Stage 6.5 SKELETON
 *
 * IMPORTANT:
 *   No Discord transport is wired yet.
 *   This adapter exists only to fix the contract shape for future integration.
 */
export class DiscordAdapter extends TransportAdapter {
  constructor({ client } = {}) {
    super();
    this.client = client || null; // placeholder for discord.js client
  }

  toContext(rawEvent) {
    // We don't have Discord event shape wired yet.
    // Keep skeleton: return normalized envelope with raw payload.
    return createUnifiedContext({
      transport: "discord",
      chatId: null,
      senderId: null,
      chatType: "unknown",
      isPrivate: false,
      text: "",
      raw: rawEvent,
    });
  }

  async reply(context, message) {
    throw new Error("DiscordAdapter.reply: not implemented (SKELETON)");
  }
}
