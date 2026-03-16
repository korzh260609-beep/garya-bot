// src/sources/manualTestFetchCoingeckoMarketChart.js

import { fetchCoinGeckoMarketChart } from "./fetchCoingeckoMarketChart.js";

async function testFetchCoingeckoMarketChart() {
  try {
    const input = {
      coinId: "bitcoin",
      vsCurrency: "usd",
      days: "7",
    };

    console.log("Запуск чистого теста fetchCoinGeckoMarketChart...");
    console.log("Вход:", input);

    const result = await fetchCoinGeckoMarketChart(input);

    console.log("Результат вызова fetchCoinGeckoMarketChart:");
    console.dir(result, { depth: 5 });

    if (
      result &&
      result.ok &&
      result.sourceKey === "coingecko_market_chart" &&
      result.meta &&
      result.meta.parsed &&
      Array.isArray(result.meta.parsed.prices) &&
      result.meta.parsed.prices.length > 0
    ) {
      console.log("Тест успешно завершён: historical data получены.");
    } else {
      console.error("Тест завершился с ошибкой или без historical data.");
    }
  } catch (error) {
    console.error("Ошибка во время теста:", error);
  }
}

testFetchCoingeckoMarketChart();
