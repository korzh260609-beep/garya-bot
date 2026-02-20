import { TransportAdapter } from "./TransportAdapter.js";
import { createUnifiedContext } from "./unifiedContext.js";

/**
 * EmailAdapter — Stage 6.7 SKELETON
 *
 * Future support:
 *   - inbound email parsing
 *   - SMTP / IMAP integration
 *   - webhook-based email providers
 *
 * IMPORTANT:
 *   Not wired into production.
 */
export class EmailAdapter extends TransportAdapter {
  constructor({ rawEmail } = {}) {
    super();
    this.rawEmail = rawEmail || null;
  }

  toContext(rawEvent) {
    const email = rawEvent || this.rawEmail || null;

    const subject = typeof email?.subject === "string" ? email.subject : "";
    const body = typeof email?.body === "string" ? email.body : "";

    return createUnifiedContext({
      transport: "email",
      chatId: email?.threadId ?? null,
      senderId: email?.from ?? null,
      chatType: "email",
      isPrivate: true,
      text: `${subject}\n${body}`.trim(),
      raw: email,
    });
  }

  async reply(context, message) {
    throw new Error("EmailAdapter.reply: not implemented (SKELETON)");
  }
}
