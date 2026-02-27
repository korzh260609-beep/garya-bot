export async function checkRoles(report, options = {}) {
  const { pool, monarchUserId } = options;

  if (!pool) {
    report.addWarn("roles check skipped", "No DB pool provided");
    return;
  }
  if (!monarchUserId) {
    report.addWarn("roles check skipped", "No MONARCH_USER_ID provided");
    return;
  }

  const expectedGlobal = `tg:${String(monarchUserId)}`;

  try {
    const res = await pool.query(
      "SELECT global_user_id FROM users WHERE role = 'monarch' ORDER BY created_at ASC"
    );

    const monarchs = res.rows.map((r) => String(r.global_user_id || "")).filter(Boolean);

    if (monarchs.length === 0) {
      report.addWarn("No monarch in DB", `Expected: ${expectedGlobal}`);
      return;
    }

    if (monarchs.length > 1) {
      report.addFail(
        "Multiple monarchs in DB",
        `Count: ${monarchs.length} global_user_id: ${monarchs.join(", ")}`
      );
      return;
    }

    if (monarchs[0] !== expectedGlobal) {
      report.addFail("Wrong monarch in DB", `DB: ${monarchs[0]} Expected: ${expectedGlobal}`);
      return;
    }

    report.addOk("Monarch role invariant OK", `monarch=${monarchs[0]}`);
  } catch (e) {
    report.addFail("roles check crashed", e?.message || String(e));
  }
}

// ============================================================================
// === STAGE 4.5 SKELETON (V2) — monarch invariant by resolved global id =======
// ============================================================================
// ВАЖНО: не заменяет checkRoles. Это новая функция для будущего wiring.
// Правило V2: expectedMonarchGlobalUserId может быть usr_... или tg:...,
// но НЕ должен жестко выводиться из telegram user_id.
// ----------------------------------------------------------------------------
export async function checkRolesV2(report, options = {}) {
  const { pool, monarchUserId, monarchGlobalUserId } = options;

  if (!pool) {
    report.addWarn("roles check skipped (v2)", "No DB pool provided");
    return;
  }

  // Backward compatible: if monarchGlobalUserId not provided, keep legacy expectation
  const expectedGlobal =
    String(monarchGlobalUserId || "").trim() || (monarchUserId ? `tg:${String(monarchUserId)}` : "");

  if (!expectedGlobal) {
    report.addWarn("roles check skipped (v2)", "No expected monarch global id provided");
    return;
  }

  try {
    const res = await pool.query(
      "SELECT global_user_id FROM users WHERE role = 'monarch' ORDER BY created_at ASC"
    );

    const monarchs = res.rows.map((r) => String(r.global_user_id || "")).filter(Boolean);

    if (monarchs.length === 0) {
      report.addWarn("No monarch in DB (v2)", `Expected: ${expectedGlobal}`);
      return;
    }

    if (monarchs.length > 1) {
      report.addFail(
        "Multiple monarchs in DB (v2)",
        `Count: ${monarchs.length} global_user_id: ${monarchs.join(", ")}`
      );
      return;
    }

    if (monarchs[0] !== expectedGlobal) {
      report.addFail("Wrong monarch in DB (v2)", `DB: ${monarchs[0]} Expected: ${expectedGlobal}`);
      return;
    }

    report.addOk("Monarch role invariant OK (v2)", `monarch=${monarchs[0]}`);
  } catch (e) {
    report.addFail("roles check crashed (v2)", e?.message || String(e));
  }
}
