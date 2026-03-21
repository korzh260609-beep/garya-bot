// src/core/ExplicitRememberCleanupService.js
// STAGE 7.5 — cleanup / reclassify old explicit remember rows
//
// Goal:
// - find old long_term explicit memories that still need upgrade
// - support BOTH:
//   1) legacy rememberKey=user_explicit_memory -> reclassify to better key
//   2) rows with specific rememberKey but missing rememberType -> backfill type
//   3) rows with known rememberKey but old/raw value -> normalize value
// - do NOT touch rows that already have good key + good rememberType + good value
// - minimal safe DB update
//
// Rules:
// - no AI
// - no schema changes
// - fail-open
// - dry-run supported

import pool from "../../db.js";
import {
  classifyExplicitRememberKey,
  extractExplicitRememberValue,
} from "./explicitRememberKey.js";
import { deriveRememberTypeFromKey } from "./rememberType.js";

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

function isMissingRememberType(meta = {}) {
  const rememberType = String(meta?.rememberType || "").trim();
  return !rememberType;
}

function isLegacyGenericKey(meta = {}) {
  return String(meta?.rememberKey || "").trim() === "user_explicit_memory";
}

function normalizeComparableValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function shouldNormalizeKnownValue(currentKey, currentValue) {
  const key = String(currentKey || "").trim();
  const rawValue = String(currentValue || "").trim();

  if (!key || !rawValue) return false;

  const extracted = extractExplicitRememberValue(rawValue);
  const safeExtracted = normalizeComparableValue(extracted);
  const safeCurrent = normalizeComparableValue(rawValue);

  if (!safeExtracted) return false;
  if (safeExtracted === safeCurrent) return false;

  // At this stage only normalize if extractor actually changes value.
  return true;
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

      // IMPORTANT:
      // - inspect:
      //   1) legacy generic-key rows
      //   2) rows with missing rememberType
      //   3) rows that can get normalized value from deterministic extractor
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
        const oldMeta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};

        const currentKey = String(oldMeta.rememberKey || "").trim() || "user_explicit_memory";
        const currentType = String(oldMeta.rememberType || "").trim();
        const legacyGeneric = isLegacyGenericKey(oldMeta);
        const missingType = isMissingRememberType(oldMeta);

        let nextKey = currentKey;
        let nextValue = rememberValue;
        let action = "unchanged";

        if (legacyGeneric) {
          const classifiedKey = classifyExplicitRememberKey(rememberValue);

          // keep generic if classifier still does not know better
          if (classifiedKey && classifiedKey !== "user_explicit_memory") {
            nextKey = classifiedKey;
            action = safeDryRun ? "dry_run_upgrade" : "updated";
          }
        }

        // deterministic value normalization for known patterns
        if (shouldNormalizeKnownValue(nextKey, nextValue)) {
          const extractedValue = extractExplicitRememberValue(nextValue);
          const safeExtractedValue = normalizeComparableValue(extractedValue);

          if (safeExtractedValue && safeExtractedValue !== normalizeComparableValue(nextValue)) {
            nextValue = safeExtractedValue;
            if (action === "unchanged") {
              action = safeDryRun ? "dry_run_value_normalize" : "updated";
            }
          }
        }

        const nextType = deriveRememberTypeFromKey(nextKey);

        const sameKey = nextKey === currentKey;
        const sameType = currentType === nextType;
        const sameValue =
          normalizeComparableValue(nextValue) === normalizeComparableValue(rememberValue);

        if (sameKey && sameType && sameValue) {
          unchanged += 1;
          preview.push({
            id: row.id,
            action: "unchanged",
            fromKey: currentKey,
            toKey: nextKey,
            fromType: currentType || "—",
            toType: nextType || "—",
            fromValue: rememberValue,
            toValue: nextValue,
          });
          continue;
        }

        const nextContent =
          sameKey && sameValue ? oldContent : buildRememberContent(nextKey, nextValue);

        const nextMeta = {
          ...oldMeta,
          memoryType: "long_term",
          explicit: true,
          rememberKey: nextKey,
          rememberType: nextType,
          cleanupSource: "ExplicitRememberCleanupService.reclassifyLegacyExplicitRemember",
          cleanupAt: new Date().toISOString(),
          legacyRememberKey: oldMeta.rememberKey || "user_explicit_memory",
        };

        if (safeDryRun) {
          skipped += 1;
          preview.push({
            id: row.id,
            action,
            fromKey: currentKey,
            toKey: nextKey,
            fromType: currentType || "—",
            toType: nextType,
            fromValue: rememberValue,
            toValue: nextValue,
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
            fromKey: currentKey,
            toKey: nextKey,
            fromType: currentType || "—",
            toType: nextType,
            fromValue: rememberValue,
            toValue: nextValue,
          });
        } else {
          skipped += 1;
          preview.push({
            id: row.id,
            action: "update_failed",
            fromKey: currentKey,
            toKey: nextKey,
            fromType: currentType || "—",
            toType: nextType,
            fromValue: rememberValue,
            toValue: nextValue,
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
      const fromValue = String(item.fromValue || "").replace(/\s+/g, " ").trim().slice(0, 80);
      const toValue = String(item.toValue || "").replace(/\s+/g, " ").trim().slice(0, 80);

      lines.push(
        `#${item.id} | ${item.action} | key: ${item.fromKey} -> ${item.toKey} | type: ${item.fromType} -> ${item.toType} | value: "${fromValue}" -> "${toValue}"`
      );
    }

    return lines.join("\n").slice(0, 3800);
  }
}

export default ExplicitRememberCleanupService;