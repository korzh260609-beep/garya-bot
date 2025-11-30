// sources.js — слой источников (Sources Layer)
import pool from "./db.js";

/**
 * Возвращает все ВКЛЮЧЁННЫЕ источники из таблицы sources.
 * Используется командой /sources и в будущем — Task Engine.
 */
export async function listActiveSources() {
  try {
    const res = await pool.query(
      `
      SELECT id, key, name, type, url, is_enabled, created_at
      FROM sources
      WHERE is_enabled = TRUE
      ORDER BY id ASC
      `
    );
    return res.rows;
  } catch (err) {
    console.error("❌ Sources.listActiveSources DB error:", err);
    return [];
  }
}

/**
 * Находит один источник по key.
 */
export async function getSourceByKey(sourceKey) {
  try {
    const res = await pool.query(
      `
      SELECT id, key, name, type, url, config, is_enabled, created_at
      FROM sources
      WHERE key = $1
      LIMIT 1
      `,
      [sourceKey]
    );

    if (res.rows.length === 0) return null;
    return res.rows[0];
  } catch (err) {
    console.error("❌ Sources.getSourceByKey DB error:", err);
    return null;
  }
}

/**
 * Гарантирует, что в таблице sources есть несколько базовых
 * «шаблон-источников». Это не реальные подключения, а только
 * ЗАПИСИ в реестре, чтобы:
 *  - было что показать в /sources;
 *  - Task Engine мог потом ссылаться на них.
 *
 * ЧАСТИЧНО ЭТАП 5.2:
 *  - добавлен первый реальный источник coingecko_ping (публичный API).
 *
 * ВАЖНО: здесь НЕТ приватных API-ключей.
 */
export async function ensureDefaultSources() {
  const defaults = [
    {
      key: "generic_web_search",
      name: "Общедоступный веб-поиск",
      type: "virtual",
      url: null,
      config: {
        note:
          "Шаблон источника: общедоступные сайты и статьи. " +
          "Реальные HTTP-запросы появятся на ЭТАПЕ 5.",
      },
    },
    {
      key: "generic_news_feed",
      name: "Общедоступные новостные ленты",
      type: "virtual",
      url: null,
      config: {
        note:
          "Шаблон для новостных RSS/ленточек без приватных ключей. " +
          "Будет реализован на ЭТАПЕ 5.",
      },
    },
    {
      key: "generic_public_markets",
      name: "Публичные рыночные данные (без ключей)",
      type: "virtual",
      url: null,
      config: {
        note:
          "CoinGecko и другие открытые API без авторизации. " +
          "Будут подключены позже, когда понадобится.",
      },
    },
    // 🔵 ЭТАП 5.2 — первый реальный источник
    {
      key: "coingecko_ping",
      name: "CoinGecko API — ping",
      type: "http_json",
      url: "https://api.coingecko.com/api/v3/ping",
      config: {
        note:
          "Публичный эндпоинт CoinGecko без авторизации. " +
          "Используется как тестовый источник для проверки HTTP-запросов.",
      },
    },
  ];

  try {
    for (const s of defaults) {
      await pool.query(
        `
        INSERT INTO sources (key, name, type, url, config)
        VALUES ($1,       $2,   $3,  $4,  $5)
        ON CONFLICT (key) DO UPDATE
        SET
          name       = EXCLUDED.name,
          type       = EXCLUDED.type,
          url        = EXCLUDED.url,
          config     = EXCLUDED.config,
          updated_at = NOW()
        `,
        [s.key, s.name, s.type, s.url, s.config]
      );
    }

    console.log("📡 Sources: default templates are ready.");
  } catch (err) {
    console.error("❌ Sources.ensureDefaultSources error:", err);
  }
}

/**
 * ЭТАП 5.2 — первая реальная реализация fetchFromSource.
 *
 * Сейчас поддерживается:
 *  - type = 'http_json' — простой HTTP GET, ожидаем JSON.
 *
 * Остальные типы пока возвращают честную заглушку.
 */
export async function fetchFromSource(sourceKey, params = {}) {
  try {
    const src = await getSourceByKey(sourceKey);

    if (!src) {
      return {
        ok: false,
        sourceKey,
        params,
        error: "Источник не найден в реестре sources.",
      };
    }

    if (!src.is_enabled) {
      return {
        ok: false,
        sourceKey,
        params,
        error: "Источник найден, но выключен (is_enabled = false).",
      };
    }

    // Виртуальные источники без URL — это только шаблоны
    if (!src.url) {
      return {
        ok: false,
        sourceKey,
        params,
        warning:
          "Этот источник является только шаблоном (type='virtual', url=null). " +
          "Реальный запрос к нему не выполняется.",
      };
    }

    // Простой кейс: HTTP JSON без авторизации
    if (src.type === "http_json") {
      const res = await fetch(src.url); // Node 18+ имеет глобальный fetch
      const text = await res.text();

      let json = null;
      try {
        json = JSON.parse(text);
      } catch (_) {
        // если не JSON — оставляем json = null
      }

      return {
        ok: res.ok,
        status: res.status,
        sourceKey,
        url: src.url,
        type: src.type,
        json,
        rawText: json ? undefined : text, // текст только если не распарсили JSON
      };
    }

    // Остальные типы пока не реализованы — честная заглушка
    return {
      ok: false,
      sourceKey,
      params,
      type: src.type,
      warning:
        "Тип источника пока не поддержан в fetchFromSource (ЭТАП 5.2). " +
        "Поддержан только type='http_json'.",
    };
  } catch (err) {
    console.error("❌ fetchFromSource error:", err);
    return {
      ok: false,
      sourceKey,
      params,
      error: "Внутренняя ошибка при выполнении fetchFromSource.",
    };
  }
}
