// src/bot/router/chatDiagCommand.js

export async function handleChatDiagCommand({
  pool,
  ctxReply,
  cmdBase,
}) {
  try {
    const chatsCountRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM chats`
    );
    const linksCountRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM user_chat_links`
    );

    const lastChatRes = await pool.query(
      `
      SELECT chat_id, transport, chat_type, title, updated_at, last_seen_at
      FROM chats
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 1
      `
    );

    const lastLinkRes = await pool.query(
      `
      SELECT global_user_id, chat_id, transport, created_at, last_seen_at
      FROM user_chat_links
      ORDER BY COALESCE(last_seen_at, created_at) DESC NULLS LAST
      LIMIT 1
      `
    );

    const lastChatsRes = await pool.query(
      `
      SELECT chat_id, transport, chat_type, title, updated_at, last_seen_at
      FROM chats
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 5
      `
    );

    const lastLinksRes = await pool.query(
      `
      SELECT global_user_id, chat_id, transport, created_at, last_seen_at
      FROM user_chat_links
      ORDER BY COALESCE(last_seen_at, created_at) DESC NULLS LAST
      LIMIT 5
      `
    );

    const chatsTotal = chatsCountRes.rows?.[0]?.n ?? 0;
    const linksTotal = linksCountRes.rows?.[0]?.n ?? 0;

    const lc = lastChatRes.rows?.[0] || null;
    const ll = lastLinkRes.rows?.[0] || null;

    const lastChats = lastChatsRes.rows || [];
    const lastLinks = lastLinksRes.rows || [];

    const fmtTs = (v) => (v ? new Date(v).toISOString() : "—");

    const out = [];
    out.push("🧩 CHAT DIAG");
    out.push(`chats_total: ${chatsTotal}`);
    out.push(`links_total: ${linksTotal}`);
    out.push("");

    out.push("last_chat:");
    if (!lc) {
      out.push("—");
    } else {
      out.push(
        [
          `chat_id=${lc.chat_id}`,
          `transport=${lc.transport || "—"}`,
          `type=${lc.chat_type || "—"}`,
          `title=${lc.title || "—"}`,
          `updated_at=${fmtTs(lc.updated_at)}`,
          `last_seen_at=${fmtTs(lc.last_seen_at)}`,
        ].join(" | ")
      );
    }

    out.push("");
    out.push("last_link:");
    if (!ll) {
      out.push("—");
    } else {
      out.push(
        [
          `global_user_id=${ll.global_user_id}`,
          `chat_id=${ll.chat_id}`,
          `transport=${ll.transport || "—"}`,
          `created_at=${fmtTs(ll.created_at)}`,
          `last_seen_at=${fmtTs(ll.last_seen_at)}`,
        ].join(" | ")
      );
    }

    out.push("");
    out.push("last_5_chats:");
    if (!lastChats.length) {
      out.push("—");
    } else {
      let i = 0;
      for (const r of lastChats) {
        i += 1;
        out.push(
          [
            `${i})`,
            `chat_id=${r.chat_id}`,
            `type=${r.chat_type || "—"}`,
            `title=${r.title || "—"}`,
            `updated_at=${fmtTs(r.updated_at)}`,
            `last_seen_at=${fmtTs(r.last_seen_at)}`,
          ].join(" ")
        );
      }
    }

    out.push("");
    out.push("last_5_links:");
    if (!lastLinks.length) {
      out.push("—");
    } else {
      let i = 0;
      for (const r of lastLinks) {
        i += 1;
        out.push(
          [
            `${i})`,
            `global_user_id=${r.global_user_id}`,
            `chat_id=${r.chat_id}`,
            `created_at=${fmtTs(r.created_at)}`,
            `last_seen_at=${fmtTs(r.last_seen_at)}`,
          ].join(" ")
        );
      }
    }

    await ctxReply(out.join("\n").slice(0, 3800), {
      cmd: cmdBase,
      handler: "messageRouter",
    });
  } catch (e) {
    console.error("❌ /chat_diag error:", e);
    await ctxReply(
      "⚠️ /chat_diag упал. Проверь: применена ли миграция 027 (таблицы chats и user_chat_links).",
      { cmd: cmdBase, handler: "messageRouter" }
    );
  }
}