// src/bot/handlers/chat/robotPrice.js

export function normalizeTextForRobot(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function detectRequestedCoinIdsFromText(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return [];

  const found = [];

  const rules = [
    { id: "bitcoin", label: "BTC", signals: ["bitcoin", "btc", "биткоин", "біткоїн"] },
    { id: "ethereum", label: "ETH", signals: ["ethereum", "eth", "эфир", "ефир", "ефір"] },
    { id: "binancecoin", label: "BNB", signals: ["binance", "bnb"] },
    { id: "solana", label: "SOL", signals: ["solana", "sol"] },
    { id: "ripple", label: "XRP", signals: ["ripple", "xrp"] },
    { id: "toncoin", label: "TON", signals: ["toncoin", "ton"] },
    { id: "avalanche-2", label: "AVAX", signals: ["avalanche", "avax"] },
    { id: "aptos", label: "APT", signals: ["aptos", "apt"] },
    { id: "hedera-hashgraph", label: "HBAR", signals: ["hedera", "hbar"] },
    { id: "ondo-finance", label: "ONDO", signals: ["ondo"] },
    { id: "sei-network", label: "SEI", signals: ["sei"] },
    { id: "sui", label: "SUI", signals: ["sui"] },
    { id: "tether", label: "USDT", signals: ["tether", "usdt"] },
  ];

  for (const rule of rules) {
    if (rule.signals.some((signal) => t.includes(signal))) {
      found.push(rule.id);
    }
  }

  return [...new Set(found)];
}

export function getCoinLabel(coinId) {
  const map = {
    bitcoin: "BTC",
    ethereum: "ETH",
    binancecoin: "BNB",
    solana: "SOL",
    ripple: "XRP",
    toncoin: "TON",
    "avalanche-2": "AVAX",
    aptos: "APT",
    "hedera-hashgraph": "HBAR",
    "ondo-finance": "ONDO",
    "sei-network": "SEI",
    sui: "SUI",
    tether: "USDT",
  };

  return map[String(coinId || "").trim().toLowerCase()] || String(coinId || "").trim().toUpperCase();
}

export function detectRequestedVsCurrenciesFromText(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return [];

  const found = [];

  if (t.includes("usd") || t.includes("доллар") || t.includes("долар") || t.includes("usdt")) {
    found.push("usd");
  }
  if (t.includes("eur") || t.includes("euro") || t.includes("евро") || t.includes("євро")) {
    found.push("eur");
  }
  if (t.includes("uah") || t.includes("грн") || t.includes("hryvnia")) {
    found.push("uah");
  }

  return [...new Set(found)];
}

export function isSimplePriceIntent(text = "") {
  const t = normalizeTextForRobot(text).toLowerCase();
  if (!t) return false;

  const priceSignals = [
    "цена",
    "курс",
    "сколько стоит",
    "скільки коштує",
    "price",
    "cost",
    "worth",
    "сколько сейчас",
    "скільки зараз",
  ];

  const complexSignals = [
    "почему",
    "чому",
    "why",
    "прогноз",
    "forecast",
    "predict",
    "анализ",
    "analysis",
    "разбор",
    "trend",
    "тренд",
    "новости",
    "news",
    "график",
    "chart",
    "индикатор",
    "indicator",
    "support",
    "resistance",
    "сопротивление",
    "поддержка",
    "buy",
    "sell",
    "лонг",
    "шорт",
    "entry",
    "sl",
    "tp",
    "сигнал",
    "signal",
    "сравни",
    "compare",
    "vs",
    "против",
    "лучше",
    "хуже",
    "капитализация",
    "market cap",
    "volume",
    "объем",
    "объём",
  ];

  if (complexSignals.some((signal) => t.includes(signal))) {
    return false;
  }

  const hasCoin = detectRequestedCoinIdsFromText(t).length > 0;
  const hasPriceWord = priceSignals.some((signal) => t.includes(signal));

  if (!hasCoin) return false;

  if (hasPriceWord) return true;

  const compactCoinOnly = /^[a-zа-яіїє0-9\s?,.!/-]{1,40}$/i.test(t);
  return compactCoinOnly;
}

export function formatRobotNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";

  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Math.abs(value) >= 1) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (Math.abs(value) >= 0.01) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 6,
    maximumFractionDigits: 8,
  }).format(value);
}

