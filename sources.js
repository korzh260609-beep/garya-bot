// sources.js — Sources Layer: реестр источников + fetch + логирование
import pool from "./db.js";

// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ЛОГИРОВАНИЯ ===
async function logSourceEvent({
  sourceKey,
  sourceType,
  httpStatus = null,
  ok = false,
  durationMs = null,
  params = null,
  extra = null,
}) {
  try {
    await pool.query(
      `
      INSERT INTO source_logs (
        source_key,
        source_type,
        http_status,
        ok,
        duration_ms,
        params,
        extra
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7);
    `,
      [
        sourceKey,
        sourceType,
        httpStatus,
        ok,
        durationMs,
        params ? JSON.stringify(params) : null,
        extra ? JSON.stringify(extra) : null,
      ]
    );
  } catch (err) {
    console.error("❌ Error writing to source_logs:", err);
  }
}

// === ensureDefaultSources: создаём базовые источники, если их нет ===
export async function ensureDefaultSources() {
  const defaults = [
    {
      key: "virtual_hello",
      name: "Virtual hello source",
      type: "virtual",
      url: null,
      config: {},
    },
    {
      key: "html_example",
      name: "Example.com (HTML)",
      type: "html",
      url: "https://example.com",
      config: {},
    },
    {
      key: "rss_hackernews",
      name: "Hacker News (RSS)",
      type: "rss",
      url: "https://news.ycombinator.com/rss",
      config: {},
    },
    {
      key: "coingecko_simple_price",
      name: "CoinGecko Simple Price (BTC/ETH → USD)",
      type: "coingecko",
      url: "https://api.coingecko.com/api/v3/simple/price",
      config: {
        ids: ["bitcoin", "ethereum"],
        vs_currencies: ["usd"],
      },
    },
  ];

  for (const src of defaults) {
    try {
      await pool.query(
        `
        INSERT INTO sources (key, name, type, url, config)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (key) DO NOTHING;
      `,
        [src.key, src.name, src.type, src.url, src.config]
      );
    } catch (err) {
      console.error(`❌ Error inserting default source ${src.key}:`, err);
    }
  }

  console.log("✅ ensureDefaultSources: базовые источники проверены/созданы");
}

// === Получить все источники (для /sources) ===
export async function getAllSources() {
  const res = await pool.query(
    `SELECT * FROM sources ORDER BY id ASC;`
  );
  return res.rows;
}

// === Основная функция: вызов источника по ключу ===
export async function fetchFromSourceKey(sourceKey, options = {}) {
  const startedAt = Date.now();
  let httpStatus = null;
  let ok = false;
  let sourceType = null;
  const params = options.params || {};

  try {
    // 1. Находим источник в БД
    const res = await pool.query(
      `SELECT * FROM sources WHERE key = $1 AND enabled = TRUE;`,
      [sourceKey]
    );

    if (res.rowCount === 0) {
      const durationMs = Date.now() - startedAt;
      await logSourceEvent({
        sourceKey,
        sourceType: null,
        httpStatus: null,
        ok: false,
        durationMs,
        params,
        extra: { error: "SOURCE_NOT_FOUND" },
      });

      return {
        ok: false,
        sourceKey,
        error: "Источник не найден или выключен",
      };
    }

    const source = res.rows[0];
    sourceType = source.type;

    // 2. Ветвим логику по типу источника
    if (source.type === "virtual") {
      // Простой виртуальный источник — без HTTP
      const durationMs = Date.now() - startedAt;
      ok = true;

      await logSourceEvent({
        sourceKey,
        sourceType: source.type,
        httpStatus: null,
        ok,
        durationMs,
        params,
        extra: { note: "virtual source, no HTTP request" },
      });

      return {
        ok: true,
        sourceKey,
        type: "virtual",
        data: {
          message: "Hello from virtual source",
          time: new Date().toISOString(),
        },
      };
    }

    if (source.type === "html") {
      const finalUrl = params.url || source.url;
      const response = await fetch(finalUrl);
      httpStatus = response.status;
      const text = await response.text();

      ok = response.ok;
      const durationMs = Date.now() - startedAt;

      await logSourceEvent({
        sourceKey,
        sourceType: source.type,
        httpStatus,
        ok,
        durationMs,
        params: { ...params, finalUrl },
        extra: ok
          ? { length: text.length }
          : { error: "HTML fetch not ok", bodyStart: text.slice(0, 200) },
      });

      return {
        ok,
        sourceKey,
        type: "html",
        httpStatus,
        htmlSnippet: text.slice(0, 500),
      };
    }

    if (source.type === "rss") {
      const finalUrl = params.url || source.url;
      const response = await fetch(finalUrl);
      httpStatus = response.status;
      const xml = await response.text();

      ok = response.ok;
      const durationMs = Date.now() - startedAt;

      await logSourceEvent({
        sourceKey,
        sourceType: source.type,
        httpStatus,
        ok,
        durationMs,
        params: { ...params, finalUrl },
        extra: ok
          ? { length: xml.length }
          : { error: "RSS fetch not ok", bodyStart: xml.slice(0, 200) },
      });

      // Пока без полноценного парсинга RSS — только кусок XML
      return {
        ok,
        sourceKey,
        type: "rss",
        httpStatus,
        xmlSnippet: xml.slice(0, 500),
      };
    }

    if (source.type === "coingecko") {
      const baseUrl = source.url || "https://api.coingecko.com/api/v3/simple/price";

      // ids и vs_currencies можем получать из config или params
      const config = source.config || {};
      const ids =
        (params.ids && params.ids.join(",")) ||
        (config.ids && config.ids.join(",")) ||
        "bitcoin,ethereum";
      const vs =
        (params.vs_currencies && params.vs_currencies.join(",")) ||
        (config.vs_currencies && config.vs_currencies.join(",")) ||
        "usd";

      const url = `${baseUrl}?ids=${encodeURIComponent(
        ids
      )}&vs_currencies=${encodeURIComponent(vs)}`;

      const response = await fetch(url);
      httpStatus = response.status;
      const json = await response.json();
      ok = response.ok;

      const durationMs = Date.now() - startedAt;

      await logSourceEvent({
        sourceKey,
        sourceType: source.type,
        httpStatus,
        ok,
        durationMs,
        params: { ...params, finalUrl: url, ids, vs_currencies: vs },
        extra: ok ? { keys: Object.keys(json || {}) } : { errorBody: json },
      });

      return {
        ok,
        sourceKey,
        type: "coingecko",
        httpStatus,
        data: json,
      };
    }

    // Если тип неизвестен
    const durationMs = Date.now() - startedAt;
    await logSourceEvent({
      sourceKey,
      sourceType: source.type,
      httpStatus: null,
      ok: false,
      durationMs,
      params,
      extra: { error: "UNKNOWN_SOURCE_TYPE" },
    });

    return {
      ok: false,
      sourceKey,
      error: `Неизвестный тип источника: ${source.type}`,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;

    await logSourceEvent({
      sourceKey,
      sourceType,
      httpStatus,
      ok: false,
      durationMs,
      params,
      extra: { error: err.message || String(err) },
    });

    console.error(`❌ Error in fetchFromSourceKey(${sourceKey}):`, err);

    return {
      ok: false,
      sourceKey,
      error: "Ошибка при обращении к источнику",
      details: err.message || String(err),
    };
  }
}
