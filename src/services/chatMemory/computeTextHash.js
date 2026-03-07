// src/services/chatMemory/computeTextHash.js

import crypto from "crypto";

export function computeTextHash(input) {
  const value = input === null || input === undefined ? "" : String(input);

  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}