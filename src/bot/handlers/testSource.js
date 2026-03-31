// src/bot/handlers/testSource.js
// aligned with testSource(key, options)

export async function handleTestSource({
  bot,
  chatId,
  rest,
  testSource,
  userRole,
  userPlan,
  bypass,
}) {
  const key = (rest || "").trim();

  if (!key) {
    await bot.sendMessage(chatId, "Использование: /test_source <source_key>");
    return;
  }

  const result = await testSource(key, {
    userRole,
    userPlan,
    ignoreRateLimit: false,
  });

  if (!result?.ok) {
    await bot.sendMessage(
      chatId,
      [
        "❌ Источник не прошёл тест",
        `key: ${result?.sourceKey || key}`,
        `reason: ${result?.reason || "unknown"}`,
        `httpStatus: ${
          typeof result?.httpStatus === "number" ? result.httpStatus : "n/a"
        }`,
        `latencyMs: ${
          typeof result?.latencyMs === "number" ? result.latencyMs : "n/a"
        }`,
        `fromCache: ${result?.fromCache === true ? "yes" : "no"}`,
        result?.error ? `error: ${result.error}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    [
      "✅ Источник работает",
      `key: ${result?.sourceKey || key}`,
      `reason: ${result?.reason || "ok"}`,
      `httpStatus: ${
        typeof result?.httpStatus === "number" ? result.httpStatus : "n/a"
      }`,
      `latencyMs: ${
        typeof result?.latencyMs === "number" ? result.latencyMs : "n/a"
      }`,
      `bytes: ${typeof result?.bytes === "number" ? result.bytes : 0}`,
      `fromCache: ${result?.fromCache === true ? "yes" : "no"}`,
    ].join("\n")
  );
}