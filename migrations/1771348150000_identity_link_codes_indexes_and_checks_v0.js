// migrations/1771348150000_identity_link_codes_indexes_and_checks_v0.js
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

  // Constrain statuses (prevents garbage) — idempotent
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_identity_link_codes_status'
      ) THEN
        ALTER TABLE identity_link_codes
          ADD CONSTRAINT ck_identity_link_codes_status
          CHECK (status IN ('pending','consumed','revoked'));
      END IF;
    END$$;
  `);

  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_user_links_status'
      ) THEN
        ALTER TABLE user_links
          ADD CONSTRAINT ck_user_links_status
          CHECK (status IN ('active','disabled'));
      END IF;
    END$$;
  `);
}

export async function down() {
  // forward-only policy
}
