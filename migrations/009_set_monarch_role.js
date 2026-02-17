// migrations/009_set_monarch_role.js
// STAGE 4.x — Ensure monarch role for MONARCH_USER_ID (safe migration)

export async function up(pgm) {
  const monarchId = String(process.env.MONARCH_USER_ID || "").trim();
  if (!monarchId) return;

  // 1) tg_user_id match
  pgm.sql(
    `
    UPDATE users
    SET role = 'monarch'
    WHERE tg_user_id = $1
    `,
    [monarchId]
  );

  // 2) global_user_id match tg:<id>
  pgm.sql(
    `
    UPDATE users
    SET role = 'monarch'
    WHERE global_user_id = $1
    `,
    [`tg:${monarchId}`]
  );
}

export async function down(pgm) {
  // Forward-only policy: do nothing
}
