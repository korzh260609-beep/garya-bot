        case "/source": {
          const key = (rest || "").trim();
          if (!key) {
            await bot.sendMessage(chatId, "Использование: /source <key>");
            return;
          }

          const result = await fetchFromSourceKey(key, {
            userRole,
            userPlan,
            bypassPermissions: bypass,
          });

          if (!result.ok) {
            await bot.sendMessage(
              chatId,
              `❌ Ошибка при обращении к источнику <code>${key}</code>:\n<code>${
                result.error || "Unknown error"
              }</code>`,
              { parse_mode: "HTML" }
            );
            return;
          }
