// scripts/smokeLivingRepoFileSourceResolver.js
// ============================================================================
// Smoke — Living Repo File Source Resolver
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  extractExplicitRepoFilePath,
} from "../src/bot/handlers/chat/livingRepoFileSourceResolver.js";

assert.equal(
  extractExplicitRepoFilePath("прочитай файл src/core/meaning/MeaningEngine.js"),
  "src/core/meaning/MeaningEngine.js"
);

assert.equal(
  extractExplicitRepoFilePath("open `src/bot/handlers/chat/sourceFlow.js`"),
  "src/bot/handlers/chat/sourceFlow.js"
);

assert.equal(
  extractExplicitRepoFilePath("что по проекту без конкретного файла"),
  ""
);

const sourceFlow = readFileSync("src/bot/handlers/chat/sourceFlow.js", "utf8");
assert.ok(sourceFlow.includes("resolveLivingRepoFileSource"));
assert.ok(sourceFlow.includes("livingRepoFileSource.sourceResultSystemMessage"));
assert.ok(sourceFlow.includes("repo_file_source_system_message"));

console.log("Smoke Living Repo File Source Resolver — OK");
