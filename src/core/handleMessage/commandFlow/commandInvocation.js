// src/core/handleMessage/commandFlow/commandInvocation.js

import { insertCommandInvocation } from "../../../db/commandInvocationsRepo.js";
import { IDEMPOTENCY_BYPASS } from "../shared.js";

export async function ensureCommandInvocation({
  transport,
  chatIdStr,
  messageId,
  cmdBase,
  globalUserId,
  senderId,
}) {
  let commandInvocationInserted = true;

  if (!IDEMPOTENCY_BYPASS.has(cmdBase)) {
    try {
      if (transport === "telegram" && chatIdStr && messageId) {
        const ins = await insertCommandInvocation({
          transport,
          chatId: chatIdStr,
          messageId: Number(messageId),
          cmd: cmdBase,
          globalUserId: globalUserId || null,
          senderId: senderId || "",
          metadata: { enforced: true, source: "core.handleMessage" },
        });

        if (!ins?.inserted) {
          commandInvocationInserted = false;
          return {
            shouldReturn: true,
            commandInvocationInserted,
            response: { ok: true, stage: "6.8.2", result: "dup_command_drop", cmdBase },
          };
        }
      }
    } catch (e) {
      console.error("core command idempotency guard failed:", e);
      commandInvocationInserted = true;
    }
  }

  return {
    shouldReturn: false,
    commandInvocationInserted,
  };
}