export function formatRobotPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatRobotUpdatedAt(value) {
  if (!value) return null;

  try {
    const date =
      typeof value === "number" && Number.isFinite(value)
        ? new Date(value * 1000)
        : new Date(value);

    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
  } catch (_) {
    return null;
  }
}

export function tryBuildRobotPriceReply({ text = "", sourceCtx = null }) {
  const simpleIntent = isSimplePriceIntent(text);

  const parsed = sourceCtx?.sourceResult?.meta?.parsed;
  const parsedKeys =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.keys(parsed)
      : [];

  const requestedCoinIds = detectRequestedCoinIdsFromText(text);
  const requestedVs = detectRequestedVsCurrenciesFromText(text);

  try {
    console.info("ROBOT_PRICE_DEBUG_INPUT", {
      text,
      simpleIntent,
      sourceResultOk: sourceCtx?.sourceResult?.ok === true,
      sourceResultKey: sourceCtx?.sourceResult?.sourceKey || null,
      requestedCoinIds,
      requestedVs,
      parsedKeys,
      fetchedAt: sourceCtx?.sourceResult?.fetchedAt || null,
      reason: sourceCtx?.reason || null,
    });
  } catch (_) {}

  if (!simpleIntent) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "not_simple_price_intent",
        text,
      });
    } catch (_) {}
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "parsed_missing_or_invalid",
        hasParsed: Boolean(parsed),
        parsedType: Array.isArray(parsed) ? "array" : typeof parsed,
      });
    } catch (_) {}
    return null;
  }

  if (sourceCtx?.sourceResult?.ok !== true) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "source_result_not_ok",
        sourceResultOk: sourceCtx?.sourceResult?.ok === true,
        sourceReason: sourceCtx?.reason || null,
      });
    } catch (_) {}
    return null;
  }

  if (!requestedCoinIds.length) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "no_requested_coin_ids",
      });
    } catch (_) {}
    return null;
  }

  const lines = [];
  let builtCount = 0;
  let updatedAtText = null;

  for (const coinId of requestedCoinIds) {
    const coinBlock = parsed?.[coinId];

    try {
      console.info("ROBOT_PRICE_DEBUG_COIN", {
        coinId,
        existsInParsed: Boolean(coinBlock),
        availableKeys: coinBlock && typeof coinBlock === "object" ? Object.keys(coinBlock) : [],
      });
    } catch (_) {}

    if (!coinBlock || typeof coinBlock !== "object") continue;

    const availableVs = Object.keys(coinBlock).filter((key) => key !== "lastUpdatedAt");
    if (!availableVs.length) continue;

    const chosenVs =
      requestedVs.length > 0
        ? requestedVs.filter((vs) => availableVs.includes(vs))
        : [availableVs[0]];

    try {
      console.info("ROBOT_PRICE_DEBUG_VS", {
        coinId,
        availableVs,
        requestedVs,
        chosenVs,
      });
    } catch (_) {}

    if (!chosenVs.length) continue;

    const coinLabel = getCoinLabel(coinId);

    for (const vs of chosenVs) {
      const row = coinBlock?.[vs];
      if (!row || typeof row !== "object") continue;

      const price = formatRobotNumber(row.price);
      const change = formatRobotPercent(row.change24h);
      const changePart = change ? ` | 24ч: ${change}` : "";

      lines.push(`${coinLabel}: ${price} ${vs.toUpperCase()}${changePart}`);
      builtCount += 1;
    }

    if (!updatedAtText) {
      updatedAtText = formatRobotUpdatedAt(coinBlock?.lastUpdatedAt || sourceCtx?.sourceResult?.fetchedAt);
    }
  }

  if (builtCount === 0) {
    try {
      console.info("ROBOT_PRICE_DEBUG_SKIP", {
        reason: "built_count_zero",
        requestedCoinIds,
        requestedVs,
        parsedKeys,
      });
    } catch (_) {}
    return null;
  }

  if (updatedAtText) {
    lines.push(`Обновлено: ${updatedAtText}`);
  }

  const reply = lines.join("\n");

  try {
    console.info("ROBOT_PRICE_DEBUG_SUCCESS", {
      builtCount,
      reply,
    });
  } catch (_) {}

  return reply;
}