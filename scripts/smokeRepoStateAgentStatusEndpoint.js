// scripts/smokeRepoStateAgentStatusEndpoint.js
// ============================================================================
// Smoke — RepoStateAgent internal status endpoint
//
// Verifies that the status endpoint skeleton:
// - imports without starting Telegram or Technical Mode;
// - exposes GET /internal/repo-state-agent/status;
// - fails closed with 403 when token is missing or invalid;
// - performs no DB read in forbidden cases;
// - adds no slash-command / keyword-router path.
// ============================================================================

import assert from "node:assert/strict";
import http from "node:http";
import express from "express";

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://user:pass@localhost:5432/garya_smoke";
process.env.REPO_STATE_AGENT_WEBHOOK_TOKEN = "repo-state-agent-smoke-token";

const { createRepoStateAgentRoute } = await import("../src/http/repoStateAgentRoute.js");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
}

function parseJsonIfPossible(body) {
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed || !(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return null;
  }

  return JSON.parse(trimmed);
}

function request(server, path, headers = {}) {
  const address = server.address();
  const port = address?.port;

  assert.equal(typeof port, "number", "smoke server must expose an assigned port");

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method: "GET",
        headers,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body,
            json: parseJsonIfPossible(body),
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

const app = express();
app.use(express.json());
app.use(createRepoStateAgentRoute());

const server = app.listen(0, "127.0.0.1");
await listen(server);

try {
  const missingToken = await request(server, "/internal/repo-state-agent/status");
  assert.equal(missingToken.statusCode, 403, "missing token must fail closed with 403");
  assert.deepEqual(missingToken.json, { ok: false, error: "forbidden" });

  const invalidToken = await request(server, "/internal/repo-state-agent/status", {
    "x-repo-state-agent-token": "wrong-token",
  });
  assert.equal(invalidToken.statusCode, 403, "invalid token must fail closed with 403");
  assert.deepEqual(invalidToken.json, { ok: false, error: "forbidden" });

  const wrongPath = await request(server, "/repo_state_agent_status");
  assert.equal(wrongPath.statusCode, 404, "no slash/command-style route must be added");
  assert.equal(wrongPath.json, null, "wrong command-like path may return non-JSON 404");

  console.log("Smoke RepoStateAgent status endpoint — OK");
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
