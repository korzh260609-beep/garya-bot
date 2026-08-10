import { createSecurityOperations, createSecurityOperationsConfig } from '../operations/securityOperations.js';

function applySecurityHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
}

function json(response, statusCode, body) {
  response.statusCode = statusCode;
  applySecurityHeaders(response);
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

async function readJson(request, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Telegram update payload is too large');
      error.code = 'payload-too-large';
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch {
    const error = new Error('Telegram update payload is invalid JSON');
    error.code = 'invalid-json';
    throw error;
  }
}

function requestNetworkId(request) {
  const forwarded = String(request.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  return forwarded || request.socket?.remoteAddress || null;
}

export function createTelegramWebhookHttpHandler({
  integration,
  path = '/webhooks/telegram',
  maxBodyBytes = null,
  securityOperations = createSecurityOperations({ config: createSecurityOperationsConfig(process.env) })
} = {}) {
  if (!integration || typeof integration.handleWebhook !== 'function') throw new TypeError('Telegram integration is required');
  const bodyLimit = maxBodyBytes ?? securityOperations.config.maxHttpBodyBytes;

  return async function telegramWebhookHttpHandler(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== path) return false;
    if (!securityOperations.permits('telegram-ingress')) {
      json(response, 503, { ok: false, code: 'telegram-ingress-disabled' });
      return true;
    }
    const rate = securityOperations.checkRateLimit({ transport: 'telegram', networkId: requestNetworkId(request) });
    if (!rate.allowed) {
      response.setHeader('retry-after', String(Math.max(1, Math.ceil(rate.retryAfterMs / 1000))));
      json(response, 429, { ok: false, code: 'rate-limited' });
      return true;
    }
    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST');
      json(response, 405, { ok: false, code: 'method-not-allowed' });
      return true;
    }
    const contentType = String(request.headers?.['content-type'] ?? '').toLowerCase();
    if (contentType && !contentType.startsWith('application/json')) {
      json(response, 415, { ok: false, code: 'unsupported-media-type' });
      return true;
    }
    try {
      const body = await readJson(request, bodyLimit);
      const result = await integration.handleWebhook({ headers: request.headers ?? {}, body });
      json(response, result.statusCode, result.body);
    } catch (error) {
      const statusCode = error.code === 'payload-too-large' ? 413 : 400;
      json(response, statusCode, { ok: false, code: error.code ?? 'invalid-request' });
    }
    return true;
  };
}
