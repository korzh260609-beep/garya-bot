// src/sources/sources.js — Sources Layer v1 (virtual/html/rss/coingecko + perms + rate-limit + cache)
import pool from "../../db.js";
import { can } from "../users/permissions.js"; // ✅ 7.9: source-level permissions via can()

// === DEFAULT SOURCES (registry templates) ===
const DEFAULT_SOURCES = [
  {
    key: "generic_web_search",
    name: "Общедоступный веб-поиск",
    type: "virtual",
    url: null,
    enabled: true,
    config: {},
  },
  {
    key: "generic_news_feed",
    name: "Общедоступные новостные ленты",
    type: "virtual",
    url: null,
    enabled: true,
    config: {},
  },
  {
    key: "generic_public_markets",
    name: "Публичные рыночные данные (без ключей)",
    type: "virtual",
    url: null,
    enabled: true,
    config: {},
  },
  {
    key: "html_example_page",
    name: "HTML-пример: example.com (старый ключ)",
    type: "html",
    url: "https://example.com/",
    enabled: true,
    config: {},
  },
  {
    key: "rss_example_news",
    name: "RSS-пример: новости (старый ключ)",
    type: "rss",
    url: "https://hnrss.org/frontpage",
    enabled: true,
    config: {},
  },
  {
    key: "coingecko_simple_price",
    name: "CoinGecko: simple price (BTC/ETH/SOL)",
    type: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price",
    enabled: true,
    config: {
      ids: ["bitcoin", "ethereum", "solana"],
      vs_currency: "usd",
    },
    // 👇 важное поле — ограничение запросов к CoinGecko
    rate_limit_seconds: 60,
  },
  {
    key: "virtual_hello",
    name: "Virtual hello source",
    type: "virtual",
    url: null,
    enabled: true,
    config: {},
  },
  {
    key: "html_example",
    name: "Example.com (HTML)",
    type: "html",
    url: "https://example.com/",
    enabled: true,
    config: {},
  },
  {
    key: "rss_hackernews",
    name: "Hacker News (RSS)",
    type: "rss",
    url: "https://news.ycombinator.com/rss",
    enabled: true,
    config: {},
  },
];

// === INIT: ensureDefaultSources ===
export async function ensureDefaultSources() {
  for (const src of DEFAULT_SOURCES) {
    try {
      await pool.query(
        `
        INSERT INTO sources (key, name, type, url, is_enabled, config, rate_limit_seconds)
        VALUES ($1,   $2,   $3,  $4,  $5,         $6,    $7)
        ON CONFLICT (key) DO UPDATE SET
          name               = EXCLUDED.name,
          type               = EXCLUDED.type,
          url                = EXCLUDED.url,
          is_enabled         = EXCLUDED.is_enabled,
          config             = EXCLUDED.config,
          rate_limit_seconds = EXCLUDED.rate_limit_seconds,
          updated_at         = NOW()
      `,
        [
          src.key,
          src.name,
          src.type,
          src.url,
          src.enabled,
          src.config || {},
          typeof src.rate_limit_seconds === "number"
            ? src.rate_limit_seconds
            : null,
        ]
      );
    } catch (err) {
      console.error("❌ ensureDefaultSources error for", src.key, err);
    }
  }

  console.log("📡 ensureDefaultSources: registry synced");
}

// === BASIC HELPERS ===
export async function listActiveSources() {
  const res = await pool.query(`
    SELECT *
    FROM sources
    WHERE is_enabled = TRUE
    ORDER BY key ASC
  `);
  return res.rows;
}

export async function getAllSources() {
  const res = await pool.query(`
    SELECT *
    FROM sources
    ORDER BY key ASC
  `);
  return res.rows;
}

// Вариант "safe" — то, что нужно для /sources
export async function getAllSourcesSafe() {
  try {
    const res = await pool.query(`
      SELECT
        key,
        name,
        type,
        is_enabled AS enabled,
        url,
        config,
        allowed_roles,
        allowed_plans,
        rate_limit_seconds
      FROM sources
      ORDER BY key
    `);
    return res.rows;
  } catch (err) {
    console.error("❌ getAllSourcesSafe error:", err);
    return [];
  }
}

async function getSourceByKey(key) {
  const res = await pool.query(
    `
    SELECT *
    FROM sources
    WHERE key = $1
      AND is_enabled = TRUE
    LIMIT 1
  `,
    [key]
  );
  return res.rows[0] || null;
}

