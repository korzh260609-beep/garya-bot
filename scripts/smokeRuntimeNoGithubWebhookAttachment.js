// scripts/smokeRuntimeNoGithubWebhookAttachment.js
// SG 2.0 — Runtime safety smoke.
// Purpose: ensure experimental GitHub webhook intake is not attached to the live Express runtime.

import assert from "node:assert/strict";
import fs from "node:fs";

const appFactory = fs.readFileSync("src/app/appFactory.js", "utf8");

assert.equal(appFactory.includes("attachGithubWebhookRoutes"), false);
assert.equal(appFactory.includes("githubWebhookRoutes"), false);
assert.equal(appFactory.includes("app.use(express.json"), true);
assert.equal(appFactory.includes("initTelegramTransport(app)"), true);
assert.equal(appFactory.includes("attachRootRoutes(app)"), true);
assert.equal(appFactory.includes("attachHealthRoutes(app"), true);

console.log("smokeRuntimeNoGithubWebhookAttachment: ok");
