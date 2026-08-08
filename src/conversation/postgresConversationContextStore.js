function rowConversation(row) {
  if (!row) return null;
  return { conversationId: row.conversation_id, globalUserId: row.global_user_id, projectScope: row.project_scope, groupScope: row.group_scope, threadScope: row.thread_scope, state: row.state, continuationPolicy: row.continuation_policy, currentTopicId: row.current_topic_id, lastActivityAt: row.last_activity_at?.toISOString?.() ?? row.last_activity_at, closedAt: row.closed_at?.toISOString?.() ?? row.closed_at, metadata: row.metadata ?? {}, createdAt: row.created_at?.toISOString?.() ?? row.created_at, updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at };
}
function rowSession(row) {
  if (!row) return null;
  return { sessionId: row.session_id, conversationId: row.conversation_id, globalUserId: row.global_user_id, projectScope: row.project_scope, groupScope: row.group_scope, threadScope: row.thread_scope, transport: row.transport, transportSessionId: row.transport_session_id, state: row.state, startedAt: row.started_at?.toISOString?.() ?? row.started_at, lastActivityAt: row.last_activity_at?.toISOString?.() ?? row.last_activity_at, closedAt: row.closed_at?.toISOString?.() ?? row.closed_at, metadata: row.metadata ?? {} };
}
function rowTopic(row) {
  if (!row) return null;
  return { topicId: row.topic_id, conversationId: row.conversation_id, parentTopicId: row.parent_topic_id, topicKey: row.topic_key, state: row.state, startedAt: row.started_at?.toISOString?.() ?? row.started_at, closedAt: row.closed_at?.toISOString?.() ?? row.closed_at, metadata: row.metadata ?? {} };
}
function rowMessage(row) {
  if (!row) return null;
  return { messageId: row.message_id, conversationId: row.conversation_id, sessionId: row.session_id, topicId: row.topic_id, replyToMessageId: row.reply_to_message_id, transport: row.transport, externalMessageId: row.external_message_id, globalUserId: row.global_user_id, projectScope: row.project_scope, groupScope: row.group_scope, threadScope: row.thread_scope, direction: row.direction, content: row.content ?? {}, provenance: row.provenance ?? {}, createdAt: row.created_at?.toISOString?.() ?? row.created_at };
}

