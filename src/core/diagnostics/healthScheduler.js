// src/core/diagnostics/healthScheduler.js
// STAGE 7B — HealthScheduler skeleton
// IMPORTANT:
// - not attached to runtime yet
// - not called from command path
// - no automatic startup here
// - future use: worker / scheduler outside command pipeline

import os from "os";
import process from "process";
import pool from "../../../db.js";
import { isTransportEnforced } from "../../transport/transportConfig.js";
import {
  getHealthThresholds,
  getHealthSchedulerConfig,
} from "./healthConfig.js";

function classifyDbPing(ms, thresholds) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= thresholds.DB_PING_WARN_MS) return "OK";
  return "WARN";
}

function classifyEventLoopLag(ms, thresholds) {
  if (!Number.isFinite(ms)) return "WARN";
  if (ms <= thresholds.EVENT_LOOP_LAG_WARN_MS) return "OK";
  return "WARN";
}

function classifyHeapUsedMb(mb, thresholds) {
  if (!Number.isFinite(mb)) return "WARN";
  if (mb <= thresholds.HEAP_USED_WARN_MB) return "OK";
  return "WARN";
}

function classifyLoad(avg1, cpuCount) {
  if (!Number.isFinite(avg1) || !Number.isFinite(cpuCount) || cpuCount <= 0) {
    return "WARN";
  }
  if (avg1 <= cpuCount) return "OK";
  return "WARN";
}

function calcOverall(parts = []) {
  return parts.every((x) => x === "OK") ? "HEALTHY" : "WARN";
}

function buildSeverity(snapshot) {
  if (!snapshot) return "CRITICAL";

  const parts = [
    snapshot.transportStatus,
    snapshot.dbStatus,
    snapshot.loopStatus,
    snapshot.heapStatus,
    snapshot.loadStatus,
  ];

  if (parts.includes("WARN")) return "WARN";
  return "OK";
}

export async function takeHealthSnapshot() {
  const thresholds = getHealthThresholds();
  const enforced = isTransportEnforced();
  const mu = process.memoryUsage();

  const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 0;
  const load1 = Array.isArray(os.loadavg()) ? Number(os.loadavg()[0] || 0) : NaN;
  const heapUsedMb = Math.round((Number(mu.heapUsed || 0) / 1024 / 1024) * 10) / 10;

  const dbStart = process.hrtime.bigint();
  await pool.query(`SELECT 1 AS ok`);
  const dbPingMs = Number(process.hrtime.bigint() - dbStart) / 1e6;

  const loopStart = process.hrtime.bigint();
  const eventLoopLagMs = await new Promise((resolve) => {
    setTimeout(() => {
      const diffMs = Number(process.hrtime.bigint() - loopStart) / 1e6;
      resolve(Math.max(0, diffMs));
    }, 0);
  });

  const transportStatus = enforced ? "OK" : "WARN";
  const dbStatus = classifyDbPing(dbPingMs, thresholds);
  const loopStatus = classifyEventLoopLag(eventLoopLagMs, thresholds);
  const heapStatus = classifyHeapUsedMb(heapUsedMb, thresholds);
  const loadStatus = classifyLoad(load1, cpuCount);
  const overall = calcOverall([
    transportStatus,
    dbStatus,
    loopStatus,
    heapStatus,
    loadStatus,
  ]);

  return {
    ts: new Date().toISOString(),
    transportEnforced: enforced,
    transportStatus,
    dbStatus,
    loopStatus,
    heapStatus,
    loadStatus,
    overall,
    severity: buildSeverity({
      transportStatus,
      dbStatus,
      loopStatus,
      heapStatus,
      loadStatus,
    }),
    metrics: {
      dbPingMs: Math.round(dbPingMs),
      eventLoopLagMs: Math.round(eventLoopLagMs),
      heapUsedMb,
      rssMb: Math.round((Number(mu.rss || 0) / 1024 / 1024) * 10) / 10,
      loadavg1m: Number.isFinite(load1) ? Number(load1.toFixed(2)) : null,
      cpus: cpuCount,
    },
  };
}

export function createHealthScheduler(deps = {}) {
  const config = {
    ...getHealthSchedulerConfig(),
    ...(deps?.config || {}),
  };

  let timer = null;
  let isRunning = false;
  let lastSnapshot = null;
  let warnStreak = 0;
  let criticalStreak = 0;

  async function tick() {
    if (isRunning) return;
    isRunning = true;

    try {
      const snapshot = await takeHealthSnapshot();
      lastSnapshot = snapshot;

      if (snapshot.severity === "OK") {
        warnStreak = 0;
        criticalStreak = 0;
      } else if (snapshot.severity === "WARN") {
        warnStreak += 1;
        criticalStreak = 0;
      } else {
        criticalStreak += 1;
      }

      if (config.LOG_TO_CONSOLE) {
        console.log("HEALTH_SCHEDULER_TICK", {
          ts: snapshot.ts,
          overall: snapshot.overall,
          severity: snapshot.severity,
          warnStreak,
          criticalStreak,
          metrics: snapshot.metrics,
        });
      }

      if (
        typeof deps?.onWarn === "function" &&
        warnStreak >= config.WARN_CONSECUTIVE_COUNT
      ) {
        await deps.onWarn({
          snapshot,
          warnStreak,
          criticalStreak,
        });
      }

      if (
        typeof deps?.onCritical === "function" &&
        criticalStreak >= config.CRITICAL_CONSECUTIVE_COUNT
      ) {
        await deps.onCritical({
          snapshot,
          warnStreak,
          criticalStreak,
        });
      }
    } catch (e) {
      console.error("HealthScheduler.tick failed:", e);
    } finally {
      isRunning = false;
    }
  }

  function start() {
    if (timer) {
      return { started: false, reason: "already_started" };
    }

    if (!config.ENABLED) {
      return { started: false, reason: "disabled_by_config" };
    }

    timer = setInterval(() => {
      void tick();
    }, config.INTERVAL_MS);

    return {
      started: true,
      intervalMs: config.INTERVAL_MS,
    };
  }

  function stop() {
    if (!timer) {
      return { stopped: false, reason: "not_started" };
    }

    clearInterval(timer);
    timer = null;

    return { stopped: true };
  }

  function status() {
    return {
      enabled: Boolean(config.ENABLED),
      running: Boolean(timer),
      intervalMs: config.INTERVAL_MS,
      warnConsecutiveCount: config.WARN_CONSECUTIVE_COUNT,
      criticalConsecutiveCount: config.CRITICAL_CONSECUTIVE_COUNT,
      warnStreak,
      criticalStreak,
      lastSnapshot,
    };
  }

  return {
    start,
    stop,
    tick,
    status,
  };
}

export default {
  takeHealthSnapshot,
  createHealthScheduler,
};