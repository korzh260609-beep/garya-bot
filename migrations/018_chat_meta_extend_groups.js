/**
 * STAGE 7B.8 — chat_meta extend (platform, chat_type, title, alias)
 * forward-only migration (safe for prod)
 * ESM version.
 */

export const up = async (pgm) => {
  // Add required platform column.
  // Use a default to avoid breaking existing rows.
  pgm.addColumn("chat_meta", {
    platform: {
      type: "text",
      notNull: true,
      default: "telegram",
    },
  });

  // Backfill platform from existing transport where present.
  pgm.sql(`
    UPDATE chat_meta
    SET platform = transport
    WHERE transport IS NOT NULL AND transport <> '';
  `);

  // Remove default after backfill (so future inserts must set it explicitly).
  pgm.alterColumn("chat_meta", "platform", { default: null });

  // Add group/source registry fields.
  pgm.addColumns("chat_meta", {
    chat_type: { type: "text" }, // private | group | supergroup | channel
    title: { type: "text" },     // service field (do not show by default)
    alias: { type: "text" },     // required later when source_enabled=true
  });
};

export const down = async (pgm) => {
  pgm.dropColumns("chat_meta", ["alias", "title", "chat_type", "platform"]);
};
