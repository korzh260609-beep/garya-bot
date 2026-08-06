function json(response, statusCode, body) {
  response.statusCode = statusCode;
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

export function createTelegramWebhookHttpHandler({ integration, path = '/webhooks/telegram', maxBodyBytes = 1024 * 1024 } = {}) {
  if (!integration || typeof integration.handleWebhook !== 'function') throw new TypeError('Telegram integration is required');

  return async function telegramWebhookHttpHandler(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== path) return false;
    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST');
      json(response, 405, { ok: false, code: 'method-not-allowed' });
      return true;
    }
    try {
      const body = await readJson(request, maxBodyBytes);
      const result = await integration.handleWebhook({ headers: request.headers ?? {}, body });
      json(response, result.statusCode, result.body);
    } catch (error) {
      const statusCode = error.code === 'payload-too-large' ? 413 : 400;
      json(response, statusCode, { ok: false, code: error.code ?? 'invalid-request' });
    }
    return true;
  };
}
