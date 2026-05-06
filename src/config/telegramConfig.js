// AGENT NOTE:
// SG 2.0 Telegram/public URL config helpers.
// Purpose: isolate Telegram token and public base URL config from low-level env primitives.
// Do not add Telegram SDK setup, webhook registration, AI config, or runtime status here.

import { envFirst, envStr } from "./envPrimitives.js";

export function getTelegramBotToken() {
  return envFirst(["TELEGRAM_BOT_TOKEN", "BOT_TOKEN"], "").trim();
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
