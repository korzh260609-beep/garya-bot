// src/bot/router/projectMemoryCommands.js

export async function handleProjectMemoryCommands({
  cmdBase,
  bot,
  chatId,
  chatIdStr,
  rest,
  getProjectSection,
  upsertProjectSection,
  getProjectMemoryList,
}) {
  if (cmdBase === "/pm_show") {
    const section = (rest || "").trim();
    if (!section) {
      await bot.sendMessage(chatId, "Использование: /pm_show <section>");
      return true;
    }

    const SAFE_LIMIT = 3800;

    function chunkText(text, limit) {
      const s = String(text || "");
      if (!s) return [""];

      const parts = [];
      let i = 0;

      while (i < s.length) {
        parts.push(s.slice(i, i + limit));
        i += limit;
      }

      return parts;
    }

    try {
      const rec = await getProjectSection(undefined, section);
      if (!rec) {
        await bot.sendMessage(chatId, `Секция "${section}" отсутствует.`);
        return true;
      }

      const content = String(rec.content || "");
      const headerBase = `🧠 Project Memory: ${rec.section}\n\n`;

      if (headerBase.length + content.length <= SAFE_LIMIT) {
        await bot.sendMessage(chatId, headerBase + content);
        return true;
      }

      const chunks = chunkText(content, SAFE_LIMIT);
      const total = chunks.length;

      const finalParts = [];
      let cursor = 0;

      for (let partIndex = 1; cursor < content.length; partIndex++) {
        const partPrefix =
          `🧠 Project Memory: ${rec.section}\n` +
          `часть ${partIndex}/${Math.max(1, total)}\n\n`;

        const available = Math.max(500, SAFE_LIMIT - partPrefix.length);
        finalParts.push(content.slice(cursor, cursor + available));
        cursor += available;
      }

      const finalTotal = finalParts.length;

      for (let idx = 0; idx < finalTotal; idx++) {
        const partPrefix =
          `🧠 Project Memory: ${rec.section}\n` +
          `часть ${idx + 1}/${finalTotal}\n\n`;

        await bot.sendMessage(chatId, partPrefix + finalParts[idx]);
      }
    } catch (e) {
      console.error("❌ /pm_show error:", e);
      await bot.sendMessage(chatId, "⚠️ Ошибка чтения Project Memory.");
    }

    return true;
  }

  if (cmdBase === "/pm_set") {
    const bypass = true;

    if (!bypass) {
      await bot.sendMessage(chatId, "Только монарх может менять Project Memory.");
      return true;
    }

    const parts = (rest || "").trim().split(/\s+/);
    const section = parts.shift();
    const content = parts.join(" ").trim();

    if (!section || !content) {
      await bot.sendMessage(
        chatId,
        "Использование: /pm_set <section> <text>\n(Можно с переносами строк)"
      );
      return true;
    }

    try {
      await upsertProjectSection({
        section,
        title: null,
        content,
        tags: [],
        meta: { setBy: chatIdStr },
        schemaVersion: 1,
      });

      await bot.sendMessage(chatId, `✅ Обновлено: ${section}`);
    } catch (e) {
      console.error("❌ /pm_set error:", e);
      await bot.sendMessage(chatId, "⚠️ Ошибка записи Project Memory.");
    }

    return true;
  }

  if (cmdBase === "/pm_list") {
    const raw = String(rest || "").trim();
    const sectionFilter = raw ? raw.split(/\s+/)[0].trim() : null;

    try {
      if (typeof getProjectMemoryList !== "function") {
        await bot.sendMessage(chatId, "⚠️ getProjectMemoryList недоступен.");
        return true;
      }

      const rows = await getProjectMemoryList(undefined, sectionFilter || null);

      if (!rows || rows.length === 0) {
        const msg = sectionFilter
          ? `🧠 Project Memory: секция "${sectionFilter}" не найдена.`
          : "🧠 Project Memory: секций пока нет.";
        await bot.sendMessage(chatId, msg);
        return true;
      }

      const sections = [];
      const seen = new Set();

      for (const r of rows) {
        const s = String(r.section || "").trim();
        if (!s) continue;
        if (seen.has(s)) continue;
        seen.add(s);
        sections.push(s);
      }

      if (sectionFilter) {
        const msg = [
          `🧠 Project Memory: "${sectionFilter}"`,
          "",
          "✅ Есть записи (используй /pm_show " + sectionFilter + ")",
        ].join("\n");
        await bot.sendMessage(chatId, msg);
        return true;
      }

      const msg = ["🧠 Project Memory sections:", "", ...sections.map((s) => `• ${s}`)].join("\n");
      const out = msg.length > 3800 ? msg.slice(0, 3800) + "\n…(обрезано)" : msg;

      await bot.sendMessage(chatId, out);
    } catch (e) {
      console.error("❌ /pm_list error:", e);
      await bot.sendMessage(chatId, "⚠️ Ошибка чтения списка Project Memory.");
    }

    return true;
  }

  return false;
}