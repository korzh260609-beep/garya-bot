// AGENT NOTE:
// SG 2.0 config/env boundary.
// Purpose: centralize safe environment access for the clean modular branch.
// Do not scatter direct process.env reads across modules without explicit Monarch approval.

export function envStr(key, fallback = "") {
  const value = process.env[key];

  if (value === undefined || value === null) {
    return fallback;
  }

  const text = String(value);

  if (!text.trim()) {
    return fallback;
  }

  return text;
}

export function envInt(key, fallback) {
  const value = Number(process.env[key]);

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.floor(value);
}

export function envBool(key, fallback = false) {
  const raw = process.env[key];

  if (raw === undefined || raw === null || !String(raw).trim()) {
    return Boolean(fallback);
  }

  const value = String(raw).trim().toLowerCase();

  if (["1", "true", "yes", "y", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "n", "off"].includes(value)) {
    return false;
  }

  return Boolean(fallback);
}

export function requireEnv(key) {
  const value = envStr(key, "").trim();

  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

export function getPublicBaseUrl() {
  const explicitBaseUrl = envStr("BASE_URL", "").trim();
  if (explicitBaseUrl) return explicitBaseUrl.replace(/\/$/, "");

  const renderExternalUrl = envStr("RENDER_EXTERNAL_URL", "").trim();
  if (renderExternalUrl) return renderExternalUrl.replace(/\/$/, "");

  const renderExternalHostname = envStr("RENDER_EXTERNAL_HOSTNAME", "").trim();
  if (renderExternalHostname) {
    return `https://${renderExternalHostname}`.replace(/\/$/, "");
  }

  return "";
}

export function getRuntimeConfig() {
  const botToken = envStr("BOT_TOKEN", "").trim();
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
