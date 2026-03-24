// src/core/memory/MemoryBufferService.js
// STAGE 11.x — extracted buffer/queue service
//
// Goal:
// - move queue / flush / shutdown hooks out of MemoryService
// - keep MemoryService as facade/orchestrator
// - NO schema changes
// - fail-open
//
// IMPORTANT:
// - this service does NOT know business logic of memory writes
// - actual direct execution is delegated through executeDirect(op)
// - MemoryService remains owner of writeService / contracts

export class MemoryBufferService {
  constructor({
    logger = console,
    getEnabled = () => false,
    executeDirect = async () => ({
      ok: false,
      stored: false,
      reason: "execute_direct_not_configured",
    }),
    contractVersion = 1,
    flushMs = 100,
    maxBatch = 200,
    maxQueue = 1500,
    enabled = false,
  } = {}) {
    this.logger = logger || console;
    this.getEnabled =
      typeof getEnabled === "function" ? getEnabled : () => false;
    this.executeDirect =
      typeof executeDirect === "function"
        ? executeDirect
        : async () => ({
            ok: false,
            stored: false,
            reason: "execute_direct_not_configured",
          });

    this.contractVersion = contractVersion;

    this.enabled = !!enabled;
    this.flushMs = Math.max(25, Math.min(500, Number(flushMs) || 100));
    this.maxBatch = Math.max(10, Math.min(500, Number(maxBatch) || 200));
    this.maxQueue = Math.max(50, Math.min(5000, Number(maxQueue) || 1500));

    this.queue = [];
    this.flushTimer = null;
    this.flushInFlight = false;
    this.shutdownHooksInstalled = false;
  }

  status() {
    return {
      enabled: this.enabled,
      flushMs: this.flushMs,
      maxBatch: this.maxBatch,
      maxQueue: this.maxQueue,
      queueSize: Array.isArray(this.queue) ? this.queue.length : 0,
      inFlight: !!this.flushInFlight,
      contractVersion: this.contractVersion,
    };
  }

  installShutdownHooksOnce() {
    if (!this.enabled) return;
    if (this.shutdownHooksInstalled) return;
    this.shutdownHooksInstalled = true;

    const flushAndLog = async (reason) => {
      try {
        await this.flushQueue(reason);
      } catch (e) {
        this.logger.error("Flush on shutdown failed (fail-open)", {
          reason,
          err: e?.message || e,
        });
      }
    };

    process.on("SIGTERM", () => {
      flushAndLog("SIGTERM").finally(() => process.exit(0));
    });

    process.on("SIGINT", () => {
      flushAndLog("SIGINT").finally(() => process.exit(0));
    });

    process.on("beforeExit", () => {
      flushAndLog("beforeExit");
    });
  }

  scheduleFlush() {
    if (!this.enabled) return;
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushQueue("timer").catch((e) => {
        this.logger.error("Buffered flush failed (fail-open)", {
          err: e?.message || e,
        });
      });
    }, this.flushMs);
  }

  async enqueueAndWait(op) {
    try {
      if (!Array.isArray(this.queue)) this.queue = [];

      if (this.queue.length >= this.maxQueue) {
        this.logger.error("Buffer queue overflow -> direct write (fail-open)", {
          size: this.queue.length,
          maxQueue: this.maxQueue,
          type: op?.type || "unknown",
        });
        return await this.executeDirect(op);
      }

      return await new Promise((resolve) => {
        this.queue.push({
          op,
          resolve,
          enqueuedAt: Date.now(),
        });
        this.scheduleFlush();
      });
    } catch (e) {
      this.logger.error("Enqueue failed -> direct write (fail-open)", {
        err: e?.message || e,
      });
      return await this.executeDirect(op);
    }
  }

  async flushQueue(reason = "unknown") {
    if (!this.enabled) return;
    if (this.flushInFlight) return;

    this.flushInFlight = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.maxBatch);

        for (const item of batch) {
          const { op, resolve } = item || {};
          if (!op || typeof resolve !== "function") continue;

          try {
            const res = await this.executeDirect(op);
            resolve(res);
          } catch (e) {
            this.logger.error("Buffered item failed (fail-open)", {
              reason,
              type: op?.type || "unknown",
              err: e?.message || e,
            });

            resolve({
              ok: false,
              enabled: !!this.getEnabled(),
              stored: false,
              backend: "chat_memory",
              contractVersion: this.contractVersion,
              reason: "buffered_item_failed",
            });
          }
        }

        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      this.flushInFlight = false;
    }
  }
}

export default MemoryBufferService;