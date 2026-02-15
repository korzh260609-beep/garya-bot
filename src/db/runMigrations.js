// src/db/runMigrations.js
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

export async function runMigrationsIfEnabled() {
  const flag = (process.env.RUN_MIGRATIONS_ON_BOOT || "").toString().trim();
  const enabled = flag === "1" || flag.toLowerCase() === "true" || flag.toLowerCase() === "yes";

  if (!enabled) {
    console.log("🧱 Migrations: skipped (RUN_MIGRATIONS_ON_BOOT is not enabled).");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("❌ Migrations: DATABASE_URL is missing — cannot run migrations.");
    return;
  }

  // node-pg-migrate is CJS; use require for ESM project
  const pgMigrateModule = require("node-pg-migrate");
  const pgMigrate = pgMigrateModule.default || pgMigrateModule;

  const dir = path.resolve(process.cwd(), "migrations");

  console.log("🧱 Migrations: starting (up)...");

  try {
    const applied = await pgMigrate({
      databaseUrl: process.env.DATABASE_URL,
      dir,
      direction: "up",
      // keep defaults; do not create schema, use public
      schema: "public",
      createSchema: false
    });

    console.log(`✅ Migrations: done. Applied: ${Array.isArray(applied) ? applied.length : 0}`);
  } catch (e) {
    console.error("❌ Migrations: FAILED:", e);
    // IMPORTANT: fail fast, so you see it in Render logs
    throw e;
  }
}
