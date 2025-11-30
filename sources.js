// sources.js — скелет слоя источников (Sources Layer)
import pool from "./db.js";

/**
 * Возвращает все ВКЛЮЧЁННЫЕ источники из таблицы sources.
 * Используется командой /sources и в будущем — Task Engine.
 */
export async function listActiveSources() {
  try {
    const res = await pool.query(
      `
      SELECT id, key, name, type, url, is_enabled, created_at, config
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
 * Гарантирует, что в таблице sources есть несколько базовых
 * «шаблон-источников». Это не реальные подключения, а только
 * ЗАПИСИ в реестре, чтобы:
 *  - было что показать в /sources;
 *  - Task Engine мог потом ссылаться на них.
 *
 * ВАЖНО: здесь НЕТ приватных API-ключей и НЕТ реальных запросов.
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
 * Общая заглушка для будущего реального запроса к источнику.
 * Сейчас НИЧЕГО не ходит в интернет, только честно говорит:
 * «здесь будет реальный запрос позже».
 */
export async function fetchFromSource(sourceKey, params = {}) {
  return {
    ok: false,
    sourceKey,
    params,
    warning:
      "Скелет Sources Layer: реальный запрос к источнику ещё не реализован. " +
      "На ЭТАПЕ 5 здесь появится HTTP-GET/POST к общедоступным ресурсам.",
  };
}

/**
 * Основная функция для бота и Task Engine:
 * найти источник по key в БД и вернуть структурированный результат.
 *
 * Сейчас:
 *  - НИЧЕГО не запрашивает из интернета;
 *  - просто достаёт запись из таблицы sources и отдаёт meta+note;
 *  - если ключ неизвестен или источник выключен — ok: false + error.
 *
 * Позже сюда добавим реальный HTTP-код для разных типов источников.
 */
export async function fetchFromSourceKey(key, params = {}) {
  const trimmedKey = (key || "").trim();

  if (!trimmedKey) {
    return {
      ok: false,
      error: "Ключ источника пустой.",
    };
  }

  try {
    const res = await pool.query(
      `
      SELECT id, key, name, type, url, is_enabled, config
      FROM sources
      WHERE key = $1
      LIMIT 1
      `,
      [trimmedKey]
    );

    if (res.rows.length === 0) {
      return {
        ok: false,
        error: `Источник с ключом "${trimmedKey}" не найден в реестре.`,
      };
    }

    const src = res.rows[0];

    if (!src.is_enabled) {
      return {
        ok: false,
        error: `Источник "${trimmedKey}" существует, но сейчас выключен (is_enabled = false).`,
      };
    }

    // Пока что возвращаем только метаданные и заметку из config.
    // Тут НЕ должно быть приватных ключей.
    const config = src.config || {};
    const note =
      config.note ||
      "Скелет Sources Layer: для этого источника ещё нет реального HTTP-запроса.";

    return {
      ok: true,
      meta: {
        id: src.id,
        key: src.key,
        name: src.name,
        type: src.type,
        url: src.url,
      },
      params,
      data: {
        note,
      },
    };
  } catch (err) {
    console.error("❌ Sources.fetchFromSourceKey DB error:", err);
    return {
      ok: false,
      error: "DB error при попытке получить источник по ключу.",
    };
  }
}
