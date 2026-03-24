// src/core/memory/MemoryLongTermReadService.js
// STAGE 11.x — extracted read-only long-term retrieval
//
// Goal:
// - move read-only long-term methods out of MemoryService
// - keep deterministic retrieval only
// - no AI
// - no schema changes
// - fail-open
//
// IMPORTANT:
// - this service is READ-ONLY
// - write / writePair / remember stay in MemoryService
// - MemoryService remains facade/orchestrator

function _safeStr(x) {
  if (typeof x === "string") return x;
  if (x === null || x === undefined) return "";
  return String(x);
}

function _normalizeLimit(value, fallback = 20, min = 1, max = 200) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _extractRememberValue(content) {
  const text = _safeStr(content).trim();
  const m = /^\[MEMORY:[^\]]+\]\s*(.+)$/s.exec(text);
  if (m && m[1]) return String(m[1]).trim();
  return text;
}

function _normalizeStrList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();

  for (const item of value) {
    const s = _safeStr(item).trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }

  return out;
}

function _normalizeLongTermRow(row = {}) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};

  return {
    id: row?.id ?? null,
    chatId: row?.chat_id ? String(row.chat_id) : null,
    globalUserId: row?.global_user_id ? String(row.global_user_id) : null,
    transport: row?.transport ? String(row.transport) : null,
    role: row?.role ? String(row.role) : null,
    schemaVersion: row?.schema_version ?? null,
    createdAt: row?.created_at ? new Date(row.created_at).toISOString() : null,
    content: _safeStr(row?.content),
    value: _extractRememberValue(row?.content),
    metadata,
    memoryType: _safeStr(metadata?.memoryType).trim() || null,
    rememberKey: _safeStr(metadata?.rememberKey).trim() || null,
    rememberType: _safeStr(metadata?.rememberType).trim() || null,
    rememberDomain: _safeStr(metadata?.rememberDomain).trim() || null,
    rememberSlot: _safeStr(metadata?.rememberSlot).trim() || null,
    rememberCanonicalKey: _safeStr(metadata?.rememberCanonicalKey).trim() || null,
    explicit:
      metadata?.explicit === true ||
      String(metadata?.explicit || "").trim() === "true",
    source: _safeStr(metadata?.source).trim() || null,
  };
}

export class MemoryLongTermReadService {
  constructor({
    db = null,
    logger = console,
    getEnabled = () => false,
    contractVersion = 1,
  } = {}) {
    this.db = db || null;
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.contractVersion = contractVersion;
  }

  _baseDisabledResult(chatIdStr, globalUserId, extra = {}) {
    const enabled = !!this.getEnabled();

    return {
      ok: true,
      enabled,
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      items: [],
      total: 0,
      backend: "chat_memory",
      contractVersion: this.contractVersion,
      reason: !enabled ? "memory_disabled" : "missing_chatId",
      ...extra,
    };
  }

  _baseDbUnavailableResult(chatIdStr, globalUserId, extra = {}) {
    return {
      ok: false,
      enabled: !!this.getEnabled(),
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      items: [],
      total: 0,
      backend: "chat_memory",
      contractVersion: this.contractVersion,
      reason: "db_unavailable",
      ...extra,
    };
  }

  async getLongTermByType({
    globalUserId = null,
    chatId = null,
    rememberType,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberTypeStr = _safeStr(rememberType).trim();
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);

    if (!rememberTypeStr) {
      return {
        ok: false,
        reason: "missing_rememberType",
        items: [],
      };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseDisabledResult(chatIdStr, globalUserId, {
        rememberType: rememberTypeStr,
      });
    }

    if (!this.db) {
      return this._baseDbUnavailableResult(chatIdStr, globalUserId, {
        rememberType: rememberTypeStr,
      });
    }

    try {
      const params = [chatIdStr, rememberTypeStr];
      let idx = 3;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          content,
          schema_version,
          created_at,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberType', '') = $2
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const rows = (res.rows || []).map(_normalizeLongTermRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberType: rememberTypeStr,
        items: rows,
        total: rows.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermByType failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberType: rememberTypeStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberType: rememberTypeStr,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_by_type_failed",
        error: e?.message || String(e),
      };
    }
  }

