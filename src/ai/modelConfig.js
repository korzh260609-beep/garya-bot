// AGENT NOTE:
// SG 2.0 minimal AI model config.
// Purpose: keep model selection in one place until Model Router is implemented.
// Do not scatter model names across the codebase or hardcode provider policy inside handlers.

import { envStr } from "../config/env.js";

export function getDefaultModel() {
  return envStr("OPENAI_MODEL", "gpt-4.1-mini").trim();
}

export function getDefaultMaxOutputTokens() {
  return 500;
}
