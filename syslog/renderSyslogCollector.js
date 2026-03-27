// ============================================================================
// syslog/renderSyslogCollector.js
// PURPOSE:
// - accept Render Log Streams over TLS syslog
// - aggregate incoming lines into short snapshots
// - classify snapshots as deploy/error
// - forward snapshots into SG ingest route
//
// IMPORTANT:
// - this is a standalone inbound syslog collector
// - it is NOT an HTTP route
// - it requires a deployment target that supports inbound TCP + TLS
// - Render Log Streams expect a TLS-enabled syslog endpoint
//
// REQUIRED ENV:
// - RENDER_LOG_INGEST_URL
// - RENDER_LOG_INGEST_TOKEN
// - SYSLOG_TLS_CERT_PEM or SYSLOG_TLS_CERT_BASE64
// - SYSLOG_TLS_KEY_PEM  or SYSLOG_TLS_KEY_BASE64
//
// OPTIONAL ENV:
// - SYSLOG_TLS_PORT=6514
// - SYSLOG_TLS_HOST=0.0.0.0
// - SYSLOG_TLS_CA_PEM / SYSLOG_TLS_CA_BASE64
// - COLLECTOR_SOURCE_KEY=render_primary
// - COLLECTOR_IDLE_FLUSH_MS=2500
// - COLLECTOR_MAX_BUFFER_CHARS=32000
// - COLLECTOR_DEDUPE_WINDOW_MS=180000
// - COLLECTOR_FORWARD_NON_ERRORS=false
//
// NOTES:
// - we intentionally use heuristics; Render stream message grouping is not guaranteed
// - snapshots are grouped by idle timeout and max buffer size
// - duplicate snapshots are suppressed for a short window
// ============================================================================

import tls from "tls";
import crypto from "crypto";
import fetch from "node-fetch";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function envBool(name, fallback = false) {
  const raw = normalizeString(process.env[name] || "").toLowerCase();
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw);
}

function readPemFromEnv({ pemName, b64Name, required = false }) {
  const rawPem = process.env[pemName];
  if (typeof rawPem === "string" && rawPem.trim()) {
    return rawPem;
  }

  const rawB64 = process.env[b64Name];
  if (typeof rawB64 === "string" && rawB64.trim()) {
    try {
      return Buffer.from(rawB64, "base64").toString("utf-8");
    } catch (error) {
      throw new Error(`Invalid base64 in ${b64Name}: ${error.message}`);
    }
  }

  if (required) {
    throw new Error(`Missing ${pemName} or ${b64Name}`);
  }

  return null;
}

function sha1(text) {
  return crypto.createHash("sha1").update(String(text || ""), "utf8").digest("hex");
}

function shortHash(text) {
  return sha1(text).slice(0, 12);
}

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeSyslogLine(line) {
  const raw = String(line || "").replace(/\r/g, "").trim();
  if (!raw) return "";

  // RFC5424-ish: <PRI>VERSION TIMESTAMP HOST APP PROCID MSGID STRUCTURED-DATA MSG
  // We try to extract only the final message part.
  const match = raw.match(
    /^<\d+>\d\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(?:-|\[[^\]]*\])\s?(.*)$/
  );
  if (match && typeof match[1] === "string") {
    return match[1].trim() || raw;
  }

  return raw;
}

function buildClassifierText(text) {
  return normalizeString(text).toLowerCase();
}

function classifySnapshot(text) {
  const t = buildClassifierText(text);

  const deployFailedMarkers = [
    "build failed",
    "deploy failed",
    "deployment failed",
    "error: build failed",
    "exited with status",
    "crashloop",
    "syntaxerror:",
    "uncaught exception",
    "fatal error",
  ];

  const deploySuccessMarkers = [
    "available at your primary url",
    "live",
    "deploy complete",
    "deployment completed",
    "service is live",
    "starting service",
    "server listening",
  ];

  const errorMarkers = [
    "syntaxerror:",
    "typeerror:",
    "referenceerror:",
    "error:",
    "exception",
    "uncaught",
    "fatal",
    "traceback",
    "missing catch or finally after try",
  ];

  const hasDeployFailed = deployFailedMarkers.some((m) => t.includes(m));
  const hasDeploySuccess = deploySuccessMarkers.some((m) => t.includes(m));
  const hasError = errorMarkers.some((m) => t.includes(m));

  if (hasDeployFailed) {
    return {
      mode: "deploy",
      status: "failed",
      reason: "deploy_failed_markers",
    };
  }

  if (hasDeploySuccess) {
    return {
      mode: "deploy",
      status: "success",
      reason: "deploy_success_markers",
    };
  }

  if (hasError) {
    return {
      mode: "error",
      status: null,
      reason: "error_markers",
    };
  }

  return null;
}

