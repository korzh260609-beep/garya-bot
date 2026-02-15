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
