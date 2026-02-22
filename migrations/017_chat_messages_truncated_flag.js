/**
 * STAGE 7B.5.3
 * Add `truncated` flag to chat_messages (free-tier safety).
 * ESM migration.
 */

export const up = async (pgm) => {
  pgm.addColumn("chat_messages", {
    truncated: {
      type: "boolean",
      notNull: true,
      default: false,
    },
  });
};

export const down = async (pgm) => {
  pgm.dropColumn("chat_messages", "truncated");
};
