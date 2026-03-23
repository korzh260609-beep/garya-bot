// src/core/handleMessage/commandFlow/diagnostics/chatMessagesDiagQuery.js

import pool from "../../../../../db.js";

export async function queryChatMessagesDiag(chatIdStr) {
  const [
    totalChatMessagesRes,
    lastUserMessageRes,
    lastAssistantMessageRes,
    dedupeCountRes,
    lastDedupeEventRes,
  ] = await Promise.all([
    pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM chat_messages
      WHERE chat_id = $1
      `,
      [String(chatIdStr)]
    ),

    pool.query(
      `
      SELECT id, message_id, created_at, content
      FROM chat_messages
      WHERE chat_id = $1
        AND role = 'user'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      [String(chatIdStr)]
    ),

    pool.query(
      `
      SELECT
        id,
        created_at,
        content,
        metadata->>'longTermMemoryBridgePrepared' AS ltm_prepared,
        metadata->>'longTermMemoryBridgeOk' AS ltm_ok,
        metadata->>'longTermMemoryBridgeReason' AS ltm_reason,
        metadata->>'longTermMemoryInjected' AS ltm_injected
      FROM chat_messages
      WHERE chat_id = $1
        AND role = 'assistant'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      [String(chatIdStr)]
    ),

    pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM webhook_dedupe_events
      WHERE chat_id = $1
      `,
      [String(chatIdStr)]
    ),

    pool.query(
      `
      SELECT id, message_id, created_at, reason
      FROM webhook_dedupe_events
      WHERE chat_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      `,
      [String(chatIdStr)]
    ),
  ]);

  return {
    totalChatMessages: totalChatMessagesRes.rows?.[0]?.n ?? 0,
    totalDedupeEvents: dedupeCountRes.rows?.[0]?.n ?? 0,
    lastUser: lastUserMessageRes.rows?.[0] || null,
    lastAssistant: lastAssistantMessageRes.rows?.[0] || null,
    lastDedupe: lastDedupeEventRes.rows?.[0] || null,
  };
}