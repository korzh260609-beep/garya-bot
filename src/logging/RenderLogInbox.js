// ============================================================================
// src/logging/RenderLogInbox.js
// STAGE SKELETON — in-memory latest render log snapshot inbox
// Purpose:
// - keep only latest log snapshot per chat/user scope
// - allow /render_diag_last without re-pasting the same log
// IMPORTANT:
// - in-memory only
// - resets on restart/redeploy
// - this is a bridge, not final persistent storage
// ============================================================================

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeText(value) {
  return safeStr(value).trim();
}

function buildScopeKey({ chatId, senderIdStr }) {
  const chat = normalizeText(chatId);
  const user = normalizeText(senderIdStr);
  return `${chat}::${user}`;
}

class RenderLogInbox {
  constructor() {
    this.latestByScope = new Map();
  }

  setLatest({ chatId, senderIdStr, logText, source = "telegram_manual" }) {
    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    const normalizedLog = normalizeText(logText);

    if (!scopeKey || !normalizedLog) {
      return { ok: false, reason: "missing_scope_or_log" };
    }

    const entry = {
      scopeKey,
      chatId: normalizeText(chatId),
      senderIdStr: normalizeText(senderIdStr),
      logText: normalizedLog,
      source: normalizeText(source) || "telegram_manual",
      updatedAt: new Date().toISOString(),
      chars: normalizedLog.length,
    };

    this.latestByScope.set(scopeKey, entry);

    return {
      ok: true,
      entry,
    };
  }

  getLatest({ chatId, senderIdStr }) {
    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    if (!scopeKey) return null;
    return this.latestByScope.get(scopeKey) || null;
  }

  clearLatest({ chatId, senderIdStr }) {
    const scopeKey = buildScopeKey({ chatId, senderIdStr });
    if (!scopeKey) return { ok: false, reason: "missing_scope" };

    const existed = this.latestByScope.has(scopeKey);
    this.latestByScope.delete(scopeKey);

    return {
      ok: true,
      deleted: existed,
    };
  }

  getDebugSnapshot() {
    return {
      scopes: this.latestByScope.size,
      items: Array.from(this.latestByScope.values()).map((x) => ({
        scopeKey: x.scopeKey,
        chatId: x.chatId,
        senderIdStr: x.senderIdStr,
        source: x.source,
        updatedAt: x.updatedAt,
        chars: x.chars,
      })),
    };
  }
}

export const renderLogInbox = new RenderLogInbox();

export default renderLogInbox;