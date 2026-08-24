import { randomUUID } from 'node:crypto';

function isoFromSeconds(value, field) {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds)) throw new TypeError(`${field} must be unix seconds`);
  return new Date(seconds * 1000).toISOString();
}

export function createOpenAICostReconciler({ client, store, clock = () => new Date(), lookbackDays = 7, settlementLagHours = 24 } = {}) {
  if (!client?.listCosts || !client?.listCompletionsUsage) throw new TypeError('OpenAI usage client is required');
  if (!store?.upsertProviderBucket || !store?.recordRun || !store?.estimatedCost) throw new TypeError('cost reconciliation store is required');
  return Object.freeze({
    async reconcile() {
      const startedAt = clock().toISOString();
      const windowEndDate = new Date(clock().getTime() - settlementLagHours * 3600000);
      windowEndDate.setUTCMinutes(0, 0, 0);
      const windowStartDate = new Date(windowEndDate.getTime() - lookbackDays * 86400000);
      const run = { runId: randomUUID(), provider: 'openai', startedAt, completedAt: null, windowStart: windowStartDate.toISOString(), windowEnd: windowEndDate.toISOString(), status: 'running', bucketCount: 0, providerCostUsd: null, estimatedCostUsd: null, differenceUsd: null, errorCode: null, metadata: {} };
      await store.recordRun(run);
      try {
        const [costBuckets, usageBuckets] = await Promise.all([
          client.listCosts({ startTime: windowStartDate, endTime: windowEndDate }),
          client.listCompletionsUsage({ startTime: windowStartDate, endTime: windowEndDate })
        ]);
        let providerCostUsd = 0;
        let resultCount = 0;
        for (const bucket of costBuckets) {
          for (const item of bucket.results ?? []) {
            const currency = String(item.amount?.currency ?? '').toLowerCase();
            const amount = Number(item.amount?.value);
            if (currency !== 'usd' || !Number.isFinite(amount) || amount < 0) throw Object.assign(new Error('unsupported OpenAI cost bucket'), { code: 'openai-cost-bucket-invalid' });
            providerCostUsd += amount; resultCount += 1;
            await store.upsertProviderBucket({ provider: 'openai', startTime: isoFromSeconds(bucket.start_time, 'bucket.start_time'), endTime: isoFromSeconds(bucket.end_time, 'bucket.end_time'), projectId: item.project_id, apiKeyId: item.api_key_id, lineItem: item.line_item, currency, amount, source: 'openai-organization-costs-api', fetchedAt: clock().toISOString(), raw: item });
          }
        }
        const estimated = await store.estimatedCost({ startTime: run.windowStart, endTime: run.windowEnd });
        const differenceUsd = Number((providerCostUsd - estimated.amountUsd).toFixed(12));
        const completed = { ...run, completedAt: clock().toISOString(), status: 'reconciled', bucketCount: resultCount, providerCostUsd, estimatedCostUsd: estimated.amountUsd, differenceUsd, metadata: { usageBucketCount: usageBuckets.length, localCallCount: estimated.callCount, attribution: 'aggregate-window' } };
        await store.recordRun(completed);
        return Object.freeze(completed);
      } catch (error) {
        const failed = { ...run, completedAt: clock().toISOString(), status: 'failed', errorCode: error?.code ?? 'openai-cost-reconciliation-failed', metadata: { retryable: Boolean(error?.retryable) } };
        await store.recordRun(failed);
        throw error;
      }
    }
  });
}

export function createCostReconciliationResource({ reconciler, enabled = true, intervalMs = 86400000, costIntelligence = null } = {}) {
  let timer = null; let lastResult = null; let lastError = null; let running = null;
  async function run() {
    if (running) return running;
    running = reconciler.reconcile().then((result) => { lastResult = result; lastError = null; return result; }, (error) => { lastError = error; return null; }).finally(() => { running = null; });
    return running;
  }
  return Object.freeze({
    async start() { if (!enabled) return; await run(); timer = setInterval(run, intervalMs); timer.unref?.(); },
    async stop() { if (timer) clearInterval(timer); timer = null; if (running) await running; await costIntelligence?.flush?.(); },
    health() { return Object.freeze({ enabled, running: Boolean(running), lastStatus: lastResult?.status ?? null, lastCompletedAt: lastResult?.completedAt ?? null, lastErrorCode: lastError?.code ?? null }); },
    runNow: run
  });
}
