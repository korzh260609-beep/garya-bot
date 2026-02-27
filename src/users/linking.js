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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock row to prevent race (double-consume)
    const lookup = await client.query(
      `
      SELECT id, code, global_user_id, provider, provider_user_id, expires_at, status
      FROM identity_link_codes
      WHERE code = $1
      LIMIT 1
      FOR UPDATE
      `,
      [codeNorm]
    );

    const row = lookup.rows?.[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false, error: "code_not_found" };
    }

    // ✅ bind check: code can be confirmed only by the same provider/provider_user_id it was created for
    if (String(row.provider) !== String(provider) || String(row.provider_user_id) !== providerUserIdStr) {
      await client.query("ROLLBACK");
      return { ok: false, error: "code_owner_mismatch" };
    }

    if (row.status !== "pending") {
      await client.query("ROLLBACK");
      return { ok: false, error: "code_already_used" };
    }

    const exp = new Date(row.expires_at).getTime();
    if (!Number.isFinite(exp) || exp < Date.now()) {
      await client.query("ROLLBACK");
      return { ok: false, error: "code_expired" };
    }

    await client.query(
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

    await client.query(
      `
      INSERT INTO user_identities (global_user_id, provider, provider_user_id, chat_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (provider, provider_user_id)
      DO UPDATE SET global_user_id = EXCLUDED.global_user_id
      `,
      [row.global_user_id, provider, providerUserIdStr, providerUserIdStr]
    );

    await client.query(
      `
      UPDATE identity_link_codes
      SET status = 'consumed', consumed_at = NOW()
      WHERE id = $1 AND status = 'pending'
      `,
      [row.id]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      global_user_id: row.global_user_id,
      linked_provider: provider,
      linked_provider_user_id: providerUserIdStr,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    return { ok: false, error: "confirm_failed" };
  } finally {
    client.release();
  }
}

export async function getLinkStatus({ provider = "telegram", providerUserId }) {
  const providerUserIdStr = String(providerUserId || "").trim();
  if (!providerUserIdStr) return { ok: false, error: "provider_user_id_required" };

  // ✅ IMPORTANT: only treat ACTIVE link as "linked"
  const res = await pool.query(
    `
    SELECT global_user_id, provider, provider_user_id, status, updated_at
    FROM user_links
    WHERE provider = $1
      AND provider_user_id = $2
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [provider, providerUserIdStr]
  );

  const link = res.rows?.[0] || null;
  if (link) return { ok: true, link, pending: null };

  const pendingRes = await pool.query(
    `
    SELECT code, global_user_id, expires_at
    FROM identity_link_codes
    WHERE provider = $1
      AND provider_user_id = $2
      AND status = 'pending'
      AND consumed_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [provider, providerUserIdStr]
  );

  const pending = pendingRes.rows?.[0] || null;

  return { ok: true, link: null, pending };
}

// ============================================================================
// === STAGE 4.5 SKELETON (V2) — identity-first linking (NOT WIRED) ============
// ============================================================================
// Цель V2: link-коды должны опираться на реальный global_user_id (usr_...),
// а tg:<id> оставлять только как legacy fallback.
// ВАЖНО: ниже — только добавление функций. Старые createLinkCode/confirmLinkCode
// НЕ меняем, чтобы не менять поведение без отдельного решения/wiring.
// ----------------------------------------------------------------------------

// NOTE: minimal helper — resolve existing global_user_id by provider mapping or users fallback
async function resolveExistingGlobalUserIdV2({ provider = "telegram", providerUserId }) {
  const providerNorm = String(provider || "telegram").trim() || "telegram";
  const providerUserIdStr = String(providerUserId || "").trim();
  if (!providerUserIdStr) return null;

  // 1) user_identities is source of truth
  try {
    const idRes = await pool.query(
      `
      SELECT global_user_id
      FROM user_identities
      WHERE provider = $1 AND provider_user_id = $2
      LIMIT 1
      `,
      [providerNorm, providerUserIdStr]
    );
    const gid1 = idRes.rows?.[0]?.global_user_id || null;
    if (gid1) return gid1;
  } catch (_) {
    // keep V2 safe: ignore, fallback below
  }

  // 2) fallback users (legacy)
  try {
    const legacyRes = await pool.query(
      `
      SELECT global_user_id
      FROM users
      WHERE global_user_id = $1 OR tg_user_id = $2
      LIMIT 1
      `,
      [`tg:${providerUserIdStr}`, providerUserIdStr]
    );
    return legacyRes.rows?.[0]?.global_user_id || null;
  } catch (_) {
    return null;
  }
}

export async function createLinkCodeV2({ provider = "telegram", providerUserId }) {
  const providerUserIdStr = String(providerUserId || "").trim();
  if (!providerUserIdStr) {
    return { ok: false, error: "provider_user_id_required" };
  }

  // identity-first if possible, else legacy tg:<id>
  const resolved = await resolveExistingGlobalUserIdV2({
    provider,
    providerUserId: providerUserIdStr,
  });
  const globalUserId = resolved || `tg:${providerUserIdStr}`;

  const code = genCode();

  // NOTE: still uses existing CODE_TTL_MIN constant (config hygiene V2 later)
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

  return { ok: true, ...res.rows[0], v2: true };
}

export async function confirmLinkCodeV2({ code, provider = "telegram", providerUserId }) {
  // Skeleton-only: for now, reuse v1 confirm logic (no behavior change).
  // Wiring decision later: should we "upgrade" tg:<id> to usr_... at confirm time?
  return confirmLinkCode({ code, provider, providerUserId });
}

export async function getLinkStatusV2({ provider = "telegram", providerUserId }) {
  // Skeleton-only: reuse v1 status logic.
  return getLinkStatus({ provider, providerUserId });
}
