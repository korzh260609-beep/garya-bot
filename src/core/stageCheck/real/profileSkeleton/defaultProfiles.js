// ============================================================================
// === src/core/stageCheck/real/profileSkeleton/defaultProfiles.js
// === non-runtime skeleton: initial profile registry draft
// ============================================================================

import { createNodeProfile } from "./profileContracts.js";

export const DEFAULT_STAGE_CHECK_PROFILES = Object.freeze([
  createNodeProfile({
    key: "foundation.runtime",
    family: "foundation",
    semanticTags: ["runtime", "transport"],
    titleHints: ["runtime", "transport", "telegram", "webhook", "bootstrap"],
    evidence: {
      weakSignals: ["package.json", "index.js", "express"],
      strongSignals: ["telegram adapter", "webhook", "processUpdate"],
      implementationSignals: ["index.js", "telegramTransport", "attach"],
      runtimeSignals: ["main", "start", "express", "setWebhook"],
      contextSignals: ["architecture", "transport"],
    },
    exact: {
      allowPartialWithoutReachability: true,
      requireOwnImplementation: false,
      preferRuntimeEvidence: true,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: true,
      requireNonUnknownBaseForChildLift: false,
      requireReachabilityForComplete: true,
      minChildPartialCount: 1,
      minActiveRatio: 0.08,
    },
  }),

  createNodeProfile({
    key: "foundation.database",
    family: "foundation",
    semanticTags: ["database"],
    titleHints: ["database", "postgresql", "migration", "schema", "table"],
    evidence: {
      weakSignals: ["pg", "postgresql", "db"],
      strongSignals: ["create table", "migrations", "schema_version"],
      implementationSignals: ["pool.query(", "node-pg-migrate", "migrations"],
      runtimeSignals: ["db.js", "src/db", "src/db/index.js"],
      contextSignals: ["database", "storage"],
    },
    exact: {
      allowPartialWithoutReachability: true,
      requireOwnImplementation: false,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: true,
      requireNonUnknownBaseForChildLift: false,
      requireReachabilityForComplete: false,
      minChildPartialCount: 1,
      minActiveRatio: 0.08,
    },
  }),

  createNodeProfile({
    key: "foundation.tasks",
    family: "foundation",
    semanticTags: ["tasks"],
    titleHints: ["tasks", "job", "runner", "cron", "queue", "retry", "dlq"],
    evidence: {
      weakSignals: ["task", "job", "cron"],
      strongSignals: ["JobRunner", "retry", "dlq", "idempotency"],
      implementationSignals: ["enqueue(", "jobRunner", "task_run_key"],
      runtimeSignals: ["src/jobs", "src/tasks", "jobRunnerInstance"],
      contextSignals: ["task engine", "queue"],
    },
    exact: {
      allowPartialWithoutReachability: true,
      requireOwnImplementation: false,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: true,
      requireNonUnknownBaseForChildLift: false,
      requireReachabilityForComplete: false,
      minChildPartialCount: 1,
      minActiveRatio: 0.08,
    },
  }),

  createNodeProfile({
    key: "feature.sources",
    family: "feature",
    semanticTags: ["sources"],
    titleHints: ["source", "rss", "coingecko", "api", "json", "web"],
    evidence: {
      weakSignals: ["source", "rss", "api"],
      strongSignals: ["fetchFromSourceKey", "source_checks", "diag_source"],
      implementationSignals: ["coingecko", "rss", "html", "json"],
      runtimeSignals: ["src/sources"],
      contextSignals: ["source-first", "sources layer"],
    },
    exact: {
      allowPartialWithoutReachability: false,
      requireOwnImplementation: true,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: false,
      requireNonUnknownBaseForChildLift: true,
      requireReachabilityForComplete: false,
      minChildPartialCount: 2,
      minActiveRatio: 0.18,
    },
  }),

  createNodeProfile({
    key: "feature.memory",
    family: "feature",
    semanticTags: ["memory"],
    titleHints: ["memory", "context", "chat_memory", "session"],
    evidence: {
      weakSignals: ["memory", "context"],
      strongSignals: ["MemoryService", "chat_memory"],
      implementationSignals: ["read(", "write(", "recent("],
      runtimeSignals: ["src/core/MemoryService.js"],
      contextSignals: ["session", "history"],
    },
    exact: {
      allowPartialWithoutReachability: false,
      requireOwnImplementation: true,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: false,
      requireNonUnknownBaseForChildLift: true,
      requireReachabilityForComplete: false,
      minChildPartialCount: 2,
      minActiveRatio: 0.18,
    },
  }),

  createNodeProfile({
    key: "integration.external",
    family: "integration",
    semanticTags: ["transport", "sources"],
    titleHints: ["integration", "discord", "github", "zoom", "voice", "connector"],
    evidence: {
      weakSignals: ["adapter", "integration", "api"],
      strongSignals: ["discord", "github", "zoom", "voice"],
      implementationSignals: ["adapter", "integration", "connector"],
      runtimeSignals: ["transport", "attach"],
      contextSignals: ["integration layer"],
    },
    exact: {
      allowPartialWithoutReachability: false,
      requireOwnImplementation: true,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: false,
      requireNonUnknownBaseForChildLift: true,
      requireReachabilityForComplete: true,
      minChildPartialCount: 2,
      minActiveRatio: 0.18,
    },
  }),

  createNodeProfile({
    key: "generic.default",
    family: "generic",
    semanticTags: [],
    titleHints: [],
    evidence: {
      weakSignals: [],
      strongSignals: [],
      implementationSignals: [],
      runtimeSignals: [],
      contextSignals: [],
    },
    exact: {
      allowPartialWithoutReachability: false,
      requireOwnImplementation: true,
      preferRuntimeEvidence: false,
      strongSignalThreshold: 2,
      implementationAnchorThreshold: 2,
    },
    aggregate: {
      allowChildLift: false,
      requireNonUnknownBaseForChildLift: true,
      requireReachabilityForComplete: false,
      minChildPartialCount: 2,
      minActiveRatio: 0.18,
    },
  }),
]);

export default {
  DEFAULT_STAGE_CHECK_PROFILES,
};