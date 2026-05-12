// src/memory/project/projectMemoryRuntimeContext.js
// SG 2.0 — Project Memory runtime read context bridge.
// Purpose: read confirmed Project Memory entries and convert them to bounded context facts/items.
// Do not add Telegram logic, AI calls, automatic writes, source sync, cron/timers, or transport handling here.

import { PROJECT_MEMORY_TRUST } from "./projectMemoryTypes.js";
import { ProjectMemoryStore } from "./projectMemoryStore.js";

export const PROJECT_MEMORY_RUNTIME_CONTEXT_VERSION = 1;

export const PROJECT_MEMORY_RUNTIME_CONTEXT_MODES = Object.freeze({
  READ_CONFIRMED_ONLY: "read_confirmed_only",
});

export const PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS = Object.freeze({
  maxEntries: 10,
  maxContentChars: 1200,
  maxTitleChars: 160,
});

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function clampText(value, maxChars = null) {
  const text = normalizeText(value);
  if (!text) return "";

  const limit = Number.isFinite(Number(maxChars)) ? Math.max(1, Math.trunc(Number(maxChars))) : null;
  if (!limit || text.length <= limit) return text;

  return `${text.slice(0, limit)}…`;
}

function normalizeLimit(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeStore(store) {
  return store || new ProjectMemoryStore();
}

function normalizeLimits(limits = {}) {
  return {
    maxEntries: normalizeLimit(
      limits.maxEntries,
      PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS.maxEntries,
      1,
      50,
    ),
    maxContentChars: normalizeLimit(
      limits.maxContentChars,
      PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS.maxContentChars,
      100,
      6000,
    ),
    maxTitleChars: normalizeLimit(
      limits.maxTitleChars,
      PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS.maxTitleChars,
      20,
      400,
    ),
  };
}

function normalizeTags(tags = []) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => normalizeText(tag)).filter(Boolean);
}

function entryToProjectMemoryFact(entry = {}, limits = PROJECT_MEMORY_RUNTIME_CONTEXT_DEFAULT_LIMITS) {
  const title = clampText(entry.title, limits.maxTitleChars);
  const content = clampText(entry.content, limits.maxContentChars);

  return {
    content,
    source: entry.sourceRef || entry.sourceType || "project_memory_storage",
    metadata: {
      projectMemoryId: entry.id || "",
      projectKey: entry.projectKey || "sg",
      projectMemoryType: entry.type || "unknown",
      title,
      scope: entry.scope || "global_project",
      trust: entry.trust || PROJECT_MEMORY_TRUST.CONFIRMED,
      sourceType: entry.sourceType || null,
      sourceRef: entry.sourceRef || null,
      tags: normalizeTags(entry.tags),
      status: entry.status || "active",
      confirmedBy: entry.confirmedBy || "",
      confirmedAt: entry.confirmedAt || null,
      traceId: entry.traceId || "",
      runtimeContextBridgeVersion: PROJECT_MEMORY_RUNTIME_CONTEXT_VERSION,
    },
  };
}

function factToContextItem(fact = {}) {
  return {
    type: "project_memory",
    content: fact.content || "",
    source: fact.source || "project_memory_storage",
    priority: "below_verified_sources",
    trust: PROJECT_MEMORY_TRUST.CONFIRMED,
    scope: fact.metadata?.scope || "global_project",
    owner: "sg_project",
    metadata: fact.metadata || {},
  };
}

export class ProjectMemoryRuntimeContext {
  constructor({ store = null, logger = null } = {}) {
    this.store = normalizeStore(store);
    this.logger = logger || console;
  }

  status() {
    return {
      ok: true,
      module: "project_memory",
      service: "ProjectMemoryRuntimeContext",
      version: PROJECT_MEMORY_RUNTIME_CONTEXT_VERSION,
      mode: PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY,
      readsConfirmedOnly: true,
      writesStorage: false,
      confirmsCandidates: false,
      autoWriteFromChat: false,
      autoWriteFromAI: false,
      sourceSync: false,
      telegramConnected: false,
      callsAI: false,
      injectsPrompt: false,
    };
  }

  getDiagnostics() {
    return {
      ok: true,
      module: "project_memory",
      service: "ProjectMemoryRuntimeContext",
      version: PROJECT_MEMORY_RUNTIME_CONTEXT_VERSION,
      mode: PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY,
      boundaries: {
        usesProjectMemoryStore: true,
        confirmedOnly: true,
        transportIndependent: true,
        aiIndependent: true,
        sourceSyncIndependent: true,
        promptInjectionIndependent: true,
      },
      sideEffects: {
        readsStorage: true,
        writesStorage: false,
        confirmsCandidates: false,
        autoWritesFromChat: false,
        callsAI: false,
        touchesTelegram: false,
        fetchesSources: false,
        writesRuntimeFiles: false,
        modifiesRepository: false,
        injectsPrompt: false,
      },
      supportedActions: [
        "status",
        "getDiagnostics",
        "loadConfirmedProjectMemoryFacts",
        "buildConfirmedProjectMemoryContextItems",
      ],
      blockedActions: [
        "create_candidate",
        "confirm_candidate",
        "auto_write_from_chat",
        "ai_auto_write",
        "source_sync",
        "telegram_command",
        "prompt_injection",
        "raw_log_storage",
        "secret_storage",
      ],
    };
  }

  async loadConfirmedProjectMemoryFacts({ projectKey = "sg", limits = {} } = {}) {
    const safeProjectKey = normalizeText(projectKey) || "sg";
    const safeLimits = normalizeLimits(limits);

    const result = await this.store.listEntries({
      projectKey: safeProjectKey,
      trust: PROJECT_MEMORY_TRUST.CONFIRMED,
      status: "active",
      limit: safeLimits.maxEntries,
    });

    if (!result.ok) {
      return {
        ok: false,
        mode: PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY,
        reason: result.reason || "project_memory_storage_read_failed",
        storage: result,
        facts: [],
        warnings: [],
        limits: safeLimits,
      };
    }

    const warnings = [];
    const facts = [];

    for (const entry of result.entries || []) {
      if (entry.trust !== PROJECT_MEMORY_TRUST.CONFIRMED || entry.status !== "active") {
        warnings.push({
          code: "non_confirmed_project_memory_skipped",
          message: "Project Memory entry was skipped because it is not confirmed and active.",
          entryId: entry.id || "",
        });
        continue;
      }

      const fact = entryToProjectMemoryFact(entry, safeLimits);
      if (!fact.content) {
        warnings.push({
          code: "empty_project_memory_content_skipped",
          message: "Project Memory entry was skipped because content is empty.",
          entryId: entry.id || "",
        });
        continue;
      }

      facts.push(fact);
    }

    return {
      ok: true,
      mode: PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY,
      facts,
      rowCount: result.rowCount || facts.length,
      warnings,
      limits: safeLimits,
    };
  }

  async buildConfirmedProjectMemoryContextItems({ projectKey = "sg", limits = {} } = {}) {
    const loaded = await this.loadConfirmedProjectMemoryFacts({ projectKey, limits });

    if (!loaded.ok) {
      return {
        ...loaded,
        items: [],
      };
    }

    return {
      ok: true,
      mode: PROJECT_MEMORY_RUNTIME_CONTEXT_MODES.READ_CONFIRMED_ONLY,
      items: loaded.facts.map(factToContextItem),
      facts: loaded.facts,
      warnings: loaded.warnings,
      limits: loaded.limits,
    };
  }
}

export function createProjectMemoryRuntimeContext(options = {}) {
  return new ProjectMemoryRuntimeContext(options);
}

export default ProjectMemoryRuntimeContext;
