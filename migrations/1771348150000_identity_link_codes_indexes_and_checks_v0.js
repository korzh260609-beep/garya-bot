// migrations/20260218090000_identity_link_codes_indexes_and_checks_v0.js
// Stage 3 stabilization — indexes + status checks (no new features)

export async function up(pgm) {
  // Speed up getLinkStatus() pending lookup
  pgm.createIndex("identity_link_codes", ["provider", "provider_user_id", "status"], {
    name: "idx_identity_link_codes_provider_user_status",
    ifNotExists: true,
  });

  // Helps ordering by created_at for pending lookup
  pgm.createIndex(
    "identity_link_codes",
    ["provider", "provider_user_id", { name: "created_at", sort: "DESC" }],
    {
      name: "idx_identity_link_codes_provider_user_created_desc",
      ifNotExists: true,
    }
  );

  // Constrain statuses (prevents garbage)
  pgm.addConstraint("identity_link_codes", "ck_identity_link_codes_status", {
    check: "status IN ('pending','consumed','revoked')",
  });

  pgm.addConstraint("user_links", "ck_user_links_status", {
    check: "status IN ('active','disabled')",
  });
}

export async function down() {
  // forward-only policy
}
