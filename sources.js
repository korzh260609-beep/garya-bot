// sources.js — слой источников (Sources Layer)
import pool from "./db.js";
import fetch from "node-fetch";      // HTTP-запросы
import * as cheerio from "cheerio";  // парсинг HTML и XML (RSS)

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
 * «шаблон-источников» + реальные примеры HTML и RSS.
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
    // === REAL HTML-ИСТОЧНИК ===
    {
      key: "html_example_page",
      name: "HTML-пример: example.com",
      type: "html",
      url: "https://example.com/",
      config: {
        note:
          "Пример HTML-источника. Берём страницу example.com и вытаскиваем <title> и первый <h1>.",
        selector_title: "title",
        selector_main: "h1",
      },
    },
    // === REAL RSS-ИСТОЧНИК ===
    {
      key: "rss_example_news",
      name: "RSS-пример: новости (Hacker News)",
      type: "rss",
      url: "https://hnrss.org/frontpage",
      config: {
        note:
          "Пример RSS-источника. Берём RSS Hacker News frontpage и вытаскиваем несколько последних новостей.",
        max_items: 5
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
 * Старый скелет, оставляем для совместимости.
 */
export async function fetchFromSource(sourceKey, params = {}) {
  return {
    ok: false,
    sourceKey,
    params,
    warning:
      "Скелет Sources Layer: используйте fetchFromSourceKey(). " +
      "Реальный запрос к источнику реализован в fetchFromSourceKey.",
  };
}

/**
 * Главная функция для работы с источниками.
 *
 * Сейчас умеет:
 *  - virtual: просто отдаёт note из config
 *  - html: реальный HTTP GET + парсинг <title> и первого <h1>
 *  - rss: реальный HTTP GET + парсинг RSS-ленты, список новостей
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

    const config = src.config || {};
    const note =
      config.note ||
      "Скелет Sources Layer: для этого источника ещё нет детальной логики.";

    // === ВЕТКА RSS-ИСТОЧНИКА ===
    if (src.type === "rss" && src.url) {
      try {
        const response = await fetch(src.url, {
          method: "GET",
          headers: {
            "User-Agent": "GARYA-AI-Agent/1.0 (+https://garya-bot.onrender.com)",
            Accept: "application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8",
          },
        });

        const status = response.status;
        const xml = await response.text();

        const $ = cheerio.load(xml, { xmlMode: true });

        const maxItems =
          typeof config.max_items === "number" ? config.max_items : 5;

        const items = [];
        $("item").slice(0, maxItems).each((i, el) => {
          const title = $(el).find("title").first().text().trim();
          const link = $(el).find("link").first().text().trim();
          const pubDate = $(el).find("pubDate").first().text().trim();

          if (title || link) {
            items.push({ title, link, pubDate });
          }
        });

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
            httpStatus: status,
            items,
          },
        };
      } catch (rssErr) {
        console.error("❌ Sources.fetchFromSourceKey RSS error:", rssErr);
        return {
          ok: false,
          error: "Ошибка при запросе или парсинге RSS-ленты.",
        };
      }
    }

    // === ВЕТКА HTML-ИСТОЧНИКА ===
    if (src.type === "html" && src.url) {
      try {
        const response = await fetch(src.url, {
          method: "GET",
          headers: {
            "User-Agent": "GARYA-AI-Agent/1.0 (+https://garya-bot.onrender.com)",
            Accept: "text/html,application/xhtml+xml",
          },
        });

        const status = response.status;
        const contentType = response.headers.get("content-type") || "";
        const html = await response.text();

        let parsed = {};
        try {
          const $ = cheerio.load(html);
          const titleSel = config.selector_title || "title";
          const mainSel = config.selector_main || "h1";

          const title = $(titleSel).first().text().trim();
          const main = $(mainSel).first().text().trim();

          parsed = { title, main };
        } catch (parseErr) {
          console.error("❌ Sources.fetchFromSourceKey parse error:", parseErr);
        }

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
            httpStatus: status,
            contentType,
            parsed,
            htmlPreview: html.slice(0, 500),
          },
        };
      } catch (httpErr) {
        console.error("❌ Sources.fetchFromSourceKey HTTP error:", httpErr);
        return {
          ok: false,
          error: "HTTP error при запросе HTML-страницы.",
        };
      }
    }

    // === VIRTUAL / ПРОЧИЕ ТИПЫ — только мета + note ===
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
