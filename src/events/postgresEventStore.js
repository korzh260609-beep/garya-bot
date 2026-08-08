function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}
function rowToEvent(row) {
  if (!row) return null;
  return Object.freeze({
    eventId: row.event_id,
    eventType: row.event_type,
    version: row.version,
    occurredAt: new Date(row.occurred_at).toISOString(),
    traceContext: row.trace_context ?? {},
    scope: row.scope ?? {},
    actorGlobalUserId: row.actor_global_user_id ?? null,
    privacyClass: row.privacy_class,
    orderingKey: row.ordering_key ?? null,
    provenance: row.provenance ?? {},
    payload: row.payload ?? {}
  });
}
function rowToSubscription(row) {
  if (!row) return null;
  return Object.freeze({
    subscriberId: row.subscriber_id,
    eventTypes: Object.freeze(row.event_types ?? []),
    mode: row.mode,
    projectScope: row.project_scope ?? null,
    globalUserId: row.global_user_id ?? null,
    resourceId: row.resource_id ?? null,
    privacyClasses: Object.freeze(row.privacy_classes ?? []),
    maxAttempts: row.max_attempts,
    metadata: Object.freeze(row.metadata ?? {})
  });
}
function rowToDelivery(row) {
  if (!row) return null;
  return Object.freeze({
    deliveryId: row.delivery_id,
    eventId: row.event_id,
    subscriberId: row.subscriber_id,
    status: row.status,
    attempts: row.attempts,
    failureCode: row.failure_code ?? null,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  });
}

