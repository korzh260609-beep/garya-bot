// ============================================================================
// === src/core/stageCheck/real/realProfileRegistry.js
// === universal workflow-node profile registry for real stage check
// ============================================================================

function mergeUniqueStrings(...lists) {
  return [...new Set(lists.flat().map((x) => String(x || "").trim()).filter(Boolean))];
}

export function getRealProfileRegistry() {
  return {
    "foundation.runtime": {
      key: "foundation.runtime",
      family: "foundation",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: true,
        requireOwnImplementationForPartial: false,
        preferRuntimeFoundationEvidence: true,
      },
      aggregatePolicy: {
        allowChildFoundationLift: true,
        requireNonUnknownBaseForChildLift: false,
        requireReachabilityForComplete: true,
      },
      semantic: {
        tags: ["runtime", "transport"],
        implementationTokens: [
          "index.js",
          "package.json",
          "main",
          "start",
          "express",
          "webhook",
          "telegram",
          "transport",
        ],
      },
    },

    "foundation.database": {
      key: "foundation.database",
      family: "foundation",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: true,
        requireOwnImplementationForPartial: false,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: true,
        requireNonUnknownBaseForChildLift: false,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: ["database"],
        implementationTokens: [
          "pg",
          "postgresql",
          "pool.query(",
          "migrations",
          "schema_version",
          "create table",
        ],
      },
    },

    "foundation.tasks": {
      key: "foundation.tasks",
      family: "foundation",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: true,
        requireOwnImplementationForPartial: false,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: true,
        requireNonUnknownBaseForChildLift: false,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: ["tasks"],
        implementationTokens: [
          "JobRunner",
          "enqueue(",
          "retry",
          "dlq",
          "cron",
          "/tasks",
          "/run",
          "/newtask",
          "idempotency",
          "task_run_key",
        ],
      },
    },

    "foundation.access": {
      key: "foundation.access",
      family: "foundation",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: true,
        requireOwnImplementationForPartial: false,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: true,
        requireNonUnknownBaseForChildLift: false,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: ["access", "identity", "memory", "sources"],
        implementationTokens: [
          "permissions",
          "can(",
          "guest",
          "monarch",
          "global_user_id",
          "user_links",
          "memory",
          "source",
        ],
      },
    },

    "integration.external": {
      key: "integration.external",
      family: "integration",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: false,
        requireOwnImplementationForPartial: true,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: false,
        requireNonUnknownBaseForChildLift: true,
        requireReachabilityForComplete: true,
      },
      semantic: {
        tags: ["integration", "transport", "sources"],
        implementationTokens: [
          "discord",
          "github",
          "zoom",
          "voice",
          "api",
          "adapter",
          "integration",
        ],
      },
    },

    "feature.sources": {
      key: "feature.sources",
      family: "feature",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: false,
        requireOwnImplementationForPartial: true,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: false,
        requireNonUnknownBaseForChildLift: true,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: ["sources"],
        implementationTokens: [
          "source",
          "rss",
          "coingecko",
          "binance",
          "okx",
          "fetchFromSourceKey",
        ],
      },
    },

    "feature.memory": {
      key: "feature.memory",
      family: "feature",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: false,
        requireOwnImplementationForPartial: true,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: false,
        requireNonUnknownBaseForChildLift: true,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: ["memory"],
        implementationTokens: [
          "chat_memory",
          "MemoryService",
          "context",
          "recent",
          "read",
          "write",
        ],
      },
    },

    "feature.generic": {
      key: "feature.generic",
      family: "feature",
      exactPolicy: {
        allowFoundationPartialWithoutReachability: false,
        requireOwnImplementationForPartial: true,
        preferRuntimeFoundationEvidence: false,
      },
      aggregatePolicy: {
        allowChildFoundationLift: false,
        requireNonUnknownBaseForChildLift: true,
        requireReachabilityForComplete: false,
      },
      semantic: {
        tags: [],
        implementationTokens: [],
      },
    },
  };
}

export function getRealProfileByKey(profileKey) {
  const registry = getRealProfileRegistry();
  return registry[profileKey] || registry["feature.generic"];
}

export function getAllRealProfiles() {
  const registry = getRealProfileRegistry();
  return Object.values(registry);
}

export function collectProfileSemanticTokens(profile) {
  return mergeUniqueStrings(
    profile?.semantic?.tags || [],
    profile?.semantic?.implementationTokens || []
  );
}

export default {
  getRealProfileRegistry,
  getRealProfileByKey,
  getAllRealProfiles,
  collectProfileSemanticTokens,
};