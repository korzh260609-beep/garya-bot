// migrations/006_user_links_and_link_codes_v0.js
// STAGE 4.3/4.4 — user_links + linking flow (code/confirm) foundation

export async function up(pgm) {
  pgm.createTable(
    "user_links",
    {
      id: "bigserial",
      global_user_id: { type: "text", notNull: true },
      provider: { type: "text", notNull: true },
      provider_user_id: { type: "text", notNull: true },
      linked_by_global_user_id: { type: "text" },
      status: { type: "text", notNull: true, default: "active" },
      meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
      updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    },
    { ifNotExists: true }
  );

  pgm.createIndex("user_links", ["provider", "provider_user_id"], {
    name: "ux_user_links_provider_provider_user_id",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex("user_links", ["global_user_id"], {
    name: "idx_user_links_global_user_id",
    ifNotExists: true,
  });

  pgm.createTable(
    "identity_link_codes",
    {
      id: "bigserial",
      code: { type: "text", notNull: true },
      global_user_id: { type: "text", notNull: true },
      provider: { type: "text", notNull: true, default: "telegram" },
      provider_user_id: { type: "text", notNull: true },
      status: { type: "text", notNull: true, default: "pending" },
      expires_at: { type: "timestamptz", notNull: true },
      consumed_at: { type: "timestamptz" },
      meta: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
      created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    },
    { ifNotExists: true }
  );

  pgm.createIndex("identity_link_codes", ["code"], {
    name: "ux_identity_link_codes_code",
    unique: true,
    ifNotExists: true,
  });

  pgm.createIndex(
    "identity_link_codes",
    ["global_user_id", { name: "created_at", sort: "DESC" }],
    {
      name: "idx_identity_link_codes_global_created",
      ifNotExists: true,
    }
  );

  pgm.sql(`
    INSERT INTO schema_version (version, note)
    VALUES (6, 'stage 4.3/4.4 user_links + identity_link_codes')
    ON CONFLICT (version) DO NOTHING;
  `);
}

export async function down() {
  // forward-only policy; keep down minimal
}