// === PERMISSIONS (5.12) ===
// ОСТАВЛЕНО ДЛЯ СОВМЕСТИМОСТИ/ОТКАТА.
// Фактическая проверка теперь делается через can(user, `source:${key}`, {source})
function isSourceAllowedForUser(src, userRole, userPlan) {
  const roles = src.allowed_roles || ["guest", "citizen", "monarch"];
  const plans = src.allowed_plans || ["free", "pro", "vip"];

  const roleOk = !userRole || roles.includes(userRole);
  const planOk = !userPlan || plans.includes(userPlan);

  return roleOk && planOk;
}

// === CACHE (5.13) ===
async function getSourceCache(sourceKey) {
  const res = await pool.query(
    `
      SELECT cached_json, cached_at
      FROM source_cache
      WHERE source_key = $1
      LIMIT 1
    `,
    [sourceKey]
  );
  return res.rows[0] || null;
}

async function upsertSourceCache(sourceKey, payload) {
  try {
    await pool.query(
      `
        INSERT INTO source_cache (source_key, cached_json, cached_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (source_key) DO UPDATE SET
          cached_json = EXCLUDED.cached_json,
          cached_at   = NOW()
      `,
      [sourceKey, payload]
    );
  } catch (err) {
    console.error("❌ upsertSourceCache error:", err);
  }
}

// === LOGGING: source_logs ===
async function logSourceRequest({
  sourceKey,
  type,
  httpStatus,
  ok,
  durationMs,
  extra,
  params,
}) {
  try {
    await pool.query(
      `
      INSERT INTO source_logs
        (source_key, source_type, http_status, ok, duration_ms, params, extra)
      VALUES ($1,        $2,          $3,         $4, $5,         $6,    $7)
    `,
      [
        sourceKey,
        type || null,
        httpStatus ?? null,
        ok === true,
        durationMs ?? null,
        params || null,
        extra || {},
      ]
    );
  } catch (err) {
    console.error("❌ logSourceRequest error:", err);
  }
}

// === DIAGNOSTICS: source_checks ===
async function logSourceCheck({ sourceKey, ok, httpStatus, message, meta }) {
  try {
    await pool.query(
      `
      INSERT INTO source_checks
        (source_key, ok, http_status, message, meta)
      VALUES ($1,        $2, $3,          $4,      $5)
    `,
      [
        sourceKey,
        ok === true,
        httpStatus ?? null,
        message || null,
        meta || {},
      ]
    );
  } catch (err) {
    console.error("❌ logSourceCheck error:", err);
  }
}

// === helpers: success/error marks ===
async function markSourceSuccess(key) {
  try {
    await pool.query(
      `
        UPDATE sources
        SET last_success_at = NOW(),
            last_error_at = NULL,
            last_error_message = NULL
        WHERE key = $1
      `,
      [key]
    );
  } catch (err) {
    console.error("❌ markSourceSuccess error:", err);
  }
}

async function markSourceError(key, message) {
  try {
    await pool.query(
      `
        UPDATE sources
        SET last_error_at = NOW(),
            last_error_message = $2
        WHERE key = $1
      `,
      [key, message?.toString().slice(0, 500) || null]
    );
  } catch (err) {
    console.error("❌ markSourceError error:", err);
  }
}

// ==================================================
// 5.9 — DIAGNOSE ONE SOURCE
// ==================================================
export async function diagnoseSource(key, options = {}) {
  const res = await fetchFromSourceKey(key, {
    ...options,
    // для диагностики можно явно пробивать rate-limit, если захочешь
    ignoreRateLimit: options.ignoreRateLimit === true,
  });

  const httpStatus = typeof res.httpStatus === "number" ? res.httpStatus : null;

  await logSourceCheck({
    sourceKey: res.sourceKey || key,
    ok: !!res.ok,
    httpStatus,
    message: res.ok ? "OK" : res.error || "Unknown error",
    meta: {
      type: res.type || null,
      fromCache: !!res.fromCache,
      timestamp: new Date().toISOString(),
    },
  });

  return res;
}

