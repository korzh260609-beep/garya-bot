// migrations/026_dlq_jobs_table.js

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("dlq_jobs", {
    id: "id",

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },

    job_id: {
      type: "text",
      notNull: true,
    },

    idempotency_key: {
      type: "text",
    },

    task_id: {
      type: "bigint",
    },

    run_key: {
      type: "text",
    },

    error: {
      type: "text",
      notNull: true,
    },

    job: {
      type: "jsonb",
    },

    context: {
      type: "jsonb",
    },

    status: {
      type: "text",
      notNull: true,
      default: "new",
    },
  });

  // защита от повторной записи одного и того же упавшего job
  pgm.createIndex("dlq_jobs", ["job_id"], { unique: true });

  pgm.createIndex("dlq_jobs", ["created_at"]);
  pgm.createIndex("dlq_jobs", ["task_id"]);
  pgm.createIndex("dlq_jobs", ["run_key"]);
  pgm.createIndex("dlq_jobs", ["status"]);
};

exports.down = (pgm) => {
  pgm.dropTable("dlq_jobs");
};
