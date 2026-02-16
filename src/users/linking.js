import crypto from "crypto";
import pool from "../../db.js";

const CODE_TTL_MIN = Math.max(1, Number(process.env.LINK_CODE_TTL_MIN || 10));

function genCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

export async function createLinkCode({ provider = "telegram", providerUserId }) {
  const providerUserIdStr = String(providerUserId || "").trim();
  if (!providerUserIdStr) {
    return { ok: false, error: "provider_user_id_required" };
  }

  const globalUserId = `tg:${providerUserIdStr}`;
  const code = genCode();

  const res = await pool.query(
    `
    INSERT INTO identity_link_codes
      (code, global_user_id, provider, provider_user_id, status, expires_at)
    VALUES
      ($1, $2, $3, $4, 'pending', NOW() + ($5::text || ' minutes')::interval)
    RETURNING code, global_user_id, expires_at
    `,
    [code, globalUserId, provider, providerUserIdStr, String(CODE_TTL_MIN)]
  );

  return { ok: true, ...res.rows[0] };
}

export async function confirmLinkCode({ code, provider = "telegram", providerUserId }) {
  const codeNorm = String(code || "").trim().toUpperCase();
  const providerUserIdStr = String(providerUserId || "").trim();

  if (!codeNorm || !providerUserIdStr) {
    return { ok: false, error: "invalid_input" };
  }

  const lookup = await pool.query(
    `
    SELECT id, code, global_user_id, provider, provider_user_id, expires_at, status
    FROM identity_link_codes
    WHERE code = $1
    LIMIT 1
    `,
    [codeNorm]
  );

  const row = lookup.rows?.[0];
  if (!row) return { ok: false, error: "code_not_found" };
  if (row.status !== "pending") return { ok: false, error: "code_already_used" };

  const exp = new Date(row.expires_at).getTime();
  if (!Number.isFinite(exp) || exp < Date.now()) {
    return { ok: false, error: "code_expired" };
  }

  await pool.query(
    `
    INSERT INTO user_links
      (global_user_id, provider, provider_user_id, linked_by_global_user_id, status, meta, updated_at)
    VALUES
      ($1, $2, $3, $4, 'active', $5::jsonb, NOW())
    ON CONFLICT (provider, provider_user_id)
    DO UPDATE SET
      global_user_id = EXCLUDED.global_user_id,
      linked_by_global_user_id = EXCLUDED.linked_by_global_user_id,
      status = 'active',
      meta = EXCLUDED.meta,
      updated_at = NOW()
    `,
    [
      row.global_user_id,
      provider,
      providerUserIdStr,
      row.global_user_id,
      JSON.stringify({ linked_via_code: row.code, source_provider: row.provider }),
    ]
  );

  await pool.query(
    `
    INSERT INTO user_identities (global_user_id, provider, provider_user_id, chat_id)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (provider, provider_user_id)
    DO UPDATE SET global_user_id = EXCLUDED.global_user_id
    `,
    [row.global_user_id, provider, providerUserIdStr, providerUserIdStr]
  );

  await pool.query(
    `
    UPDATE identity_link_codes
    SET status = 'consumed', consumed_at = NOW()
    WHERE id = $1
    `,
    [row.id]
  );

  return {
    ok: true,
    global_user_id: row.global_user_id,
    linked_provider: provider,
    linked_provider_user_id: providerUserIdStr,
  };
}

export async function getLinkStatus({ provider = "telegram", providerUserId }) {
  const providerUserIdStr = String(providerUserId || "").trim();
  if (!providerUserIdStr) return { ok: false, error: "provider_user_id_required" };

  const res = await pool.query(
    `
    SELECT global_user_id, provider, provider_user_id, status, updated_at
    FROM user_links
    WHERE provider = $1 AND provider_user_id = $2
    LIMIT 1
    `,
    [provider, providerUserIdStr]
  );

  return { ok: true, link: res.rows?.[0] || null };
}
