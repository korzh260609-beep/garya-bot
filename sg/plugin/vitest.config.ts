import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  resolve: {
    alias: {
      "openclaw/plugin-sdk/file-lock": path.join(repoRoot, "src/plugin-sdk/file-lock.ts"),
      "openclaw/plugin-sdk/json-store": path.join(repoRoot, "src/plugin-sdk/json-store.ts"),
      "@openclaw/normalization-core/record-coerce": path.join(
        repoRoot,
        "packages/normalization-core/src/record-coerce.ts",
      ),
    },
  },
  test: {
    include: [path.join(repoRoot, "sg/plugin/**/*.test.ts")],
  },
});
