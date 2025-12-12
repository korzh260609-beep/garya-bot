// src/sources/sources.js — Sources Layer v1 (virtual/html/rss/coingecko)
import pool from "../../db.js";

// ==================================================
// === DEFAULT SOURCES (registry templates)
// ==================================================
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
    name: "HTML-пример: example.com",
    type: "html",
    url: "https://example.com/",
    enabled: true,
    config: {},
  },
  {
    key: "rss_example_news",
    name: "RSS-пример: новости",
    type: "rss",
    url: "https://hnrss.org/frontpage",
    enabled: true,
    config: {},
  },
  {
    key: "coingecko_simple_price",
    name: "CoinGecko: simple price",
    type: "coingecko",
    url: "https://api.coingecko.com/api/v3/simple/price",
    enabled: true,
    config: {
      ids: ["bitcoin", "ethereum", "solana"],
      vs_currency: "usd",
    },
  },
  {
    key: "virtual_hello",
    name: "Virtual hello source",
    type: "virtual",
    url: null,
    enabled: true,
    config: {},
  },
];

// ==================================================
// === INIT: ensureDefaultSources
// ==================================================
export async function ensureDefaultSources() {
  for (const src of DEFAULT_SOURCES) {
    try {
      await pool.query(
        `
        INSERT INTO sources (key, name, type, url, is_enabled, config)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (key) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          url = EXCLUDED.url,
          is_enabled = EXCLUDED.is_enabled,
          config = EXCLUDED.config,
          updated_at = NOW()
      `,
        [
          src.key,
          src.name,
          src.type,
          src.url,
          src.enabled,
          src.config || {},
        ]
      );
    } catch (err) {
      console.error("❌ ensureDefaultSources error for", src.key, err);
    }
  }

  console.log("📡 ensureDefaultSources: registry synced");
}

// ==================================================
// === ACCESS RULES (7.9)
// ==================================================
function canAccessSource(source, { userRole, userPlan, bypassPermissions }) {
  if (bypassPermissions) return true;

  const allowedRoles = source.allowed_roles || [];
  const allowedPlans = source.allowed_plans || [];

  if (allowedRoles.length && !allowedRoles.includes(userRole)) return false;
  if (allowedPlans.length && !allowedPlans.includes(userPlan)) return false;

  return true;
}

// ==================================================
// === BASIC HELPERS
// ==================================================
export async function listActiveSources() {
  const res = await pool.query(`
    SELECT *
    FROM sources
    WHERE is_enabled = TRUE
    ORDER BY id ASC
  `);
  return res.rows;
}

export async function getAllSources() {
  const res = await pool.query(`
    SELECT *
    FROM sources
    ORDER BY id ASC
  `);
  return res.rows;
}

// safe-variant for /sources
export async function getAllSourcesSafe() {
  try {
    const res = await pool.query(`
      SELECT
        key,
        name,
        type,
        is_enabled AS enabled,
        url,
        config
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

// ==================================================
// === LOGGING: source_logs
// ==================================================
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
      VALUES ($1,$2,$3,$4,$5,$6,$7)
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

// ==================================================
// === DIAGNOSTICS: source_checks
// ==================================================
async function logSourceCheck({ sourceKey, ok, httpStatus, message, meta }) {
  try {
    await pool.query(
      `
      INSERT INTO source_checks
        (source_key, ok, http_status, message, meta)
      VALUES ($1,$2,$3,$4,$5)
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

// ==================================================
// 5.9 — DIAGNOSE ONE SOURCE
// ==================================================
export async function diagnoseSource(key, options = {}) {
  const res = await fetchFromSourceKey(key, options);

  const httpStatus = typeof res.httpStatus === "number" ? res.httpStatus : null;

  await logSourceCheck({
    sourceKey: res.sourceKey || key,
    ok: !!res.ok,
    httpStatus,
    message: res.ok ? "OK" : res.error || "Unknown error",
    meta: {
      type: res.type || null,
      timestamp: new Date().toISOString(),
    },
  });

  return res;
}

// ==================================================
// 5.9 — RUN DIAGNOSTICS FOR ALL SOURCES
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
      httpStatus:
        typeof res.httpStatus === "number" ? res.httpStatus : null,
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
// 5.9 — GET LATEST SOURCE STATUS
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

// ==================================================
// === CORE: fetchFromSourceKey (with access rules)
// ==================================================
export async function fetchFromSourceKey(key, options = {}) {
  const startedAt = Date.now();
  let httpStatus = null;
  let type = null;

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

    // 🔐 ACCESS CHECK
    const allowed = canAccessSource(src, {
      userRole: options.userRole || "guest",
      userPlan: options.userPlan || "free",
      bypassPermissions: options.bypassPermissions === true,
    });

    if (!allowed) {
      return {
        ok: false,
        sourceKey: key,
        type: src.type,
        error: "Доступ к источнику запрещён",
      };
    }

    type = src.type;
    let resultData = null;

    // === VIRTUAL ===
    if (type === "virtual") {
      resultData = await handleVirtualSource(key, src, options);

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
      const url = options.params?.url || src.url;
      const res = await fetch(url);
      httpStatus = res.status;

      if (!res.ok) {
        const error = `HTTP ${res.status} при запросе HTML.`;
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
      const url = options.params?.url || src.url;
      const res = await fetch(url);
      httpStatus = res.status;

      if (!res.ok) {
        const error = `HTTP ${res.status} при запросе RSS.`;
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
      const urlBase = src.url;
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

      if (!res.ok) {
        const error = `HTTP ${res.status} от CoinGecko.`;
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
      resultData = { ids, vsCurrency, prices: json };

      await logSourceRequest({
        sourceKey: key,
        type,
        ok: true,
        httpStatus,
        durationMs: Date.now() - startedAt,
        params: { ...(options.params || {}), url, ids, vsCurrency },
        extra: { keys: Object.keys(json || {}) },
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

// ==================================================
// === VIRTUAL SOURCES
// ==================================================
async function handleVirtualSource(key) {
  switch (key) {
    case "virtual_hello":
      return { message: "Hello from virtual source!" };
    case "generic_web_search":
      return { description: "Заглушка веб-поиска" };
    case "generic_news_feed":
      return { description: "Заглушка новостей" };
    case "generic_public_markets":
      return { description: "Заглушка рынков" };
    default:
      return { description: `Virtual source "${key}"` };
  }
}

// ==================================================
// === PRESENTATION
// ==================================================
export function formatSourcesList(sources) {
  if (!sources || sources.length === 0) return "Источники не найдены.";

  return sources
    .map(
      (src) => `
🔹 <b>${src.name}</b>
key: <code>${src.key}</code>
type: <code>${src.type}</code>
enabled: ${src.enabled ? "🟢" : "🔴"}
    `.trim()
    )
    .join("\n\n");
}