export function createPostgresConversationContextStore({ database } = {}) {
  if (!database?.query) throw new TypeError('database.query is required');
  return Object.freeze({
    async putConversation(record) {
      const r = await database.query(`INSERT INTO conversations(conversation_id,global_user_id,project_scope,group_scope,thread_scope,metadata,state,continuation_policy,current_topic_id,last_activity_at,closed_at,created_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT(conversation_id) DO UPDATE SET metadata=EXCLUDED.metadata,state=EXCLUDED.state,continuation_policy=EXCLUDED.continuation_policy,current_topic_id=EXCLUDED.current_topic_id,last_activity_at=EXCLUDED.last_activity_at,closed_at=EXCLUDED.closed_at,updated_at=EXCLUDED.updated_at
        WHERE conversations.global_user_id=EXCLUDED.global_user_id AND conversations.project_scope=EXCLUDED.project_scope AND conversations.group_scope IS NOT DISTINCT FROM EXCLUDED.group_scope AND conversations.thread_scope IS NOT DISTINCT FROM EXCLUDED.thread_scope RETURNING *`, [record.conversationId,record.globalUserId,record.projectScope,record.groupScope,record.threadScope,JSON.stringify(record.metadata ?? {}),record.state,record.continuationPolicy,record.currentTopicId,record.lastActivityAt,record.closedAt,record.createdAt,record.updatedAt]);
      if (!r.rows[0]) throw new Error('conversation scope mismatch');
      return rowConversation(r.rows[0]);
    },
    async getConversation(id) { return rowConversation((await database.query('SELECT * FROM conversations WHERE conversation_id=$1',[id])).rows[0]); },
    async findActiveConversation(scope) {
      const r = await database.query(`SELECT * FROM conversations WHERE global_user_id=$1 AND project_scope=$2 AND group_scope IS NOT DISTINCT FROM $3 AND thread_scope IS NOT DISTINCT FROM $4 AND state='active' ORDER BY last_activity_at DESC, conversation_id DESC LIMIT 1`, [scope.globalUserId,scope.projectScope,scope.groupScope,scope.threadScope]);
      return rowConversation(r.rows[0]);
    },
    async putSession(record) {
      const r = await database.query(`INSERT INTO conversation_sessions(session_id,conversation_id,global_user_id,project_scope,group_scope,thread_scope,transport,transport_session_id,state,started_at,last_activity_at,closed_at,metadata)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        ON CONFLICT(session_id) DO UPDATE SET state=EXCLUDED.state,last_activity_at=EXCLUDED.last_activity_at,closed_at=EXCLUDED.closed_at,metadata=EXCLUDED.metadata RETURNING *`, [record.sessionId,record.conversationId,record.globalUserId,record.projectScope,record.groupScope,record.threadScope,record.transport,record.transportSessionId,record.state,record.startedAt,record.lastActivityAt,record.closedAt,JSON.stringify(record.metadata ?? {})]);
      return rowSession(r.rows[0]);
    },
    async getSession(id) { return rowSession((await database.query('SELECT * FROM conversation_sessions WHERE session_id=$1',[id])).rows[0]); },
    async findActiveSession({ conversationId, transport, transportSessionId = null }) {
      const r = await database.query(`SELECT * FROM conversation_sessions WHERE conversation_id=$1 AND transport=$2 AND state='active' AND ($3::text IS NULL OR transport_session_id=$3) ORDER BY last_activity_at DESC, session_id DESC LIMIT 1`, [conversationId,transport,transportSessionId]);
      return rowSession(r.rows[0]);
    },
    async putTopic(record) {
      const r = await database.query(`INSERT INTO conversation_topics(topic_id,conversation_id,parent_topic_id,topic_key,state,started_at,closed_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        ON CONFLICT(topic_id) DO UPDATE SET parent_topic_id=EXCLUDED.parent_topic_id,topic_key=EXCLUDED.topic_key,state=EXCLUDED.state,closed_at=EXCLUDED.closed_at,metadata=EXCLUDED.metadata RETURNING *`, [record.topicId,record.conversationId,record.parentTopicId,record.topicKey,record.state,record.startedAt,record.closedAt,JSON.stringify(record.metadata ?? {})]);
      return rowTopic(r.rows[0]);
    },
    async getTopic(id) { return rowTopic((await database.query('SELECT * FROM conversation_topics WHERE topic_id=$1',[id])).rows[0]); },
    async putMessage(record) {
      if (record.transport && record.externalMessageId) {
        const existing = await this.getMessageByExternal({ transport: record.transport, externalMessageId: record.externalMessageId, scope: record });
        if (existing) return existing;
      }
      const r = await database.query(`INSERT INTO messages(message_id,conversation_id,global_user_id,project_scope,group_scope,thread_scope,direction,content,provenance,session_id,topic_id,reply_to_message_id,transport,external_message_id,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15) RETURNING *`, [record.messageId,record.conversationId,record.globalUserId,record.projectScope,record.groupScope,record.threadScope,record.direction,JSON.stringify(record.content ?? {}),JSON.stringify(record.provenance ?? {}),record.sessionId,record.topicId,record.replyToMessageId,record.transport,record.externalMessageId,record.createdAt]);
      return rowMessage(r.rows[0]);
    },
    async getMessageByExternal({ transport, externalMessageId, scope }) {
      const r = await database.query(`SELECT * FROM messages WHERE transport=$1 AND external_message_id=$2 AND global_user_id=$3 AND project_scope=$4 AND group_scope IS NOT DISTINCT FROM $5 AND thread_scope IS NOT DISTINCT FROM $6 ORDER BY created_at DESC LIMIT 1`, [transport,externalMessageId,scope.globalUserId,scope.projectScope,scope.groupScope,scope.threadScope]);
      return rowMessage(r.rows[0]);
    },
    async listRecentMessages({ conversationId, topicId = null, limit = 12 }) {
      const r = await database.query(`SELECT * FROM (SELECT * FROM messages WHERE conversation_id=$1 AND ($2::text IS NULL OR topic_id=$2) ORDER BY created_at DESC,message_id DESC LIMIT $3) q ORDER BY created_at,message_id`, [conversationId,topicId,limit]);
      return r.rows.map(rowMessage);
    }
  });
}