function buildDeployId(text) {
  const minuteBucket = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "");
  return `stream_${minuteBucket}_${shortHash(text)}`;
}

async function postToIngest(payload) {
  const ingestUrl = normalizeString(process.env.RENDER_LOG_INGEST_URL);
  const ingestToken = normalizeString(process.env.RENDER_LOG_INGEST_TOKEN);

  if (!ingestUrl) {
    throw new Error("Missing RENDER_LOG_INGEST_URL");
  }

  if (!ingestToken) {
    throw new Error("Missing RENDER_LOG_INGEST_TOKEN");
  }

  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-render-log-token": ingestToken,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const parsed = safeJsonParse(text);

  if (!response.ok) {
    throw new Error(
      `Ingest failed: status=${response.status} body=${text.slice(0, 500)}`
    );
  }

  return {
    status: response.status,
    body: parsed || text,
  };
}

class DedupeWindow {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.map = new Map();
  }

  has(hash) {
    this.cleanup();
    const ts = this.map.get(hash);
    if (!ts) return false;
    return Date.now() - ts < this.windowMs;
  }

  add(hash) {
    this.cleanup();
    this.map.set(hash, Date.now());
  }

  cleanup() {
    const now = Date.now();
    for (const [key, ts] of this.map.entries()) {
      if (now - ts >= this.windowMs) {
        this.map.delete(key);
      }
    }
  }
}

class SnapshotBuffer {
  constructor({
    socketId,
    sourceKey,
    idleFlushMs,
    maxBufferChars,
    dedupe,
    forwardNonErrors,
  }) {
    this.socketId = socketId;
    this.sourceKey = sourceKey;
    this.idleFlushMs = idleFlushMs;
    this.maxBufferChars = maxBufferChars;
    this.dedupe = dedupe;
    this.forwardNonErrors = forwardNonErrors;

    this.lines = [];
    this.timer = null;
    this.totalChars = 0;
    this.forwarding = false;
  }

  pushLine(line) {
    const normalized = normalizeSyslogLine(line);
    if (!normalized) return;

    this.lines.push(normalized);
    this.totalChars += normalized.length + 1;

    if (this.totalChars >= this.maxBufferChars) {
      void this.flush("max_buffer");
      return;
    }

    this.bumpTimer();
  }

  bumpTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.flush("idle");
    }, this.idleFlushMs);
  }

  async flush(reason) {
    if (this.forwarding) return;
    if (!this.lines.length) return;

    this.forwarding = true;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const text = this.lines.join("\n").trim();
    this.lines = [];
    this.totalChars = 0;

    try {
      if (!text) return;

      const classification = classifySnapshot(text);

      if (!classification && !this.forwardNonErrors) {
        console.log(
          "SYSLOG_SNAPSHOT_SKIP",
          JSON.stringify({
            at: nowIso(),
            socketId: this.socketId,
            reason,
            classifier: "no_match",
            chars: text.length,
          })
        );
        return;
      }

      const mode = classification?.mode || "error";
      const status = classification?.status || undefined;
      const dedupeHash = sha1(`${mode}:${status || ""}:${text}`);

      if (this.dedupe.has(dedupeHash)) {
        console.log(
          "SYSLOG_SNAPSHOT_DEDUPED",
          JSON.stringify({
            at: nowIso(),
            socketId: this.socketId,
            reason,
            mode,
            status: status || null,
            chars: text.length,
          })
        );
        return;
      }

      this.dedupe.add(dedupeHash);

      const payload = {
        sourceKey: this.sourceKey,
        mode,
        logText: text,
        meta: {
          collector: "render_syslog_collector",
          socketId: this.socketId,
          reason,
          classifierReason: classification?.reason || "forced_forward",
          receivedAt: nowIso(),
        },
      };

      if (mode === "deploy") {
        payload.deployId = buildDeployId(text);
        payload.status = status || "unknown";
      }

      const result = await postToIngest(payload);

      console.log(
        "SYSLOG_SNAPSHOT_INGEST_OK",
        JSON.stringify({
          at: nowIso(),
          socketId: this.socketId,
          reason,
          mode,
          status: payload.status || null,
          chars: text.length,
          httpStatus: result.status,
          ingestResult: result.body,
        })
      );
    } catch (error) {
      console.error(
        "SYSLOG_SNAPSHOT_INGEST_ERROR",
        JSON.stringify({
          at: nowIso(),
          socketId: this.socketId,
          reason,
          message: error?.message ? String(error.message) : "unknown_error",
        })
      );
    } finally {
      this.forwarding = false;
    }
  }

  async closeAndFlush() {
    await this.flush("socket_close");
  }
}

