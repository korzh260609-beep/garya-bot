import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";

/**
 * WebAdapter — Stage 6.6 SKELETON
 *
 * For future HTTP/API entrypoints (web app, REST, internal calls).
 * Not wired into production yet.
 */
export class WebAdapter extends TransportAdapter {
  constructor({ req, res } = {}) {
    super();
    this.req = req || null; // Express request (future)
    this.res = res || null; // Express response (future)
  }

  toContext(rawEvent) {
    // rawEvent can be { req, body } or any payload — keep skeleton generic
    const req = rawEvent?.req || this.req || null;
    const body = rawEvent?.body ?? null;

    const text =
      typeof body?.text === "string"
        ? body.text
        : typeof body?.message === "string"
          ? body.message
          : "";

    return createUnifiedContext({
      transport: "web",
      chatId: body?.chatId ?? null,
      senderId: body?.userId ?? null,
      chatType: "api",
      isPrivate: true,
      text,
      raw: rawEvent,
    });
  }

  async reply(context, message) {
    // Skeleton: if res exists, respond JSON; otherwise throw
    const res = context?.raw?.res || this.res;
    if (!res) throw new Error("WebAdapter.reply: res is not set (SKELETON)");

    res.status(200).json({
      ok: true,
      message: String(message ?? ""),
    });
  }
}
