// scripts/smokeChatPathNoRepoFactsTechnicalFallback.js
// ============================================================================
// Smoke — Chat Path No Repo Facts Technical Fallback
//
// Verifies that ordinary chat orchestration does not send repo source-state
// technical fallback replies to users.
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const file = readFileSync("src/bot/handlers/chat/chatAiOrchestrationFlow.js", "utf8");

assert.ok(!file.includes("guardRepoFactsSourceHonesty"));
assert.ok(!file.includes("buildRepoFactsSourceHonestyBlockedReply"));
assert.ok(!file.includes("source_honesty_repo_facts_blocked"));
assert.ok(!file.includes("repoFactsBlockedText"));
assert.ok(!file.includes("repoFactsSourceHonestyGuard"));
assert.ok(!file.includes("repoFactsSourceHonestyReply"));

console.log("Smoke Chat Path No Repo Facts Technical Fallback — OK");
