export class OpenAIAdminApiError extends Error {
  constructor(message, { code = 'openai-admin-api-error', status = null, retryable = false } = {}) {
    super(message); this.name = 'OpenAIAdminApiError'; this.code = code; this.status = status; this.retryable = retryable;
  }
}

function unixSeconds(value, name) {
  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor(date.getTime() / 1000);
  if (!Number.isSafeInteger(seconds)) throw new TypeError(`${name} must be a valid timestamp`);
  return seconds;
}

export function createOpenAIAdminUsageClient({ credentialManager, credentialAccessContext, credentialId = 'sg.openai.admin', fetchImpl = globalThis.fetch, baseUrl = 'https://api.openai.com/v1', timeoutMs = 30000 } = {}) {
  if (!credentialManager?.useCredential) throw new TypeError('credentialManager.useCredential is required');
  if (!credentialAccessContext?.actor || !credentialAccessContext?.scope) throw new TypeError('credentialAccessContext is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');

  async function page(path, params) {
    return credentialManager.useCredential({ credentialId, actor: credentialAccessContext.actor, scope: credentialAccessContext.scope,
      purpose: 'openai.usage-cost-reconciliation', connectionId: 'openai-admin', operation: async (key) => {
        const url = new URL(`${baseUrl.replace(/\/$/, '')}${path}`);
        for (const [name, value] of Object.entries(params)) {
          if (value == null) continue;
          for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(name, String(item));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response;
        try { response = await fetchImpl(url, { headers: { authorization: `Bearer ${key}`, accept: 'application/json' }, signal: controller.signal }); }
        catch (error) { throw new OpenAIAdminApiError('OpenAI Admin API request failed', { code: error?.name === 'AbortError' ? 'openai-admin-timeout' : 'openai-admin-network-error', retryable: true }); }
        finally { clearTimeout(timer); }
        if (!response.ok) throw new OpenAIAdminApiError(`OpenAI Admin API returned HTTP ${response.status}`, { code: `openai-admin-http-${response.status}`, status: response.status, retryable: response.status === 429 || response.status >= 500 });
        const body = await response.json();
        if (!Array.isArray(body?.data)) throw new OpenAIAdminApiError('OpenAI Admin API response schema is invalid', { code: 'openai-admin-schema-invalid' });
        return body;
      } });
  }

  async function allPages(path, params) {
    const buckets = [];
    let pageCursor = null;
    do {
      const body = await page(path, { ...params, page: pageCursor });
      buckets.push(...body.data);
      pageCursor = body.has_more === true ? body.next_page : null;
      if (body.has_more === true && !pageCursor) throw new OpenAIAdminApiError('OpenAI Admin API pagination cursor is missing', { code: 'openai-admin-schema-invalid' });
    } while (pageCursor);
    return Object.freeze(buckets);
  }

  return Object.freeze({
    listCosts({ startTime, endTime, bucketWidth = '1d', projectIds = [] } = {}) {
      return allPages('/organization/costs', { start_time: unixSeconds(startTime, 'startTime'), end_time: unixSeconds(endTime, 'endTime'), bucket_width: bucketWidth, limit: 180, group_by: ['project_id', 'line_item'], project_ids: projectIds });
    },
    listCompletionsUsage({ startTime, endTime, bucketWidth = '1d', projectIds = [] } = {}) {
      return allPages('/organization/usage/completions', { start_time: unixSeconds(startTime, 'startTime'), end_time: unixSeconds(endTime, 'endTime'), bucket_width: bucketWidth, limit: 180, group_by: ['project_id', 'model'], project_ids: projectIds });
    }
  });
}
