// migrations/009_set_monarch_role.js
// STAGE 4.x — Ensure monarch role for MONARCH_USER_ID (safe migration)

export async function up(pgm) {
  const monarchId = String(process.env.MONARCH_USER_ID || "").trim();
  if (!monarchId) return;

  const globalId = `tg:${monarchId}`;

  // ⚠️ В миграциях нельзя использовать $1 параметры — только прямой SQL

  pgm.sql(`
    UPDATE users
    SET role = 'monarch'
    WHERE tg_user_id = '${monarchId}'
  `);

  pgm.sql(`
    UPDATE users
    SET role = 'monarch'
    WHERE global_user_id = '${globalId}'
  `);
}

export async function down(pgm) {
  // forward-only
}