// ==================================================
// 5.7.3 — TEST ONE SOURCE (REAL TEST, FOR /test_source)
// ==================================================
export async function testSource(key, options = {}) {
  const t0 = Date.now();

  try {
    const res = await fetchFromSourceKey(key, {
      ...options,
      // тест по умолчанию НЕ должен пробивать rate-limit
      ignoreRateLimit: options.ignoreRateLimit === true,
    });

    const latencyMs = Date.now() - t0;
    const httpStatus = typeof res.httpStatus === "number" ? res.httpStatus : null;

    // bytes only for data (safe)
    let bytes = 0;
    try {
      if (res?.data != null) bytes = Buffer.byteLength(JSON.stringify(res.data), "utf8");
    } catch (_) {
      bytes = 0;
    }

    // 429 — всегда считаем проблемой теста (даже если отдали кеш)
    const errText = String(res?.error || "");
    if (httpStatus === 429 || errText.includes("429")) {
      return {
        ok: false,
        reason: "rate_limited",
        sourceKey: res.sourceKey || key,
        type: res.type || null,
        httpStatus: 429,
        latencyMs,
        bytes,
        fromCache: !!res.fromCache,
        error: res.error || "HTTP 429",
      };
    }

    if (!res?.ok) {
      return {
        ok: false,
        reason: "http_error",
        sourceKey: res.sourceKey || key,
        type: res.type || null,
        httpStatus,
        latencyMs,
        bytes,
        fromCache: !!res.fromCache,
        error: res.error || "Request failed",
      };
    }

    return {
      ok: true,
      reason: "ok",
      sourceKey: res.sourceKey || key,
      type: res.type || null,
      httpStatus,
      latencyMs,
      bytes,
      fromCache: !!res.fromCache,
    };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    return {
      ok: false,
      reason: "exception",
      sourceKey: key,
      type: null,
      httpStatus: null,
      latencyMs,
      bytes: 0,
      fromCache: false,
      error: err?.message || String(err),
    };
  }
}

// ==================================================
// 5.11 — RUN DIAGNOSTICS FOR ALL SOURCES (ONE-SHOT)
// ==================================================
export async function runSourceDiagnosticsOnce(options = {}) {
  const sources = await listActiveSources();
  const items = [];

  for (const src of sources) {
    const res = await diagnoseSource(src.key, options);

    items.push({
      key: src.key,
      type: src.type,
      ok: !!res.ok,
      httpStatus: typeof res.httpStatus === "number" ? res.httpStatus : null,
      error: res.ok ? null : res.error || null,
    });
  }

  return {
    total: items.length,
    okCount: items.filter((i) => i.ok).length,
    failCount: items.filter((i) => !i.ok).length,
    items,
  };
}

