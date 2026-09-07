import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedVitestConfig } from "../../test/vitest/vitest.shared.config.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "openclaw/plugin-sdk/file-lock",
        replacement: path.join(repoRoot, "src/plugin-sdk/file-lock.ts"),
      },
      {
        find: "openclaw/plugin-sdk/json-store",
        replacement: path.join(repoRoot, "src/plugin-sdk/json-store.ts"),
      },
      {
        find: "openclaw/plugin-sdk/session-transcript-runtime",
        replacement: path.join(repoRoot, "src/plugin-sdk/session-transcript-runtime.ts"),
      },
      {
        find: "openclaw/plugin-sdk/tool-results",
        replacement: path.join(repoRoot, "src/plugin-sdk/tool-results.ts"),
      },
      {
        find: /^@openclaw\/normalization-core\/(.+)$/u,
        replacement: path.join(repoRoot, "packages/normalization-core/src/$1"),
      },
      ...sharedVitestConfig.resolve.alias,
    ],
  },
  test: {
    include: [path.join(repoRoot, "sg/plugin/**/*.test.ts")],
  },
});
