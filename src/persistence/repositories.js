function required(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function scopeValues(scope = {}) {
  return [required(scope.globalUserId, 'scope.globalUserId'), required(scope.projectScope, 'scope.projectScope'), scope.groupScope ?? null, scope.threadScope ?? null];
}

export function createPostgresRepositories(database) {
  const users = Object.freeze({
    async upsert({ globalUserId, profile = {} }, db = database) {
      const result = await db.query(`INSERT INTO users(global_user_id, profile) VALUES ($1,$2::jsonb)
        ON CONFLICT(global_user_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = now() RETURNING *`, [required(globalUserId, 'globalUserId'), JSON.stringify(profile)]);
      return result.rows[0];
    },
    async get(globalUserId, db = database) {
      const result = await db.query('SELECT * FROM users WHERE global_user_id = $1', [required(globalUserId, 'globalUserId')]);
      return result.rows[0] ?? null;
    }
  });

  const identities = Object.freeze({
    async link({ platform, platformUserId, globalUserId, metadata = {} }, db = database) {
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO identity_links(platform, platform_user_id, global_user_id, metadata)
        VALUES ($1,$2,$3,$4::jsonb)
        ON CONFLICT(platform, platform_user_id) DO UPDATE SET metadata = EXCLUDED.metadata
        WHERE identity_links.global_user_id = EXCLUDED.global_user_id
        RETURNING *`, [required(platform, 'platform'), required(platformUserId, 'platformUserId'), required(globalUserId, 'globalUserId'), JSON.stringify(metadata)]);
      if (result.rowCount === 0) throw new Error('identity link already belongs to another global user');
      return result.rows[0];
    },
    async resolve(platform, platformUserId, db = database) {
      const result = await db.query('SELECT * FROM identity_links WHERE platform = $1 AND platform_user_id = $2', [required(platform, 'platform'), required(platformUserId, 'platformUserId')]);
      return result.rows[0] ?? null;
    }
  });

  const access = Object.freeze({
    async grantRole({ globalUserId, projectScope, role }, db = database) {
      await users.upsert({ globalUserId }, db);
      await db.query('INSERT INTO roles(global_user_id, project_scope, role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [globalUserId, projectScope, role]);
    },
    async grantPermission({ globalUserId, projectScope, grantName, constraints = {} }, db = database) {
      await users.upsert({ globalUserId }, db);
      await db.query(`INSERT INTO grants(global_user_id, project_scope, grant_name, constraints) VALUES ($1,$2,$3,$4::jsonb)
        ON CONFLICT(global_user_id, project_scope, grant_name) DO UPDATE SET constraints = EXCLUDED.constraints`, [globalUserId, projectScope, grantName, JSON.stringify(constraints)]);
    },
    async list({ globalUserId, projectScope }, db = database) {
      const [rolesResult, grantsResult] = await Promise.all([
        db.query('SELECT role FROM roles WHERE global_user_id=$1 AND project_scope=$2 ORDER BY role', [globalUserId, projectScope]),
        db.query('SELECT grant_name, constraints FROM grants WHERE global_user_id=$1 AND project_scope=$2 ORDER BY grant_name', [globalUserId, projectScope])
      ]);
      return { roles: rolesResult.rows.map((row) => row.role), grants: grantsResult.rows };
    }
  });

  const conversations = Object.freeze({
    async upsert({ conversationId, scope, metadata = {} }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO conversations(conversation_id, global_user_id, project_scope, group_scope, thread_scope, metadata)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb)
        ON CONFLICT(conversation_id) DO UPDATE SET metadata=EXCLUDED.metadata, updated_at=now()
        WHERE conversations.global_user_id=EXCLUDED.global_user_id AND conversations.project_scope=EXCLUDED.project_scope
          AND conversations.group_scope IS NOT DISTINCT FROM EXCLUDED.group_scope AND conversations.thread_scope IS NOT DISTINCT FROM EXCLUDED.thread_scope
        RETURNING *`, [conversationId, globalUserId, projectScope, groupScope, threadScope, JSON.stringify(metadata)]);
      if (result.rowCount === 0) throw new Error('conversation scope mismatch');
      return result.rows[0];
    },
    async appendMessage({ messageId, conversationId, scope, direction, content, provenance = {} }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      const result = await db.query(`INSERT INTO messages(message_id, conversation_id, global_user_id, project_scope, group_scope, thread_scope, direction, content, provenance)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb FROM conversations c
        WHERE c.conversation_id=$2 AND c.global_user_id=$3 AND c.project_scope=$4
          AND c.group_scope IS NOT DISTINCT FROM $5 AND c.thread_scope IS NOT DISTINCT FROM $6 RETURNING *`,
      [messageId, conversationId, globalUserId, projectScope, groupScope, threadScope, direction, JSON.stringify(content), JSON.stringify(provenance)]);
      if (result.rowCount === 0) throw new Error('conversation scope mismatch');
      return result.rows[0];
    },
    async listMessages({ conversationId, scope, limit = 100 }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      const result = await db.query(`SELECT * FROM messages WHERE conversation_id=$1 AND global_user_id=$2 AND project_scope=$3
        AND group_scope IS NOT DISTINCT FROM $4 AND thread_scope IS NOT DISTINCT FROM $5 ORDER BY created_at, message_id LIMIT $6`, [conversationId, globalUserId, projectScope, groupScope, threadScope, limit]);
      return result.rows;
    }
  });

  const memory = Object.freeze({
    async put({ memoryId, scope, layer, key, value, provenance, confidence = null, expiresAt = null }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO memory_records(memory_id, global_user_id, project_scope, group_scope, thread_scope, memory_layer, memory_key, value, provenance, confidence, expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)
        ON CONFLICT(global_user_id, project_scope, group_scope, thread_scope, memory_layer, memory_key)
        DO UPDATE SET value=EXCLUDED.value, provenance=EXCLUDED.provenance, confidence=EXCLUDED.confidence, expires_at=EXCLUDED.expires_at, updated_at=now() RETURNING *`,
      [memoryId, globalUserId, projectScope, groupScope, threadScope, layer, key, JSON.stringify(value), JSON.stringify(provenance), confidence, expiresAt]);
      return result.rows[0];
    },
    async list({ scope, layer }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      const result = await db.query(`SELECT * FROM memory_records WHERE global_user_id=$1 AND project_scope=$2
        AND group_scope IS NOT DISTINCT FROM $3 AND thread_scope IS NOT DISTINCT FROM $4 AND memory_layer=$5
        AND (expires_at IS NULL OR expires_at > now()) ORDER BY updated_at DESC`, [globalUserId, projectScope, groupScope, threadScope, layer]);
      return result.rows;
    }
  });

  const automation = Object.freeze({
    async putTask({ taskId, scope, status, payload, approvalState = {} }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO tasks(task_id, global_user_id, project_scope, group_scope, thread_scope, status, payload, approval_state)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)
        ON CONFLICT(task_id) DO UPDATE SET status=EXCLUDED.status,payload=EXCLUDED.payload,approval_state=EXCLUDED.approval_state,updated_at=now()
        WHERE tasks.global_user_id=EXCLUDED.global_user_id AND tasks.project_scope=EXCLUDED.project_scope RETURNING *`,
      [taskId, globalUserId, projectScope, groupScope, threadScope, status, JSON.stringify(payload), JSON.stringify(approvalState)]);
      if (result.rowCount === 0) throw new Error('task scope mismatch');
      return result.rows[0];
    },
    async putSchedule({ scheduleId, taskId, dueAt = null, recurrence = null, state = {} }, db = database) {
      const result = await db.query(`INSERT INTO schedules(schedule_id, task_id, due_at, recurrence, state) VALUES ($1,$2,$3,$4,$5::jsonb)
        ON CONFLICT(schedule_id) DO UPDATE SET due_at=EXCLUDED.due_at, recurrence=EXCLUDED.recurrence, state=EXCLUDED.state, updated_at=now() RETURNING *`, [scheduleId, taskId, dueAt, recurrence, JSON.stringify(state)]);
      return result.rows[0];
    },
    async putExecution({ executionId, taskId = null, status, attempt = 0, state = {}, error = null }, db = database) {
      const result = await db.query(`INSERT INTO execution_states(execution_id, task_id, status, attempt, state, error, started_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,now())
        ON CONFLICT(execution_id) DO UPDATE SET status=EXCLUDED.status,attempt=EXCLUDED.attempt,state=EXCLUDED.state,error=EXCLUDED.error,updated_at=now() RETURNING *`,
      [executionId, taskId, status, attempt, JSON.stringify(state), error === null ? null : JSON.stringify(error)]);
      return result.rows[0];
    }
  });

  const idempotency = Object.freeze({
    async reserve({ key, scope, actionFingerprint, expiresAt = null }, db = database) {
      const [globalUserId, projectScope] = scopeValues(scope);
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO idempotency_records(idempotency_key,global_user_id,project_scope,action_fingerprint,status,expires_at)
        VALUES ($1,$2,$3,$4,'reserved',$5) ON CONFLICT DO NOTHING RETURNING *`, [key, globalUserId, projectScope, actionFingerprint, expiresAt]);
      return result.rows[0] ?? null;
    },
    async complete({ key, result }, db = database) {
      const updated = await db.query(`UPDATE idempotency_records SET status='completed',result=$2::jsonb,updated_at=now() WHERE idempotency_key=$1 RETURNING *`, [key, JSON.stringify(result)]);
      return updated.rows[0] ?? null;
    }
  });

  const observability = Object.freeze({
    async record(event, db = database) {
      const result = await db.query(`INSERT INTO observability_events(channel,event_class,trace_id,request_id,global_user_id,project_scope,stage,outcome,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`, [event.channel, event.eventClass, event.traceId ?? null, event.requestId ?? null, event.globalUserId ?? null, event.projectScope ?? null, event.stage ?? null, event.outcome ?? null, JSON.stringify(event.payload ?? {})]);
      return result.rows[0];
    }
  });

  const domains = Object.freeze({
    async put({ domainId, recordId, scope, payload }, db = database) {
      const [globalUserId, projectScope, groupScope, threadScope] = scopeValues(scope);
      await users.upsert({ globalUserId }, db);
      const result = await db.query(`INSERT INTO domain_records(domain_id,record_id,global_user_id,project_scope,group_scope,thread_scope,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
        ON CONFLICT(domain_id,record_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()
        WHERE domain_records.global_user_id=EXCLUDED.global_user_id AND domain_records.project_scope=EXCLUDED.project_scope
          AND domain_records.group_scope IS NOT DISTINCT FROM EXCLUDED.group_scope AND domain_records.thread_scope IS NOT DISTINCT FROM EXCLUDED.thread_scope RETURNING *`,
      [domainId, recordId, globalUserId, projectScope, groupScope, threadScope, JSON.stringify(payload)]);
      if (result.rowCount === 0) throw new Error('domain record scope mismatch');
      return result.rows[0];
    }
  });

  async function protectedTransaction(work) {
    return database.transaction(async (tx) => work(Object.freeze({ users, identities, access, conversations, memory, automation, idempotency, observability, domains }), tx));
  }

  return Object.freeze({ users, identities, access, conversations, memory, automation, idempotency, observability, domains, protectedTransaction });
}
