// AGENT NOTE:
// SG 2.0 runtime config/status helpers.
// Purpose: build safe public runtime config/status from env primitives and config modules.
// Do not add transport setup, AI calls, repository mutation, or business logic here.

import { envInt, envStr } from "./envPrimitives.js";
import { getPublicBaseUrl, getTelegramBotToken } from "./telegramConfig.js";

export function getRuntimeConfig() {
  const botToken = getTelegramBotToken();
  const monarchUserId = envStr("MONARCH_USER_ID", "").trim();
  const openaiApiKey = envStr("OPENAI_API_KEY", "").trim();

  return {
    nodeEnv: envStr("NODE_ENV", "development"),
    port: envInt("PORT", 3000),
    botToken,
    monarchUserId,
    openaiApiKeyPresent: Boolean(openaiApiKey),
    openaiModel: envStr("OPENAI_MODEL", "gpt-4.1-mini").trim(),
    baseUrlPresent: Boolean(getPublicBaseUrl()),
  };
}

export function getPublicRuntimeStatus() {
  const config = getRuntimeConfig();

  return {
    nodeEnv: config.nodeEnv,
    telegramConfigured: Boolean(config.botToken),
    monarchConfigured: Boolean(config.monarchUserId),
    aiConfigured: config.openaiApiKeyPresent,
    openaiModel: config.openaiModel,
    baseUrlConfigured: config.baseUrlPresent,
  };
}