  async getLongTermByKey({
    globalUserId = null,
    chatId = null,
    rememberKey,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberKeyStr = _safeStr(rememberKey).trim();
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);

    if (!rememberKeyStr) {
      return {
        ok: false,
        reason: "missing_rememberKey",
        items: [],
      };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseDisabledResult(chatIdStr, globalUserId, {
        rememberKey: rememberKeyStr,
      });
    }

    if (!this.db) {
      return this._baseDbUnavailableResult(chatIdStr, globalUserId, {
        rememberKey: rememberKeyStr,
      });
    }

    try {
      const params = [chatIdStr, rememberKeyStr];
      let idx = 3;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          content,
          schema_version,
          created_at,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberKey', '') = $2
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const rows = (res.rows || []).map(_normalizeLongTermRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: rows,
        total: rows.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermByKey failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberKey: rememberKeyStr,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_by_key_failed",
        error: e?.message || String(e),
      };
    }
  }

  async getLongTermByDomain({
    globalUserId = null,
    chatId = null,
    rememberDomain,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberDomainStr = _safeStr(rememberDomain).trim();
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);

    if (!rememberDomainStr) {
      return {
        ok: false,
        reason: "missing_rememberDomain",
        items: [],
      };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseDisabledResult(chatIdStr, globalUserId, {
        rememberDomain: rememberDomainStr,
      });
    }

    if (!this.db) {
      return this._baseDbUnavailableResult(chatIdStr, globalUserId, {
        rememberDomain: rememberDomainStr,
      });
    }

    try {
      const params = [chatIdStr, rememberDomainStr];
      let idx = 3;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          content,
          schema_version,
          created_at,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberDomain', '') = $2
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const rows = (res.rows || []).map(_normalizeLongTermRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        items: rows,
        total: rows.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermByDomain failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_by_domain_failed",
        error: e?.message || String(e),
      };
    }
  }

  async getLongTermBySlot({
    globalUserId = null,
    chatId = null,
    rememberSlot,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberSlotStr = _safeStr(rememberSlot).trim();
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);

    if (!rememberSlotStr) {
      return {
        ok: false,
        reason: "missing_rememberSlot",
        items: [],
      };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseDisabledResult(chatIdStr, globalUserId, {
        rememberSlot: rememberSlotStr,
      });
    }

    if (!this.db) {
      return this._baseDbUnavailableResult(chatIdStr, globalUserId, {
        rememberSlot: rememberSlotStr,
      });
    }

    try {
      const params = [chatIdStr, rememberSlotStr];
      let idx = 3;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          content,
          schema_version,
          created_at,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberSlot', '') = $2
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const rows = (res.rows || []).map(_normalizeLongTermRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberSlot: rememberSlotStr,
        items: rows,
        total: rows.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermBySlot failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberSlot: rememberSlotStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberSlot: rememberSlotStr,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_by_slot_failed",
        error: e?.message || String(e),
      };
    }
  }

  async getLongTermByDomainSlot({
    globalUserId = null,
    chatId = null,
    rememberDomain,
    rememberSlot,
    limit = 20,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const rememberDomainStr = _safeStr(rememberDomain).trim();
    const rememberSlotStr = _safeStr(rememberSlot).trim();
    const safeLimit = _normalizeLimit(limit, 20, 1, 200);

    if (!rememberDomainStr || !rememberSlotStr) {
      return {
        ok: false,
        reason: "missing_rememberDomain_or_rememberSlot",
        items: [],
      };
    }

    if (!this.getEnabled() || !chatIdStr) {
      return this._baseDisabledResult(chatIdStr, globalUserId, {
        rememberDomain: rememberDomainStr,
        rememberSlot: rememberSlotStr,
      });
    }

    if (!this.db) {
      return this._baseDbUnavailableResult(chatIdStr, globalUserId, {
        rememberDomain: rememberDomainStr,
        rememberSlot: rememberSlotStr,
      });
    }

    try {
      const params = [chatIdStr, rememberDomainStr, rememberSlotStr];
      let idx = 4;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      params.push(safeLimit);

      const res = await this.db.query(
        `
        SELECT
          id,
          chat_id,
          global_user_id,
          transport,
          role,
          content,
          schema_version,
          created_at,
          metadata
        FROM chat_memory
        WHERE chat_id = $1
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND COALESCE(metadata->>'rememberDomain', '') = $2
          AND COALESCE(metadata->>'rememberSlot', '') = $3
          ${globalUserSql}
        ORDER BY id DESC
        LIMIT $${idx}
        `,
        params
      );

      const rows = (res.rows || []).map(_normalizeLongTermRow);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        rememberSlot: rememberSlotStr,
        items: rows,
        total: rows.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermByDomainSlot failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        rememberSlot: rememberSlotStr,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberDomain: rememberDomainStr,
        rememberSlot: rememberSlotStr,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_by_domain_slot_failed",
        error: e?.message || String(e),
      };
    }
  }

