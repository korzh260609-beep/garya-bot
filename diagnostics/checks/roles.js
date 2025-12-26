export async function checkRoles(report, options = {}) {
  const { pool, monarchChatId } = options;

  if (!pool) {
    report.addWarn("roles check skipped", "No DB pool provided");
    return;
  }
  if (!monarchChatId) {
    report.addWarn("roles check skipped", "No MONARCH_CHAT_ID provided");
    return;
  }

  try {
    const res = await pool.query(
      "SELECT chat_id FROM users WHERE role = 'monarch' ORDER BY created_at ASC"
    );

    const monarchs = res.rows.map((r) => String(r.chat_id));

    if (monarchs.length === 0) {
      report.addWarn("No monarch in DB", `Expected: ${monarchChatId}`);
      return;
    }

    if (monarchs.length > 1) {
      report.addFail("Multiple monarchs in DB", `Count: ${monarchs.length} IDs: ${monarchs.join(", ")}`);
      return;
    }

    if (monarchs[0] !== String(monarchChatId)) {
      report.addFail("Wrong monarch in DB", `DB: ${monarchs[0]} Expected: ${monarchChatId}`);
      return;
    }

    report.addOk("Monarch role invariant OK", `monarch=${monarchs[0]}`);
  } catch (e) {
    report.addFail("roles check crashed", e?.message || String(e));
  }
}

