function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function rowToRecord(row) {
  if (!row) return null;
  return Object.freeze({
    deliveryId: row.delivery_id,
    idempotencyKey: row.idempotency_key,
    kind: row.kind,
    actorGlobalUserId: row.actor_global_user_id,
    recipientGlobalUserId: row.recipient_global_user_id,
    projectScope: row.project_scope,
    transport: row.transport ?? null,
    target: row.target ?? null,
    status: row.status,
    attempts: row.attempts,
    failureCode: row.failure_code ?? null,
    retryable: row.retryable === true,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    providerResult: row.provider_result ?? null,
    traceContext: row.trace_context ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  });
}

export function createPostgresDeliveryStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  return Object.freeze({
    async getByIdempotencyKey(idempotencyKey) {
      const result = await database.query(`SELECT * FROM delivery_records WHERE idempotency_key=$1`, [required(idempotencyKey, 'idempotencyKey')]);
      return rowToRecord(result.rows[0]);
    },
    async get(deliveryId) {
      const result = await database.query(`SELECT * FROM delivery_records WHERE delivery_id=$1`, [required(deliveryId, 'deliveryId')]);
      return rowToRecord(result.rows[0]);
    },
    async put(record) {
      const result = await database.query(`INSERT INTO delivery_records(
        delivery_id,idempotency_key,kind,actor_global_user_id,recipient_global_user_id,project_scope,transport,target,status,attempts,failure_code,retryable,delivered_at,provider_result,trace_context,metadata,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,NOW())
      ON CONFLICT(idempotency_key) DO UPDATE SET
        transport=CASE WHEN delivery_records.status='delivered' THEN delivery_records.transport ELSE EXCLUDED.transport END,
        target=CASE WHEN delivery_records.status='delivered' THEN delivery_records.target ELSE EXCLUDED.target END,
        status=CASE WHEN delivery_records.status='delivered' THEN delivery_records.status ELSE EXCLUDED.status END,
        attempts=GREATEST(delivery_records.attempts,EXCLUDED.attempts),
        failure_code=CASE WHEN delivery_records.status='delivered' THEN delivery_records.failure_code ELSE EXCLUDED.failure_code END,
        retryable=CASE WHEN delivery_records.status='delivered' THEN FALSE ELSE EXCLUDED.retryable END,
        delivered_at=COALESCE(delivery_records.delivered_at,EXCLUDED.delivered_at),
        provider_result=COALESCE(delivery_records.provider_result,EXCLUDED.provider_result),
        trace_context=EXCLUDED.trace_context,metadata=EXCLUDED.metadata,updated_at=NOW()
      RETURNING *`, [
        required(record.deliveryId, 'record.deliveryId'), required(record.idempotencyKey, 'record.idempotencyKey'), required(record.kind, 'record.kind'),
        required(record.actorGlobalUserId, 'record.actorGlobalUserId'), required(record.recipientGlobalUserId, 'record.recipientGlobalUserId'), required(record.projectScope, 'record.projectScope'),
        record.transport ?? record.target?.transport ?? null, JSON.stringify(record.target ?? null), required(record.status, 'record.status'), Number(record.attempts ?? 0), record.failureCode ?? null,
        record.retryable === true, record.deliveredAt ?? null, JSON.stringify(record.providerResult ?? null), JSON.stringify(record.traceContext ?? {}), JSON.stringify(record.metadata ?? {})
      ]);
      return rowToRecord(result.rows[0]);
    }
  });
}
