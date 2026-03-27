// ============================================================================
// scripts/renderLogSender.js
// External sender skeleton for SG render log ingest route.
//
// PURPOSE:
// - send real error/deploy snapshots into SG from any external watcher
// - do NOT change SG runtime architecture
// - work as standalone CLI
//
// USAGE EXAMPLES:
//
// Error from file:
//   RENDER_LOG_INGEST_URL=https://your-sg-host/ingest/render-log \
//   RENDER_LOG_INGEST_TOKEN=secret \
//   npm run render:ingest:send -- \
//     --mode=error \
//     --sourceKey=render_primary \
//     --file=./render-error.log
//
// Error from stdin:
//   cat ./render-error.log | \
//   RENDER_LOG_INGEST_URL=https://your-sg-host/ingest/render-log \
//   RENDER_LOG_INGEST_TOKEN=secret \
//   npm run render:ingest:send -- \
//     --mode=error \
//     --sourceKey=render_primary \
//     --stdin
//
// Deploy snapshot:
//   RENDER_LOG_INGEST_URL=https://your-sg-host/ingest/render-log \
//   RENDER_LOG_INGEST_TOKEN=secret \
//   npm run render:ingest:send -- \
//     --mode=deploy \
//     --sourceKey=render_primary \
//     --deployId=dep_123 \
//     --status=failed \
//     --file=./deploy.log \
//     --meta='{"service":"sg-prod","commit":"abc123"}'
//
// IMPORTANT:
// - this script DOES NOT fetch logs from Render by itself
// - it is only the safe bridge/sender skeleton
// - a watcher/cron/github action/vps process can call this script
// ============================================================================

import fs from "fs/promises";
import process from "process";
import fetch from "node-fetch";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseArgs(argv) {
  const args = {};

  for (const raw of argv) {
    const s = normalizeString(raw);
    if (!s) continue;

    if (s.startsWith("--")) {
      const eqIndex = s.indexOf("=");

      if (eqIndex >= 0) {
        const key = s.slice(2, eqIndex).trim();
        const value = s.slice(eqIndex + 1).trim();
        args[key] = value;
      } else {
        const key = s.slice(2).trim();
        args[key] = true;
      }
    }
  }

  return args;
}

function parseMode(value) {
  const s = normalizeString(value).toLowerCase();
  return s === "deploy" ? "deploy" : "error";
}

function parseMeta(value) {
  const raw = normalizeString(value);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("meta must be a JSON object");
    }
    return parsed;
  } catch (error) {
    throw new Error(`Invalid --meta JSON: ${error.message}`);
  }
}

async function readStdinText() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString("utf-8").trim();
}

async function readLogText({ filePath, useStdin, inlineText }) {
  if (normalizeString(inlineText)) {
    return normalizeString(inlineText);
  }

  if (filePath) {
    const text = await fs.readFile(filePath, "utf-8");
    return normalizeString(text);
  }

  if (useStdin) {
    return await readStdinText();
  }

  return "";
}

function printUsageAndExit(message) {
  if (message) {
    console.error(`❌ ${message}`);
    console.error("");
  }

  console.error("Usage:");
  console.error("  npm run render:ingest:send -- --mode=error --sourceKey=render_primary --file=./err.log");
  console.error("  npm run render:ingest:send -- --mode=error --sourceKey=render_primary --stdin");
  console.error("  npm run render:ingest:send -- --mode=deploy --sourceKey=render_primary --deployId=dep_123 --status=failed --file=./deploy.log");
  console.error("");
  console.error("Env required:");
  console.error("  RENDER_LOG_INGEST_URL");
  console.error("  RENDER_LOG_INGEST_TOKEN");

  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const ingestUrl = normalizeString(process.env.RENDER_LOG_INGEST_URL);
  const ingestToken = normalizeString(process.env.RENDER_LOG_INGEST_TOKEN);

  if (!ingestUrl) {
    printUsageAndExit("Missing RENDER_LOG_INGEST_URL");
  }

  if (!ingestToken) {
    printUsageAndExit("Missing RENDER_LOG_INGEST_TOKEN");
  }

  const mode = parseMode(args.mode);
  const sourceKey = normalizeString(args.sourceKey) || "render_primary";
  const deployId = normalizeString(args.deployId);
  const status = normalizeString(args.status) || "unknown";
  const meta = parseMeta(args.meta);
  const filePath = normalizeString(args.file);
  const inlineText = normalizeString(args.text);
  const useStdin = Boolean(args.stdin);

  const logText = await readLogText({
    filePath,
    useStdin,
    inlineText,
  });

  if (mode === "error" && !logText) {
    printUsageAndExit("Error mode requires log text: use --file, --stdin or --text");
  }

  if (mode === "deploy" && !deployId) {
    printUsageAndExit("Deploy mode requires --deployId");
  }

  const body = {
    sourceKey,
    mode,
    meta,
  };

  if (mode === "error") {
    body.logText = logText;
  }

  if (mode === "deploy") {
    body.deployId = deployId;
    body.status = status;
    if (logText) {
      body.logText = logText;
    }
  }

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-render-log-token": ingestToken,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    console.error("❌ Ingest failed");
    console.error(`status=${response.status}`);
    console.error(parsed ? JSON.stringify(parsed, null, 2) : text);
    process.exit(1);
  }

  console.log("✅ Ingest success");
  console.log(
    JSON.stringify(
      {
        httpStatus: response.status,
        result: parsed || text,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("❌ renderLogSender fatal error:", error);
  process.exit(1);
});