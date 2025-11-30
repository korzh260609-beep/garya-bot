// sources.js
// ЭТАП 5 — SOURCES LAYER: HTTP-доступ, RSS/Web/API, fetchFromSource

import axios from "axios";
import { parseStringPromise } from "xml2js";
import pool from "./db.js";

// === Типы источников ===
export const SOURCE_TYPES = {
  API_JSON: "api_json", // JSON API (CoinGecko, кастомные API и т.п.)
  RSS: "rss",           // RSS-ленты
  HTML: "html",         // Обычные веб-страницы (сырое HTML)
};

// === Вспомогательные функции работы с БД ===

// Получить все источники (для команды /sources)
export async function getAllSources() {
  const result = await pool.query(
    `
      SELECT id, key, name, type, url, is_active, config
      FROM sources
      ORDER BY id ASC
    `
  );

  return result.rows;
}

// Получить один источник по key
export async function getSourceByKey(key) {
  const result = await pool.query(
    `
      SELECT id, key, name, type, url, is_active, config
      FROM sources
      WHERE key = $1
      LIMIT 1
    `,
    [key]
  );

  return result.rows[0] || null;
}

// === Универсальный вход: fetchFromSource по key ===
//
// Используется остальными слоями (Task Engine, команды, отчёты).
//
export async function fetchFromSourceKey(key, params = {}) {
  const source = await getSourceByKey(key);

  if (!source) {
    throw new Error(`Source with key="${key}" not found`);
  }

  if (source.is_active === false) {
    throw new Error(`Source "${key}" is inactive`);
  }

  return fetchFromSource(source, params);
}

// === Универсальный fetch по объекту источника ===
//
// source: { id, key, name, type, url, is_active, config }
// params: для доп. параметров (например, query, limit и т.п.)
//
export async function fetchFromSource(source, params = {}) {
  const type = source.type;
  const url = buildUrlWithQuery(source.url, params.query || {});
  const config = source.config || {}; // JSONB из БД

  try {
    switch (type) {
      case SOURCE_TYPES.API_JSON:
        return await fetchJsonApi(url, config, params);

      case SOURCE_TYPES.RSS:
        return await fetchRss(url, config, params);

      case SOURCE_TYPES.HTML:
        return await fetchHtml(url, config, params);

      default:
        throw new Error(`Unsupported source type: ${type}`);
    }
  } catch (err) {
    // Базовая нормальная ошибка, чтобы не падал весь бот
    console.error(
      `❌ fetchFromSource error for key="${source.key}" type="${type}":`,
      err.message
    );

    // Возвращаем структурированный ответ — это важно для Task Engine
    return {
      ok: false,
      error: err.message || "Unknown error while fetching source",
      sourceKey: source.key,
      sourceType: type,
    };
  }
}

// === HTTP-хелперы ===

const DEFAULT_TIMEOUT_MS = 10000; // 10 секунд

function buildUrlWithQuery(baseUrl, queryObj) {
  if (!queryObj || Object.keys(queryObj).length === 0) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(queryObj)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// === 5.2.1 API_JSON ===
//
// Возвращаем:
// { ok: true, data: <JSON> }
// или { ok: false, error: "..." }
//
async function fetchJsonApi(url, config = {}, params = {}) {
  const axiosConfig = {
    method: "get",
    url,
    timeout: config.timeout_ms || DEFAULT_TIMEOUT_MS,
    headers: config.headers || {},
  };

  try {
    const response = await axios(axiosConfig);

    // БАЗОВОЕ ограничение размера: если объект слишком жирный,
    // можно потом в конфиге источника добавить поля фильтрации.
    return {
      ok: true,
      data: response.data,
      meta: {
        status: response.status,
        url,
        type: SOURCE_TYPES.API_JSON,
      },
    };
  } catch (err) {
    throw new Error(
      `API_JSON request failed: ${err.response?.status || ""} ${err.message}`
    );
  }
}

// === 5.2.2 RSS ===
//
// Возвращаем упрощённую структуру RSS:
// { ok: true, feed: { title, link, items: [...] }, meta: {...} }
//
// items = [{ title, link, publishedAt, description }]
//
async function fetchRss(url, config = {}, params = {}) {
  const axiosConfig = {
    method: "get",
    url,
    timeout: config.timeout_ms || DEFAULT_TIMEOUT_MS,
  };

  try {
    const response = await axios(axiosConfig);
    const xml = response.data;

    const parsed = await parseStringPromise(xml, {
      explicitArray: true,
      mergeAttrs: true,
      trim: true,
    });

    const channel = parsed?.rss?.channel?.[0] || parsed?.feed || {};

    const title =
      (channel.title && channel.title[0]) ||
      (parsed?.feed?.title && parsed.feed.title[0]) ||
      null;

    const link =
      (channel.link && channel.link[0]) ||
      (parsed?.feed?.link && parsed.feed.link[0]) ||
      null;

    const rawItems = channel.item || channel.entry || [];
    const maxItems = params.limit || config.max_items || 20;

    const items = rawItems.slice(0, maxItems).map((item) => {
      return {
        title: item.title?.[0] || null,
        link: item.link?.[0]?.href || item.link?.[0] || null,
        publishedAt:
          item.pubDate?.[0] ||
          item.updated?.[0] ||
          item.published?.[0] ||
          null,
        description:
          item.description?.[0] ||
          item.summary?.[0] ||
          item.content?.[0] ||
          null,
      };
    });

    return {
      ok: true,
      feed: {
        title,
        link,
        items,
      },
      meta: {
        url,
        type: SOURCE_TYPES.RSS,
        itemCount: items.length,
      },
    };
  } catch (err) {
    throw new Error(`RSS fetch/parse failed: ${err.message}`);
  }
}

// === 5.2.3 HTML ===
//
// Возвращаем сырой HTML (ограниченный по длине, чтобы не убить токены).
//
async function fetchHtml(url, config = {}, params = {}) {
  const axiosConfig = {
    method: "get",
    url,
    timeout: config.timeout_ms || DEFAULT_TIMEOUT_MS,
    headers: config.headers || {},
  };

  try {
    const response = await axios(axiosConfig);

    let html = response.data || "";
    const maxChars = params.max_chars || config.max_chars || 50000;

    if (typeof html === "string" && html.length > maxChars) {
      html = html.slice(0, maxChars) + "\n<!-- truncated -->";
    }

    return {
      ok: true,
      html,
      meta: {
        status: response.status,
        url,
        type: SOURCE_TYPES.HTML,
        length: typeof html === "string" ? html.length : null,
      },
    };
  } catch (err) {
    throw new Error(
      `HTML request failed: ${err.response?.status || ""} ${err.message}`
    );
  }
}
