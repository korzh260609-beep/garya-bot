// src/core/memoryAdapters/chatMemoryAdapter.js
// STAGE 7 — MEMORY LAYER V1 (ADAPTER)
// Цель: прямой доступ к chat_memory через adapter (без legacy src/memory/chatMemory.js)
// RULE: handlers -> MemoryService -> Adapter -> DB
//
// Поддержка v2 колонок (если существуют):
// - global_user_id (text)
// - transport (text)
// - metadata (jsonb)
// - schema_version (int)
//
// Fail-safe: если v2 колонок нет — пишем/читаем по старой схеме (chat_id, role, content).

import pool from "../../../db.js";

const DEFAULT_TRANSPORT = "telegram";
const DEFAULT_SCHEMA_VERSION = 1;

// -------- schema detection (safe) --------
const _colCache = new Map(); // "table.column" -> boolean

async function _columnExists(table, column) {
  const key = `${table}.${column}`;
  if (_colCache.has(key)) return _colCache.get(key);

  try {
    const r = await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name=$1
        AND column_name=$2
      LIMIT 1
      `,
      [table, column]
    );
    const ok = (r.rows?.length || 0) > 0;
    _colCache.set(key, ok);
    return ok;
  } catch (_) {
    _colCache.set(key, false);
    return false;
  }
}

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _safeObj(o) {
  try {
    if (!o) return {};
    if (typeof o === "object") return o;
    return { value: String(o) };
  } catch (_) {
    return {};
  }
}

function _toIntOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? Math.floor(n) : null;
}

function _normalizeChatType(value) {
  const v = _safeStr(value).trim().toLowerCase();
  if (!v) return "unknown";
  return v;
}

function _isSharedChatType(chatType) {
  const v = _normalizeChatType(chatType);
  return v === "group" || v === "supergroup";
}

function _buildAuthorLabel(metadata = {}) {
  const meta = _safeObj(metadata);

  const assistantLabel = _safeStr(meta.assistantLabel).trim();
  if (assistantLabel) return assistantLabel;

  const senderName = _safeStr(meta.senderName).trim();
  if (senderName) return senderName;

  const firstName = _safeStr(meta.senderFirstName).trim();
  const lastName = _safeStr(meta.senderLastName).trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;

  const username = _safeStr(meta.senderUsername).trim();
  if (username) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  const senderId = _safeStr(meta.senderIdStr).trim();
  if (senderId) return `user:${senderId}`;

  return "unknown_user";
}

function _buildAssistantOnlyMeta(metadata = {}) {
  const meta = _safeObj(metadata);

  return {
    chatIdStr: _safeStr(meta.chatIdStr),
    messageId: meta.messageId ?? null,
    chatType: _safeStr(meta.chatType) || "unknown",
    assistantLabel: _safeStr(meta.assistantLabel).trim() || "sg_assistant",
  };
}

function _decorateHistoryRow({ role, content, metadata = {}, chatType = "unknown" }) {
  const roleStr = _safeStr(role).trim() || "user";
  const text = typeof content === "string" ? content : _safeStr(content);
  const normalizedChatType = _normalizeChatType(chatType);
  const meta = _safeObj(metadata);

  if (!_isSharedChatType(normalizedChatType)) {
    return {
      role: roleStr,
      content: text,
    };
  }

  if (roleStr === "user") {
    const authorLabel = _buildAuthorLabel(meta);
    return {
      role: roleStr,
      content: `[group user: ${authorLabel}] ${text}`,
    };
  }

  if (roleStr === "assistant") {
    const assistantLabel = _safeStr(meta.assistantLabel).trim() || "sg_assistant";
    return {
      role: roleStr,
      content: `[${assistantLabel}] ${text}`,
    };
  }

  return {
    role: roleStr,
    content: text,
  };
}

async function _withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw e;
  } finally {
    try {
      client.release();
    } catch (_) {}
  }
}

export class ChatMemoryAdapter {
  constructor({ logger = null, config = {} } = {}) {
    this.logger = logger;
    this.config = config;
  }

  // ========================================================================
  // read
  // ========================================================================
  async getChatHistory({ chatId, limit, globalUserId = null, chatType = null } = {}) {
    const chatIdStr = _safeStr(chatId);
    const lim = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(limit)) : 20;
    const normalizedChatType = _normalizeChatType(chatType);

    if (!chatIdStr) return [];

    const hasGlobal = await _columnExists("chat_memory", "global_user_id");
    const hasMeta = await _columnExists("chat_memory", "metadata");

    try {
      const useSharedChatHistory = _isSharedChatType(normalizedChatType);

      // identity-first only for private/unknown chats
      if (hasGlobal && globalUserId && !useSharedChatHistory) {
        const r = await pool.query(
          `
          SELECT role, content, ${hasMeta ? "metadata" : "'{}'::jsonb AS metadata"}
          FROM chat_memory
          WHERE chat_id = $1
            AND global_user_id = $2
          ORDER BY id DESC
          LIMIT $3
          `,
          [chatIdStr, _safeStr(globalUserId), lim]
        );

        const rows = (r.rows || []).reverse().map((row) =>
          _decorateHistoryRow({
            role: row.role,
            content: row.content,
            metadata: row.metadata || {},
            chatType: normalizedChatType,
          })
        );

        if (rows.length) return rows;
        // fallback below if empty
      }

      // shared/group read OR legacy fallback
      const r2 = await pool.query(
        `
        SELECT role, content, ${hasMeta ? "metadata" : "'{}'::jsonb AS metadata"}
        FROM chat_memory
        WHERE chat_id = $1
        ORDER BY id DESC
        LIMIT $2
        `,
        [chatIdStr, lim]
      );

      return (r2.rows || []).reverse().map((row) =>
        _decorateHistoryRow({
          role: row.role,
          content: row.content,
          metadata: row.metadata || {},
          chatType: normalizedChatType,
        })
      );
    } catch (e) {
      if (this.logger?.error) {
        this.logger.error("ChatMemoryAdapter.getChatHistory error", e?.message || e);
      }
      return [];
    }
  }

  // ========================================================================
  // write one message
  // ========================================================================
  async saveMessage({ chatId, role, content, globalUserId = null, options = {} } = {}) {
    const chatIdStr = _safeStr(chatId);
    const roleStr = _safeStr(role);
    const text = typeof content === "string" ? content : _safeStr(content);

    if (!chatIdStr) return { ok: false, reason: "missing_chatId" };
    if (!roleStr) return { ok: false, reason: "missing_role" };
    if (!text) return { ok: false, reason: "empty_content" };

    const transport = _safeStr(options?.transport || DEFAULT_TRANSPORT) || DEFAULT_TRANSPORT;
    const metadata = _safeObj(options?.metadata);
    const schemaVersion =
      Number.isFinite(Number(options?.schemaVersion)) && Number(options.schemaVersion) > 0
        ? Math.floor(Number(options.schemaVersion))
        : DEFAULT_SCHEMA_VERSION;

    // detect v2 columns
    const hasGlobal = await _columnExists("chat_memory", "global_user_id");
    const hasTransport = await _columnExists("chat_memory", "transport");
    const hasMeta = await _columnExists("chat_memory", "metadata");
    const hasSv = await _columnExists("chat_memory", "schema_version");

    const messageId = _toIntOrNull(metadata?.messageId);

    try {
      // Strong anti-dup only if messageId exists AND metadata column exists
      if (messageId !== null && hasMeta) {
        const identityKey = hasGlobal && globalUserId ? _safeStr(globalUserId) : chatIdStr;
        const lockKey = `cm:${transport}:${identityKey}:${roleStr}:${String(messageId)}`;

        await _withTx(async (client) => {
          await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [lockKey]);

          const exists = await client.query(
            `
            SELECT id
            FROM chat_memory
            WHERE chat_id = $1
              AND role = $2
              AND content = $3
              ${hasGlobal ? "AND ($4::text IS NULL OR global_user_id = $4)" : ""}
              ${hasTransport ? "AND transport = $5" : ""}
              AND (metadata->>'messageId') = $6
            ORDER BY id DESC
            LIMIT 1
            `,
            [
              chatIdStr,
              roleStr,
              text,
              hasGlobal ? (globalUserId ? _safeStr(globalUserId) : null) : undefined,
              hasTransport ? transport : undefined,
              String(messageId),
            ].filter((v) => v !== undefined)
          );

          if ((exists.rows || []).length) return;

          if (hasGlobal || hasTransport || hasMeta || hasSv) {
            const cols = ["chat_id", "role", "content"];
            const vals = [chatIdStr, roleStr, text];

            if (hasGlobal) {
              cols.push("global_user_id");
              vals.push(globalUserId ? _safeStr(globalUserId) : null);
            }
            if (hasTransport) {
              cols.push("transport");
              vals.push(transport);
            }
            if (hasMeta) {
              cols.push("metadata");
              vals.push(JSON.stringify(metadata));
            }
            if (hasSv) {
              cols.push("schema_version");
              vals.push(schemaVersion);
            }

            const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
            await client.query(
              `INSERT INTO chat_memory (${cols.join(", ")}) VALUES (${placeholders})`,
              vals
            );
            return;
          }

          await client.query(
            `INSERT INTO chat_memory (chat_id, role, content) VALUES ($1, $2, $3)`,
            [chatIdStr, roleStr, text]
          );
        });

        return { ok: true };
      }

      if (hasGlobal || hasTransport || hasMeta || hasSv) {
        const cols = ["chat_id", "role", "content"];
        const vals = [chatIdStr, roleStr, text];

        if (hasGlobal) {
          cols.push("global_user_id");
          vals.push(globalUserId ? _safeStr(globalUserId) : null);
        }
        if (hasTransport) {
          cols.push("transport");
          vals.push(transport);
        }
        if (hasMeta) {
          cols.push("metadata");
          vals.push(JSON.stringify(metadata));
        }
        if (hasSv) {
          cols.push("schema_version");
          vals.push(schemaVersion);
        }

        const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
        await pool.query(
          `INSERT INTO chat_memory (${cols.join(", ")}) VALUES (${placeholders})`,
          vals
        );

        return { ok: true };
      }

      await pool.query(`INSERT INTO chat_memory (chat_id, role, content) VALUES ($1, $2, $3)`, [
        chatIdStr,
        roleStr,
        text,
      ]);

      return { ok: true };
    } catch (e) {
      if (this.logger?.error) {
        this.logger.error("ChatMemoryAdapter.saveMessage error", e?.message || e);
      }
      return { ok: false, reason: "db_error" };
    }
  }

  // ========================================================================
  // write pair
  // ========================================================================
  async savePair({ chatId, userText, assistantText, globalUserId = null, options = {} } = {}) {
    const chatIdStr = _safeStr(chatId);
    if (!chatIdStr) return { ok: false, reason: "missing_chatId" };

    const baseOptions = _safeObj(options);
    const userMetadata = _safeObj(baseOptions?.metadata);
    const assistantMetadata = _buildAssistantOnlyMeta(userMetadata);

    const userOptions = {
      ...baseOptions,
      metadata: userMetadata,
    };

    const assistantOptions = {
      ...baseOptions,
      metadata: assistantMetadata,
    };

    await this.saveMessage({
      chatId: chatIdStr,
      role: "user",
      content: typeof userText === "string" ? userText : _safeStr(userText),
      globalUserId,
      options: userOptions,
    });

    await this.saveMessage({
      chatId: chatIdStr,
      role: "assistant",
      content: typeof assistantText === "string" ? assistantText : _safeStr(assistantText),
      globalUserId,
      options: assistantOptions,
    });

    return { ok: true };
  }
}

export default ChatMemoryAdapter;