  async getLongTermSummary({
    globalUserId = null,
    chatId = null,
    limit = 100,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const safeLimit = _normalizeLimit(limit, 100, 1, 500);

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        byType: [],
        byKeyType: [],
        byDomain: [],
        byDomainSlot: [],
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      };
    }

    if (!this.db) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        byType: [],
        byKeyType: [],
        byDomain: [],
        byDomainSlot: [],
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "db_unavailable",
      };
    }

    try {
      const params = [chatIdStr];
      let idx = 2;

      let globalUserSql = "";
      if (globalUserId) {
        globalUserSql = ` AND global_user_id = $${idx} `;
        params.push(String(globalUserId));
        idx += 1;
      }

      const byTypeRes = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberType', ''), '—') AS remember_type,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1
        ORDER BY total DESC, remember_type ASC
        `,
        params
      );

      const byKeyTypeRes = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberKey', ''), '—') AS remember_key,
          COALESCE(NULLIF(metadata->>'rememberType', ''), '—') AS remember_type,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1, 2
        ORDER BY total DESC, remember_type ASC, remember_key ASC
        LIMIT ${safeLimit}
        `
      );

      const byDomainRes = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberDomain', ''), '—') AS remember_domain,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1
        ORDER BY total DESC, remember_domain ASC
        LIMIT ${safeLimit}
        `,
        params
      );

      const byDomainSlotRes = await this.db.query(
        `
        SELECT
          COALESCE(NULLIF(metadata->>'rememberDomain', ''), '—') AS remember_domain,
          COALESCE(NULLIF(metadata->>'rememberSlot', ''), '—') AS remember_slot,
          COUNT(*)::int AS total
        FROM chat_memory
        WHERE chat_id = $1
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
        GROUP BY 1, 2
        ORDER BY total DESC, remember_domain ASC, remember_slot ASC
        LIMIT ${safeLimit}
        `,
        params
      );

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        byType: byTypeRes.rows || [],
        byKeyType: byKeyTypeRes.rows || [],
        byDomain: byDomainRes.rows || [],
        byDomainSlot: byDomainSlotRes.rows || [],
        backend: "chat_memory",
        contractVersion: this.contractVersion,
      };
    } catch (e) {
      this.logger.error("getLongTermSummary failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        byType: [],
        byKeyType: [],
        byDomain: [],
        byDomainSlot: [],
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "get_long_term_summary_failed",
        error: e?.message || String(e),
      };
    }
  }

  async selectLongTermContext({
    globalUserId = null,
    chatId = null,
    rememberTypes = [],
    rememberKeys = [],
    rememberDomains = [],
    rememberSlots = [],
    domainSlots = [],
    perTypeLimit = 3,
    perKeyLimit = 3,
    perDomainLimit = 3,
    perSlotLimit = 3,
    perDomainSlotLimit = 3,
    totalLimit = 12,
  } = {}) {
    const chatIdStr = chatId ? String(chatId) : null;
    const typeList = _normalizeStrList(rememberTypes);
    const keyList = _normalizeStrList(rememberKeys);
    const domainList = _normalizeStrList(rememberDomains);
    const slotList = _normalizeStrList(rememberSlots);
    const domainSlotList = Array.isArray(domainSlots)
      ? domainSlots
          .map((item) => ({
            rememberDomain: _safeStr(item?.rememberDomain).trim(),
            rememberSlot: _safeStr(item?.rememberSlot).trim(),
          }))
          .filter((item) => item.rememberDomain && item.rememberSlot)
      : [];

    const safePerTypeLimit = _normalizeLimit(perTypeLimit, 3, 1, 50);
    const safePerKeyLimit = _normalizeLimit(perKeyLimit, 3, 1, 50);
    const safePerDomainLimit = _normalizeLimit(perDomainLimit, 3, 1, 50);
    const safePerSlotLimit = _normalizeLimit(perSlotLimit, 3, 1, 50);
    const safePerDomainSlotLimit = _normalizeLimit(perDomainSlotLimit, 3, 1, 50);
    const safeTotalLimit = _normalizeLimit(totalLimit, 12, 1, 100);

    if (!this.getEnabled() || !chatIdStr) {
      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: !this.getEnabled() ? "memory_disabled" : "missing_chatId",
      };
    }

    if (
      typeList.length === 0 &&
      keyList.length === 0 &&
      domainList.length === 0 &&
      slotList.length === 0 &&
      domainSlotList.length === 0
    ) {
      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "empty_selector",
      };
    }

    try {
      const collected = [];
      const seenIds = new Set();

      const addItems = (items = [], fallbackPrefix = "fallback") => {
        for (const item of items) {
          const idKey = item?.id ?? null;
          const dedupeKey =
            idKey !== null
              ? `id:${idKey}`
              : `${fallbackPrefix}:${item?.rememberKey || ""}:${item?.rememberType || ""}:${item?.rememberDomain || ""}:${item?.rememberSlot || ""}:${item?.createdAt || ""}:${item?.value || ""}`;
          if (seenIds.has(dedupeKey)) continue;
          seenIds.add(dedupeKey);
          collected.push(item);
        }
      };

      for (const rememberType of typeList) {
        const res = await this.getLongTermByType({
          chatId: chatIdStr,
          globalUserId,
          rememberType,
          limit: safePerTypeLimit,
        });
        if (res?.ok === true && Array.isArray(res.items)) {
          addItems(res.items, `type:${rememberType}`);
        }
      }

      for (const rememberKey of keyList) {
        const res = await this.getLongTermByKey({
          chatId: chatIdStr,
          globalUserId,
          rememberKey,
          limit: safePerKeyLimit,
        });
        if (res?.ok === true && Array.isArray(res.items)) {
          addItems(res.items, `key:${rememberKey}`);
        }
      }

      for (const rememberDomain of domainList) {
        const res = await this.getLongTermByDomain({
          chatId: chatIdStr,
          globalUserId,
          rememberDomain,
          limit: safePerDomainLimit,
        });
        if (res?.ok === true && Array.isArray(res.items)) {
          addItems(res.items, `domain:${rememberDomain}`);
        }
      }

      for (const rememberSlot of slotList) {
        const res = await this.getLongTermBySlot({
          chatId: chatIdStr,
          globalUserId,
          rememberSlot,
          limit: safePerSlotLimit,
        });
        if (res?.ok === true && Array.isArray(res.items)) {
          addItems(res.items, `slot:${rememberSlot}`);
        }
      }

      for (const pair of domainSlotList) {
        const res = await this.getLongTermByDomainSlot({
          chatId: chatIdStr,
          globalUserId,
          rememberDomain: pair.rememberDomain,
          rememberSlot: pair.rememberSlot,
          limit: safePerDomainSlotLimit,
        });
        if (res?.ok === true && Array.isArray(res.items)) {
          addItems(
            res.items,
            `domain_slot:${pair.rememberDomain}:${pair.rememberSlot}`
          );
        }
      }

      collected.sort((a, b) => {
        const aTs = a?.createdAt ? Date.parse(a.createdAt) : 0;
        const bTs = b?.createdAt ? Date.parse(b.createdAt) : 0;

        if (bTs !== aTs) return bTs - aTs;

        const aId = Number.isFinite(Number(a?.id)) ? Number(a.id) : 0;
        const bId = Number.isFinite(Number(b?.id)) ? Number(b.id) : 0;
        return bId - aId;
      });

      const items = collected.slice(0, safeTotalLimit);

      return {
        ok: true,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        items,
        total: items.length,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        limits: {
          perTypeLimit: safePerTypeLimit,
          perKeyLimit: safePerKeyLimit,
          perDomainLimit: safePerDomainLimit,
          perSlotLimit: safePerSlotLimit,
          perDomainSlotLimit: safePerDomainSlotLimit,
          totalLimit: safeTotalLimit,
        },
      };
    } catch (e) {
      this.logger.error("selectLongTermContext failed", {
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        error: e?.message || e,
      });

      return {
        ok: false,
        enabled: !!this.getEnabled(),
        chatId: chatIdStr,
        globalUserId: globalUserId || null,
        rememberTypes: typeList,
        rememberKeys: keyList,
        rememberDomains: domainList,
        rememberSlots: slotList,
        domainSlots: domainSlotList,
        items: [],
        total: 0,
        backend: "chat_memory",
        contractVersion: this.contractVersion,
        reason: "select_long_term_context_failed",
        error: e?.message || String(e),
      };
    }
  }
}

export default MemoryLongTermReadService;