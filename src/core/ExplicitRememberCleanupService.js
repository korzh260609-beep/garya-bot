// src/core/ExplicitRememberCleanupService.js
// STAGE 7.4 V1.1 — cleanup / reclassify old explicit remember rows
//
// Goal:
// - find old long_term explicit memories with rememberKey=user_explicit_memory
// - classify them again using current deterministic classifier
// - update ONLY rows that can be upgraded to a better key
// - do NOT touch rows that already have a specific key
// - do NOT rewrite content
// - minimal safe DB update
//
// Rules:
// - no AI
// - no schema changes
// - fail-open
// - dry-run supported
//
// Expected usage later:
//   const svc = new ExplicitRememberCleanupService();
//   const result = await svc.reclassifyLegacyExplicitRemember({
//     chatIdStr,
//     globalUserId,
//     limit: 100,
//     dryRun: true,
//   });

import pool from "../../db.js";
import { classifyExplicitRememberKey } from "./explicitRememberKey.js";

function safeInt(value, fallback = 100, min = 1, max = 500) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function extractRememberValue(content) {
  const text = String(content || "").trim();

  // Expected current format:
  // [MEMORY:key] value
  const m = /^\[MEMORY:[^\]]+\]\s*(.+)$/s.exec(text);
  if (m && m[1]) return String(m[1]).trim();

  return text;
}

function buildRememberContent(key, value) {
  return `[MEMORY:${key}] ${value}`;
}

export class ExplicitRememberCleanupService {
  constructor({ db = null, logger = null } = {}) {
    this.db = db || pool;
    this.logger = logger || console;
  }

  async reclassifyLegacyExplicitRemember({
    chatIdStr,
    globalUserId = null,
    limit = 100,
    dryRun = true,
  } = {}) {
    if (!chatIdStr) {
      return {
        ok: false,
        reason: "missing_chatId",
      };
    }

    const safeLimit = safeInt(limit, 100, 1, 500);
    const safeDryRun = Boolean(dryRun);

    try {
      const params = [String(chatIdStr)];
      let idx = 2;

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
          ${globalUserSql}
          AND role = 'system'
          AND metadata->>'memoryType' = 'long_term'
          AND metadata->>'explicit' = 'true'
          AND metadata->>'rememberKey' = 'user_explicit_memory'
        ORDER BY id ASC
        LIMIT $${idx}
        `,
        params
      );

      const rows = res.rows || [];
      const inspected = rows.length;

      let updated = 0;
      let skipped = 0;
      let unchanged = 0;
      const preview = [];

      for (const row of rows) {
        const oldContent = String(row.content || "");
        const rememberValue = extractRememberValue(oldContent);
        const newKey = classifyExplicitRememberKey(rememberValue);

        // keep generic if classifier still does not know better
        if (!newKey || newKey === "user_explicit_memory") {
          unchanged += 1;
          preview.push({
            id: row.id,
            action: "unchanged",
            fromKey: "user_explicit_memory",
            toKey: "user_explicit_memory",
            value: rememberValue,
          });
          continue;
        }

        const nextContent = buildRememberContent(newKey, rememberValue);

        const oldMeta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
        const nextMeta = {
          ...oldMeta,
          memoryType: "long_term",
          explicit: true,
          rememberKey: newKey,
          cleanupSource: "ExplicitRememberCleanupService.reclassifyLegacyExplicitRemember",
          cleanupAt: new Date().toISOString(),
          legacyRememberKey: oldMeta.rememberKey || "user_explicit_memory",
        };

        if (safeDryRun) {
          skipped += 1;
          preview.push({
            id: row.id,
            action: "dry_run_upgrade",
            fromKey: "user_explicit_memory",
            toKey: newKey,
            value: rememberValue,
          });
          continue;
        }

        const upd = await this.db.query(
          `
          UPDATE chat_memory
          SET
            content = $2,
            metadata = $3::jsonb
          WHERE id = $1
          RETURNING id
          `,
          [row.id, nextContent, JSON.stringify(nextMeta)]
        );

        if ((upd.rows || []).length > 0) {
          updated += 1;
          preview.push({
            id: row.id,
            action: "updated",
            fromKey: "user_explicit_memory",
            toKey: newKey,
            value: rememberValue,
          });
        } else {
          skipped += 1;
          preview.push({
            id: row.id,
            action: "update_failed",
            fromKey: "user_explicit_memory",
            toKey: newKey,
            value: rememberValue,
          });
        }
      }

      return {
        ok: true,
        dryRun: safeDryRun,
        chatId: String(chatIdStr),
        globalUserId: globalUserId ? String(globalUserId) : null,
        inspected,
        updated,
        skipped,
        unchanged,
        preview,
      };
    } catch (e) {
      this.logger.error("❌ ExplicitRememberCleanupService.reclassifyLegacyExplicitRemember failed:", e);
      return {
        ok: false,
        reason: "cleanup_failed",
        error: e?.message || String(e),
      };
    }
  }

  formatResult(result = {}) {
    if (!result || result.ok !== true) {
      return "⚠️ cleanup failed.";
    }

    const lines = [];
    lines.push("🧠 EXPLICIT REMEMBER CLEANUP");
    lines.push(`chat_id: ${result.chatId || "—"}`);
    lines.push(`globalUserId: ${result.globalUserId || "NULL"}`);
    lines.push(`dry_run: ${result.dryRun ? "true ✅" : "false ⚠️"}`);
    lines.push(`inspected: ${result.inspected ?? 0}`);
    lines.push(`updated: ${result.updated ?? 0}`);
    lines.push(`skipped: ${result.skipped ?? 0}`);
    lines.push(`unchanged: ${result.unchanged ?? 0}`);
    lines.push("");

    const preview = Array.isArray(result.preview) ? result.preview.slice(0, 20) : [];
    if (preview.length === 0) {
      lines.push("No rows.");
      return lines.join("\n").slice(0, 3800);
    }

    lines.push("Preview:");
    for (const item of preview) {
      const value = String(item.value || "").replace(/\s+/g, " ").trim().slice(0, 120);
      lines.push(
        `#${item.id} | ${item.action} | ${item.fromKey} -> ${item.toKey} | "${value}"`
      );
    }

    return lines.join("\n").slice(0, 3800);
  }
}

export default ExplicitRememberCleanupService;