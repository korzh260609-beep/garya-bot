// src/core/handleMessage/commandParsing.js

import { CMD_ACTION } from "../../bot/cmdActionMap.js";
import { parseCommand } from "../../../core/helpers.js";
import { can } from "../../users/permissions.js";
import { IDEMPOTENCY_BYPASS } from "./shared.js";

export function parseCommandAccess({ trimmed, user }) {
  const isCommand = trimmed.startsWith("/");
  const parsed = isCommand ? parseCommand(trimmed) : null;
  const cmdBase = parsed ? String(parsed.cmd).split("@")[0] : null;
  const rest = parsed?.rest || "";

  let canProceed = true;

  if (isCommand && cmdBase) {
    const action = CMD_ACTION[cmdBase];
    if (action) {
      canProceed = can(user, action);
    }
  }

  if (isCommand && cmdBase && IDEMPOTENCY_BYPASS.has(cmdBase)) {
    canProceed = true;
  }

  return {
    isCommand,
    parsed,
    cmdBase,
    rest,
    canProceed,
  };
}