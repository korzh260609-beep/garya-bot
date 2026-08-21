import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIAdminUsageClient, OpenAIAdminApiError } from '../src/ai/openAIAdminUsageClient.js';
import { createOpenAICostReconciler, createCostReconciliationResource } from '../src/ai/costReconciliation.js';
import { createAICostIntelligence } from '../src/ai/costIntelligence.js';
import { createDeploymentCredentialManager } from '../src/secrets/credentialManager.js';

function adminClient(fetchImpl) {
  const deployment = createDeploymentCredentialManager({ env: { OPENAI_ADMIN_API_KEY: 'secret-admin-key' } });
  return createOpenAIAdminUsageClient({ credentialManager: deployment.manager, credentialAccessContext: deployment.accessContext, fetchImpl });
}

test('AR2.10 production reconciliation reads paginated OpenAI Costs without exposing the admin key', async () => {
  const requests = [];
  const client = adminClient(async (url, options) => {
    requests.push({ url: String(url), authorization: options.headers.authorization });
    const next = new URL(url).searchParams.get('page');
    return { ok: true, async json() { return next ? { data: [{ start_time: 2, end_time: 3, results: [] }], has_more: false } : { data: [{ start_time: 1, end_time: 2, results: [] }], has_more: true, next_page: 'cursor-2' }; } };
  });
  const result = await client.listCosts({ startTime: '2026-08-01T00:00:00Z', endTime: '2026-08-03T00:00:00Z' });
  assert.equal(result.length, 2);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\/v1\/organization\/costs/);
  assert.match(requests[0].url, /group_by=project_id/);
  assert.match(requests[1].url, /page=cursor-2/);
  assert.equal(JSON.stringify(requests).includes('secret-admin-key'), true);
  assert.equal(requests[0].url.includes('secret-admin-key'), false);
});

test('AR2.10 rejects invalid OpenAI Admin response schemas instead of accepting zero cost', async () => {
  const client = adminClient(async () => ({ ok: true, async json() { return { unexpected: [] }; } }));
  await assert.rejects(() => client.listCosts({ startTime: '2026-08-01', endTime: '2026-08-02' }), (error) => error instanceof OpenAIAdminApiError && error.code === 'openai-admin-schema-invalid');
});

test('AR2.10 stores authoritative aggregate cost and reconciliation difference', async () => {
  const buckets = []; const runs = [];
  const store = {
    async upsertProviderBucket(bucket) { buckets.push(bucket); },
    async estimatedCost() { return { amountUsd: 0.8, callCount: 4 }; },
    async recordRun(run) { runs.push(run); }
  };
  const client = {
    async listCosts() { return [{ start_time: 1785542400, end_time: 1785628800, results: [{ amount: { currency: 'usd', value: 1.25 }, project_id: 'project-1', line_item: 'responses' }] }]; },
    async listCompletionsUsage() { return [{ start_time: 1785542400, end_time: 1785628800, results: [{ model: 'gpt-fixture', input_tokens: 10 }] }]; }
  };
  const clock = () => new Date('2026-08-20T12:00:00Z');
  const result = await createOpenAICostReconciler({ client, store, clock }).reconcile();
  assert.equal(result.status, 'reconciled');
  assert.equal(result.providerCostUsd, 1.25);
  assert.equal(result.estimatedCostUsd, 0.8);
  assert.equal(result.differenceUsd, 0.45);
  assert.equal(result.metadata.attribution, 'aggregate-window');
  assert.equal(buckets[0].source, 'openai-organization-costs-api');
  assert.equal(runs.at(-1).status, 'reconciled');
});

test('AR2.10 keeps missing prices unpriced and flushes durable call writes', async () => {
  const persisted = [];
  const intelligence = createAICostIntelligence({ persistence: { async recordCall(call) { persisted.push(call); } } });
  const record = intelligence.recordCall({ model: { provider: 'openai', model: 'unknown', tier: 'L1' }, request: { traceContext: { traceId: 't', requestId: 'r' }, routing: { taskClass: 'analysis' }, metadata: {} }, result: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } } });
  assert.equal(record.costSource, 'unpriced');
  assert.equal(record.effectiveCostUsd, null);
  await intelligence.flush();
  assert.equal(persisted.length, 1);
});

test('AR2.10 reconciliation resource degrades safely when the provider is temporarily unavailable', async () => {
  const resource = createCostReconciliationResource({ reconciler: { async reconcile() { throw Object.assign(new Error('offline'), { code: 'network' }); } }, intervalMs: 60000 });
  await resource.start();
  assert.equal(resource.health().lastErrorCode, 'network');
  await resource.stop();
});