// ==================================================
// 5.10 — GET LATEST SOURCE STATUS (FROM source_checks)
// ==================================================
export async function getLatestSourceChecks() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (source_key)
      source_key, ok, http_status, message, meta, created_at
    FROM source_checks
    ORDER BY source_key, created_at DESC;
  `);

  return rows;
}

// === CORE: fetchFromSourceKey (с разрешениями, rate-limit и кэшем) ===
export async function fetchFromSourceKey(key, options = {}) {
  const startedAt = Date.now();
  let httpStatus = null;
  let type = null;

  const userRole = options.userRole || null;
  const userPlan = options.userPlan || null;
  const bypassPermissions = options.bypassPermissions === true;
  const ignoreRateLimit = options.ignoreRateLimit === true;

  // ✅ user object for permissions-layer
  const user = {
    role: userRole,
    plan: userPlan,
    bypassPermissions,
  };

  try {
    const src = await getSourceByKey(key);
    if (!src) {
      const error = `Источник "${key}" не найден или выключен.`;
      await logSourceRequest({
        sourceKey: key,
        type: null,
        httpStatus: null,
        ok: false,
        durationMs: Date.now() - startedAt,
        params: options.params || null,
        extra: { error },
      });
      return { ok: false, sourceKey: key, error };
    }

    type = src.type;

    // === Permissions check (7.9 via can()) ===
    // IMPORTANT: передаём source в ctx, чтобы can() мог использовать enabled/roles/plans
    const allowedByCan = can(user, `source:${key}`, { source: src });

    // Для совместимости оставим старую логику как fallback (на случай, если где-то планы/роли ещё не заполнены)
    const allowedByLegacy = isSourceAllowedForUser(src, userRole, userPlan);

    if (!bypassPermissions && !(allowedByCan || allowedByLegacy)) {
      const error = "Доступ к этому источнику запрещён для вашей роли/тарифа.";
      await logSourceRequest({
        sourceKey: key,
        type,
        httpStatus: null,
        ok: false,
        durationMs: Date.now() - startedAt,
        params: options.params || null,
        extra: {
          error,
          userRole,
          userPlan,
          allowedByCan,
          allowedByLegacy,
        },
      });
      return { ok: false, sourceKey: key, type, error };
    }

    // === Rate-limit + cache (5.13) ===
    const rateLimitSeconds =
      typeof src.rate_limit_seconds === "number" ? src.rate_limit_seconds : 0;

    if (!ignoreRateLimit && rateLimitSeconds > 0 && src.last_success_at) {
      const lastSuccessTs = new Date(src.last_success_at).getTime();
      const diffSec = (Date.now() - lastSuccessTs) / 1000;

      if (diffSec < rateLimitSeconds) {
        const cache = await getSourceCache(key);
        if (cache) {
          const durationMs = Date.now() - startedAt;
          await logSourceRequest({
            sourceKey: key,
            type,
            httpStatus: null,
            ok: true,
            durationMs,
            params: options.params || null,
            extra: {
              note: "cache-hit",
              rateLimitSeconds,
              diffSec,
            },
          });

          return {
            ok: true,
            sourceKey: key,
            type,
            httpStatus: null,
            data: cache.cached_json,
            raw: cache.cached_json,
            fromCache: true,
          };
        }
      }
    }

    let resultData = null;

    // === VIRTUAL ===
    if (type === "virtual") {
      resultData = await handleVirtualSource(key, src, options);

      await upsertSourceCache(key, resultData);
      await markSourceSuccess(key);

      await logSourceRequest({
        sourceKey: key,
        type,
        ok: true,
        httpStatus: null,
        durationMs: Date.now() - startedAt,
        params: options.params || null,
        extra: { note: "virtual source" },
      });

      return {
        ok: true,
        sourceKey: key,
        type,
        httpStatus: null,
        data: resultData,
        raw: resultData,
      };
    }

    // === HTML ===
    if (type === "html") {
      const url = options.params?.url || src.url || "https://example.com/";
      const res = await fetch(url);
      httpStatus = res.status;

      if (!res.ok) {
        const error = `HTTP ${res.status} при запросе HTML.`;
        await markSourceError(key, error);
        await logSourceRequest({
          sourceKey: key,
          type,
          ok: false,
          httpStatus,
          durationMs: Date.now() - startedAt,
          params: { ...(options.params || {}), url },
          extra: { url, error },
        });
        return { ok: false, sourceKey: key, type, httpStatus, error };
      }

      const text = await res.text();
      resultData = { url, snippet: text.slice(0, 2000) };

      await upsertSourceCache(key, resultData);
      await markSourceSuccess(key);

      await logSourceRequest({
        sourceKey: key,
        type,
        ok: true,
        httpStatus,
        durationMs: Date.now() - startedAt,
        params: { ...(options.params || {}), url },
        extra: { url, length: text.length },
      });

      return {
        ok: true,
        sourceKey: key,
        type,
        httpStatus,
        data: resultData,
        raw: text,
      };
    }

    // === RSS ===
    if (type === "rss") {
      const url =
        options.params?.url || src.url || "https://hnrss.org/frontpage";
      const res = await fetch(url);
      httpStatus = res.status;

      if (!res.ok) {
        const error = `HTTP ${res.status} при запросе RSS.`;
        await markSourceError(key, error);
        await logSourceRequest({
          sourceKey: key,
          type,
          ok: false,
          httpStatus,
          durationMs: Date.now() - startedAt,
          params: { ...(options.params || {}), url },
          extra: { url, error },
        });
        return { ok: false, sourceKey: key, type, httpStatus, error };
      }

      const xml = await res.text();
      resultData = { url, snippet: xml.slice(0, 2000) };

      await upsertSourceCache(key, resultData);
      await markSourceSuccess(key);

      await logSourceRequest({
        sourceKey: key,
        type,
        ok: true,
        httpStatus,
        durationMs: Date.now() - startedAt,
        params: { ...(options.params || {}), url },
        extra: { url, length: xml.length },
      });

      return {
        ok: true,
        sourceKey: key,
        type,
        httpStatus,
        data: resultData,
        raw: xml,
      };
    }

    // === COINGECKO ===
    if (type === "coingecko") {
      const urlBase =
        src.url || "https://api.coingecko.com/api/v3/simple/price";
      const cfg = src.config || {};
      const ids =
        options.params?.ids || cfg.ids || ["bitcoin", "ethereum", "solana"];
      const vsCurrency =
        options.params?.vs_currency || cfg.vs_currency || "usd";

      const url =
        urlBase +
        `?ids=${encodeURIComponent(ids.join(","))}` +
        `&vs_currencies=${encodeURIComponent(vsCurrency)}`;

      const res = await fetch(url);
      httpStatus = res.status;

      // Специальный хендлер для 429: пробуем взять данные из кэша
      if (res.status === 429) {
        const cache = await getSourceCache(key);

        if (cache) {
          const durationMs = Date.now() - startedAt;

          await logSourceRequest({
            sourceKey: key,
            type,
            httpStatus,
            ok: true, // запрос к пользователю считаем успешным (дали данные)
            durationMs,
            params: { ...(options.params || {}), url, ids, vsCurrency },
            extra: {
              url,
              note: "coingecko-429-cache-hit",
            },
          });

          // Не трогаем last_success_at, чтобы rate-limit продолжал работать по реальным запросам
          return {
            ok: true,
            sourceKey: key,
            type,
            httpStatus,
            data: cache.cached_json,
            raw: cache.cached_json,
            fromCache: true,
            error: "CoinGecko вернул 429, использован кеш последних данных.",
          };
        }

        // Кэша нет — нормальная ошибка 429
        const error = "HTTP 429 от CoinGecko (лимит запросов).";
        await markSourceError(key, error);
        await logSourceRequest({
          sourceKey: key,
          type,
          ok: false,
          httpStatus,
          durationMs: Date.now() - startedAt,
          params: { ...(options.params || {}), url, ids, vsCurrency },
          extra: { url, error },
        });

        return { ok: false, sourceKey: key, type, httpStatus, error };
      }

      if (!res.ok) {
        const error = `HTTP ${res.status} от CoinGecko.`;
        await markSourceError(key, error);
        await logSourceRequest({
          sourceKey: key,
          type,
          ok: false,
          httpStatus,
          durationMs: Date.now() - startedAt,
          params: { ...(options.params || {}), url, ids, vsCurrency },
          extra: { url, error },
        });
        return { ok: false, sourceKey: key, type, httpStatus, error };
      }

      const json = await res.json();
      resultData = { url, ids, vs_currency: vsCurrency, prices: json };

      await upsertSourceCache(key, resultData);
      await markSourceSuccess(key);

      await logSourceRequest({
        sourceKey: key,
        type,
        ok: true,
        httpStatus,
        durationMs: Date.now() - startedAt,
        params: { ...(options.params || {}), url, ids, vsCurrency },
        extra: { url, ids, vsCurrency, keys: Object.keys(json || {}) },
      });

      return {
        ok: true,
        sourceKey: key,
        type,
        httpStatus,
        data: resultData,
        raw: json,
      };
    }

    // === UNSUPPORTED TYPE ===
    const error = `Тип источника "${type}" не поддерживается.`;
    await markSourceError(key, error);
    await logSourceRequest({
      sourceKey: key,
      type,
      ok: false,
      httpStatus: null,
      durationMs: Date.now() - startedAt,
      params: options.params || null,
      extra: { error },
    });

    return { ok: false, sourceKey: key, type, error };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    console.error("❌ fetchFromSourceKey error:", err);

    await markSourceError(key, err.message || String(err));

    await logSourceRequest({
      sourceKey: key,
      type,
      ok: false,
      httpStatus,
      durationMs,
      params: options.params || null,
      extra: { error: err.message || String(err) },
    });

    return {
      ok: false,
      sourceKey: key,
      type,
      httpStatus,
      error: `Ошибка: ${err.message || err}`,
    };
  }
}

// === VIRTUAL SOURCES ===
async function handleVirtualSource(key, src, options) {
  switch (key) {
    case "virtual_hello":
      return {
        message: "Hello from virtual source!",
        timestamp: new Date().toISOString(),
      };

    case "generic_web_search":
      return {
        description:
          "Заглушка для веб-поиска. Реальный поиск будет добавлен позже.",
      };

    case "generic_news_feed":
      return {
        description:
          "Заглушка для новостных лент. Позже сюда добавим реальные RSS/API.",
      };

    case "generic_public_markets":
      return {
        description:
          "Заглушка для общих рыночных данных. Будет расширена позже.",
      };

    default:
      return {
        description: `Virtual source "${key}" (пока без спец-логики).`,
      };
  }
}

// === ПРЕДСТАВЛЕНИЕ ДЛЯ /sources ===
export function formatSourcesList(sources) {
  if (!sources || sources.length === 0) {
    return "Источники не найдены.";
  }

  return sources
    .map((src) => {
      const roles =
        (src.allowed_roles && src.allowed_roles.join(", ")) || "—";
      const plans =
        (src.allowed_plans && src.allowed_plans.join(", ")) || "—";
      const rl =
        typeof src.rate_limit_seconds === "number"
          ? `${src.rate_limit_seconds}s`
          : "n/a";

      return `
🔹 <b>${src.name}</b>
key: <code>${src.key}</code>
type: <code>${src.type}</code>
enabled: ${src.enabled ? "🟢" : "🔴"}
roles: ${roles}
plans: ${plans}
rate-limit: ${rl}
      `.trim();
    })
    .join("\n\n");
}
