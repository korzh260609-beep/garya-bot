function json(value) { return JSON.stringify(value ?? null); }
function numberOrNull(value) { return value == null ? null : Number(value); }

export function createPostgresCostIntelligenceStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async recordCall(call) {
      await database.query(`INSERT INTO ai_cost_calls
        (call_id,trace_id,request_id,occurred_at,provider,model,tier,project_id,workspace_id,usage,pricing_snapshot,calculated_cost_usd,provider_reported_cost_usd,effective_cost_usd,cost_source,reconciliation_status,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16,$17::jsonb)
        ON CONFLICT(call_id) DO NOTHING`, [
        call.callId, call.traceId, call.requestId, call.occurredAt, call.provider, call.model, call.tier,
        call.projectId, call.workspaceId, json(call.usage), json(call.pricingSnapshot), numberOrNull(call.calculatedCostUsd),
        numberOrNull(call.providerReportedCostUsd), numberOrNull(call.effectiveCostUsd), call.costSource,
        call.reconciliationStatus, json({ reasoningEffort: call.reasoningEffort, taskClass: call.taskClass, fallbackUsed: call.fallbackUsed, escalationUsed: call.escalationUsed, role: call.role })
      ]);
    },
    async recordReconciliation(evidence) {
      await database.query(`UPDATE ai_cost_calls SET provider_reported_cost_usd=$2,effective_cost_usd=$2,cost_source='provider-reconciled',reconciliation_status='reconciled'
        WHERE call_id=$1`, [evidence.callId, evidence.providerCostUsd]);
    },
    async upsertProviderBucket(bucket) {
      await database.query(`INSERT INTO ai_provider_cost_buckets
        (provider,start_time,end_time,project_id,api_key_id,line_item,currency,amount,source,fetched_at,raw)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
        ON CONFLICT(provider,start_time,end_time,project_id,api_key_id,line_item) DO UPDATE SET currency=EXCLUDED.currency,amount=EXCLUDED.amount,source=EXCLUDED.source,fetched_at=EXCLUDED.fetched_at,raw=EXCLUDED.raw`,
      [bucket.provider, bucket.startTime, bucket.endTime, bucket.projectId ?? '', bucket.apiKeyId ?? '', bucket.lineItem ?? '', bucket.currency, bucket.amount, bucket.source, bucket.fetchedAt, json(bucket.raw)]);
    },
    async estimatedCost({ startTime, endTime, projectId = null }) {
      const result = await database.query(`SELECT COALESCE(sum(effective_cost_usd),0)::float8 AS amount, count(*)::int AS call_count
        FROM ai_cost_calls WHERE occurred_at >= $1 AND occurred_at < $2 AND ($3::text IS NULL OR project_id=$3)`, [startTime, endTime, projectId]);
      return Object.freeze({ amountUsd: Number(result.rows[0].amount), callCount: Number(result.rows[0].call_count) });
    },
    async recordRun(run) {
      await database.query(`INSERT INTO ai_cost_reconciliation_runs
        (run_id,provider,started_at,completed_at,window_start,window_end,status,bucket_count,provider_cost_usd,estimated_cost_usd,difference_usd,error_code,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        ON CONFLICT(run_id) DO UPDATE SET completed_at=EXCLUDED.completed_at,status=EXCLUDED.status,bucket_count=EXCLUDED.bucket_count,provider_cost_usd=EXCLUDED.provider_cost_usd,estimated_cost_usd=EXCLUDED.estimated_cost_usd,difference_usd=EXCLUDED.difference_usd,error_code=EXCLUDED.error_code,metadata=EXCLUDED.metadata`,
      [run.runId, run.provider, run.startedAt, run.completedAt, run.windowStart, run.windowEnd, run.status, run.bucketCount, numberOrNull(run.providerCostUsd), numberOrNull(run.estimatedCostUsd), numberOrNull(run.differenceUsd), run.errorCode ?? null, json(run.metadata ?? {})]);
    },
    async latestRun() {
      const result = await database.query('SELECT * FROM ai_cost_reconciliation_runs ORDER BY started_at DESC LIMIT 1');
      return result.rows[0] ?? null;
    }
  });
}
