        case "/file_logs": {
          if (!bypass) {
            await bot.sendMessage(chatId, "Эта команда доступна только монарху GARYA.");
            return;
          }

          const n = Number((rest || "").trim()) || 10;
          const rows = await getRecentFileIntakeLogs(chatIdStr, n);

          if (!rows.length) {
            await bot.sendMessage(chatId, "file_intake_logs пусто (пока нет записей).");
            return;
          }

          let out = `🧾 File-Intake logs (last ${Math.min(Number(n) || 10, 30)})\n\n`;
          for (const r of rows) {
            out += `#${r.id} | ${new Date(r.created_at).toISOString()}\n`;
            out += `kind=${r.kind || "?"} hasText=${r.has_text} shouldAI=${r.should_call_ai} direct=${r.direct_reply}\n`;
            out += `aiCalled=${r.ai_called} aiError=${r.ai_error} textChars=${r.processed_text_chars}\n`;
            if (r.file_name || r.mime_type || r.file_size) {
              out += `file=${r.file_name || "-"} mime=${r.mime_type || "-"} size=${r.file_size || "-"}\n`;
            }
            out += `\n`;
          }

          await bot.sendMessage(chatId, out.slice(0, 3800));
          return;
        }