export function createPostgresEventStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database is required');
  return Object.freeze({
    async appendEvent(event) {
      const result = await database.query(`INSERT INTO internal_events(
        event_id,event_type,version,occurred_at,trace_context,scope,actor_global_user_id,privacy_class,ordering_key,provenance,payload
      ) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11::jsonb)
      ON CONFLICT(event_id) DO NOTHING RETURNING *`, [
        required(event.eventId,'event.eventId'), required(event.eventType,'event.eventType'), required(event.version,'event.version'), event.occurredAt,
        JSON.stringify(event.traceContext ?? {}), JSON.stringify(event.scope ?? {}), event.actorGlobalUserId ?? null, required(event.privacyClass,'event.privacyClass'), event.orderingKey ?? null,
        JSON.stringify(event.provenance ?? {}), JSON.stringify(event.payload ?? {})
      ]);
      if (result.rows[0]) return rowToEvent(result.rows[0]);
      const existing = await database.query('SELECT * FROM internal_events WHERE event_id=$1', [event.eventId]);
      return rowToEvent(existing.rows[0]);
    },
    async getEvent(eventId) {
      const result = await database.query('SELECT * FROM internal_events WHERE event_id=$1', [required(eventId,'eventId')]);
      return rowToEvent(result.rows[0]);
    },
    async registerSubscription(subscription) {
      const result = await database.query(`INSERT INTO internal_event_subscriptions(
        subscriber_id,event_types,mode,project_scope,global_user_id,resource_id,privacy_classes,max_attempts,metadata,updated_at
      ) VALUES($1,$2::jsonb,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,NOW())
      ON CONFLICT(subscriber_id) DO UPDATE SET event_types=EXCLUDED.event_types,mode=EXCLUDED.mode,project_scope=EXCLUDED.project_scope,global_user_id=EXCLUDED.global_user_id,resource_id=EXCLUDED.resource_id,privacy_classes=EXCLUDED.privacy_classes,max_attempts=EXCLUDED.max_attempts,metadata=EXCLUDED.metadata,updated_at=NOW()
      RETURNING *`, [
        required(subscription.subscriberId,'subscription.subscriberId'), JSON.stringify(subscription.eventTypes ?? []), required(subscription.mode,'subscription.mode'),
        subscription.projectScope ?? null, subscription.globalUserId ?? null, subscription.resourceId ?? null, JSON.stringify(subscription.privacyClasses ?? []),
        Number(subscription.maxAttempts ?? 3), JSON.stringify(subscription.metadata ?? {})
      ]);
      return rowToSubscription(result.rows[0]);
    },
    async listSubscriptions() {
      const result = await database.query('SELECT * FROM internal_event_subscriptions ORDER BY subscriber_id');
      return result.rows.map(rowToSubscription);
    },
    async enqueueDelivery(delivery) {
      const result = await database.query(`INSERT INTO internal_event_deliveries(
        delivery_id,event_id,subscriber_id,status,attempts,failure_code,next_attempt_at,created_at,updated_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT(event_id,subscriber_id) DO NOTHING RETURNING *`, [
        required(delivery.deliveryId,'delivery.deliveryId'), required(delivery.eventId,'delivery.eventId'), required(delivery.subscriberId,'delivery.subscriberId'),
        required(delivery.status,'delivery.status'), Number(delivery.attempts ?? 0), delivery.failureCode ?? null, delivery.nextAttemptAt ?? null, delivery.createdAt, delivery.updatedAt
      ]);
      if (result.rows[0]) return rowToDelivery(result.rows[0]);
      return this.getDelivery({ eventId: delivery.eventId, subscriberId: delivery.subscriberId });
    },
    async claimPending({ limit = 20, now = new Date().toISOString() } = {}) {
      const result = await database.query(`WITH claimed AS (
        SELECT delivery_id FROM internal_event_deliveries
        WHERE status='pending' AND (next_attempt_at IS NULL OR next_attempt_at <= $1)
        ORDER BY created_at, delivery_id
        FOR UPDATE SKIP LOCKED
        LIMIT $2
      )
      UPDATE internal_event_deliveries d SET status='processing',updated_at=$1
      FROM claimed c WHERE d.delivery_id=c.delivery_id RETURNING d.*`, [now, Number(limit)]);
      return result.rows.map(rowToDelivery);
    },
    async markDelivered({ eventId, subscriberId, attempts, deliveredAt }) {
      const result = await database.query(`UPDATE internal_event_deliveries SET status='delivered',attempts=$3,failure_code=NULL,next_attempt_at=NULL,delivered_at=$4,updated_at=$4 WHERE event_id=$1 AND subscriber_id=$2 RETURNING *`, [eventId, subscriberId, attempts, deliveredAt]);
      return rowToDelivery(result.rows[0]);
    },
    async markRetry({ eventId, subscriberId, attempts, failureCode, nextAttemptAt, updatedAt }) {
      const result = await database.query(`UPDATE internal_event_deliveries SET status='pending',attempts=$3,failure_code=$4,next_attempt_at=$5,updated_at=$6 WHERE event_id=$1 AND subscriber_id=$2 RETURNING *`, [eventId, subscriberId, attempts, failureCode, nextAttemptAt, updatedAt]);
      return rowToDelivery(result.rows[0]);
    },
    async markDeadLetter({ eventId, subscriberId, attempts, failureCode, updatedAt }) {
      const result = await database.query(`UPDATE internal_event_deliveries SET status='dead-letter',attempts=$3,failure_code=$4,next_attempt_at=NULL,updated_at=$5 WHERE event_id=$1 AND subscriber_id=$2 RETURNING *`, [eventId, subscriberId, attempts, failureCode, updatedAt]);
      return rowToDelivery(result.rows[0]);
    },
    async getDelivery({ eventId, subscriberId }) {
      const result = await database.query('SELECT * FROM internal_event_deliveries WHERE event_id=$1 AND subscriber_id=$2', [required(eventId,'eventId'), required(subscriberId,'subscriberId')]);
      return rowToDelivery(result.rows[0]);
    },
    async listDeadLetters() {
      const result = await database.query("SELECT * FROM internal_event_deliveries WHERE status='dead-letter' ORDER BY updated_at DESC");
      return result.rows.map(rowToDelivery);
    },
    async requeueDeadLetter({ eventId, subscriberId, updatedAt }) {
      const result = await database.query(`UPDATE internal_event_deliveries SET status='pending',failure_code=NULL,next_attempt_at=$3,updated_at=$3 WHERE event_id=$1 AND subscriber_id=$2 AND status='dead-letter' RETURNING *`, [required(eventId,'eventId'), required(subscriberId,'subscriberId'), updatedAt]);
      return rowToDelivery(result.rows[0]);
    }
  });
}
