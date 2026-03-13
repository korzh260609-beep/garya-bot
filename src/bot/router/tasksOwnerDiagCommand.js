// src/bot/router/tasksOwnerDiagCommand.js

export async function handleTasksOwnerDiagCommand({
  pool,
  ctxReply,
  cmdBase,
}) {
  try {
    const colRes = await pool.query(
      `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'tasks'
        AND column_name = 'user_global_id'
      LIMIT 1
      `
    );

    const hasUserGlobalId = (colRes.rows?.length || 0) > 0;

    const summaryQuery = hasUserGlobalId
      ? `
        SELECT
          COUNT(*)::int AS total,
          SUM(CASE WHEN user_global_id IS NULL OR user_global_id = '' THEN 1 ELSE 0 END)::int AS global_id_missing
        FROM tasks
      `
      : `
        SELECT
          COUNT(*)::int AS total
        FROM tasks
      `;

    const sumRes = await pool.query(summaryQuery);
    const s = sumRes.rows?.[0] || {};

    const listQuery = hasUserGlobalId
      ? `
        SELECT id, type, status, user_global_id, created_at, last_run
        FROM tasks
        ORDER BY id DESC
        LIMIT 20
      `
      : `
        SELECT id, type, status, created_at, last_run
        FROM tasks
        ORDER BY id DESC
        LIMIT 20
      `;

    const listRes = await pool.query(listQuery);
    const rows = listRes.rows || [];

    const lines = [];
    lines.push("🧪 TASKS OWNER DIAG");
    lines.push(
      `has tasks.user_global_id: ${hasUserGlobalId ? "YES" : "NO"}`
    );
    lines.push(`total tasks: ${s.total ?? 0}`);
    if (hasUserGlobalId)
      lines.push(`missing user_global_id: ${s.global_id_missing ?? 0}`);
    lines.push("");
    lines.push("Last 20 tasks:");

    for (const r of rows) {
      const created = r.created_at
        ? new Date(r.created_at).toISOString()
        : "—";
      const lastRun = r.last_run
        ? new Date(r.last_run).toISOString()
        : "—";
      if (hasUserGlobalId) {
        lines.push(
          `#${r.id} | ${r.type} | ${r.status} | global=${
            r.user_global_id || "—"
          } | created=${created} | last_run=${lastRun}`
        );
      } else {
        lines.push(
          `#${r.id} | ${r.type} | ${r.status} | created=${created} | last_run=${lastRun}`
        );
      }
    }

    await ctxReply(lines.join("\n").slice(0, 3800), {
      cmd: cmdBase,
      handler: "messageRouter",
    });
  } catch (e) {
    console.error("❌ /tasks_owner_diag error:", e);
    await ctxReply(
      "⚠️ /tasks_owner_diag упал. Проверь: есть ли таблица tasks и применена ли миграция (колонка user_global_id).",
      { cmd: cmdBase, handler: "messageRouter" }
    );
  }
}