function createTlsServer() {
  const port = envInt("SYSLOG_TLS_PORT", 6514);
  const host = normalizeString(process.env.SYSLOG_TLS_HOST || "0.0.0.0") || "0.0.0.0";
  const sourceKey =
    normalizeString(process.env.COLLECTOR_SOURCE_KEY || "render_primary") || "render_primary";
  const idleFlushMs = envInt("COLLECTOR_IDLE_FLUSH_MS", 2500);
  const maxBufferChars = envInt("COLLECTOR_MAX_BUFFER_CHARS", 32000);
  const dedupeWindowMs = envInt("COLLECTOR_DEDUPE_WINDOW_MS", 180000);
  const forwardNonErrors = envBool("COLLECTOR_FORWARD_NON_ERRORS", false);

  const cert = readPemFromEnv({
    pemName: "SYSLOG_TLS_CERT_PEM",
    b64Name: "SYSLOG_TLS_CERT_BASE64",
    required: true,
  });

  const key = readPemFromEnv({
    pemName: "SYSLOG_TLS_KEY_PEM",
    b64Name: "SYSLOG_TLS_KEY_BASE64",
    required: true,
  });

  const ca = readPemFromEnv({
    pemName: "SYSLOG_TLS_CA_PEM",
    b64Name: "SYSLOG_TLS_CA_BASE64",
    required: false,
  });

  const dedupe = new DedupeWindow(dedupeWindowMs);

  const server = tls.createServer(
    {
      cert,
      key,
      ca: ca || undefined,
      requestCert: false,
      rejectUnauthorized: false,
      minVersion: "TLSv1.2",
    },
    (socket) => {
      const socketId = `${socket.remoteAddress || "unknown"}:${socket.remotePort || 0}:${Date.now()}`;
      const buffer = new SnapshotBuffer({
        socketId,
        sourceKey,
        idleFlushMs,
        maxBufferChars,
        dedupe,
        forwardNonErrors,
      });

      let partial = "";

      console.log(
        "SYSLOG_SOCKET_CONNECTED",
        JSON.stringify({
          at: nowIso(),
          socketId,
          remoteAddress: socket.remoteAddress || null,
          remotePort: socket.remotePort || null,
        })
      );

      socket.setEncoding("utf8");

      socket.on("data", (chunk) => {
        const text = String(chunk || "");
        const combined = partial + text;
        const parts = combined.split("\n");
        partial = parts.pop() || "";

        for (const line of parts) {
          buffer.pushLine(line);
        }
      });

      socket.on("end", async () => {
        if (partial.trim()) {
          buffer.pushLine(partial);
          partial = "";
        }
        await buffer.closeAndFlush();
      });

      socket.on("close", async () => {
        if (partial.trim()) {
          buffer.pushLine(partial);
          partial = "";
        }
        await buffer.closeAndFlush();

        console.log(
          "SYSLOG_SOCKET_CLOSED",
          JSON.stringify({
            at: nowIso(),
            socketId,
          })
        );
      });

      socket.on("error", (error) => {
        console.error(
          "SYSLOG_SOCKET_ERROR",
          JSON.stringify({
            at: nowIso(),
            socketId,
            message: error?.message ? String(error.message) : "unknown_error",
          })
        );
      });
    }
  );

  server.on("tlsClientError", (error, socket) => {
    console.error(
      "SYSLOG_TLS_CLIENT_ERROR",
      JSON.stringify({
        at: nowIso(),
        remoteAddress: socket?.remoteAddress || null,
        remotePort: socket?.remotePort || null,
        message: error?.message ? String(error.message) : "unknown_error",
      })
    );
  });

  server.listen(port, host, () => {
    console.log(
      "SYSLOG_COLLECTOR_LISTENING",
      JSON.stringify({
        at: nowIso(),
        host,
        port,
        sourceKey,
        idleFlushMs,
        maxBufferChars,
        dedupeWindowMs,
        forwardNonErrors,
      })
    );
  });

  return server;
}

try {
  createTlsServer();
} catch (error) {
  console.error(
    "SYSLOG_COLLECTOR_FATAL",
    JSON.stringify({
      at: nowIso(),
      message: error?.message ? String(error.message) : "unknown_error",
    })
  );
  process.exit(1);
}