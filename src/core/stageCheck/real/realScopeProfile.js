// ============================================================================
// === src/core/stageCheck/real/realScopeProfile.js
// === semantic profile + scope stats
// ============================================================================

export function addTagsFromPatterns(tags, text, patterns, tag) {
  if ((patterns || []).some((x) => text.includes(x))) {
    tags.add(tag);
  }
}

export function buildScopeSemanticProfile(scopeWorkflowItems) {
  const text = (scopeWorkflowItems || [])
    .map((item) => `${item?.title || ""}\n${item?.body || ""}`)
    .join("\n")
    .toLowerCase();

  const tags = new Set();

  addTagsFromPatterns(
    tags,
    text,
    [
      "base infrastructure",
      "node.js",
      "express",
      "webhook",
      "render",
      "runtime",
      "bootstrap",
      "entrypoint",
      "server",
      "http",
      "transport adapter concept",
      "unified context",
      "handlemessage",
    ],
    "runtime"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["telegram", "webhook", "process update", "adapter", "transport", "delivery"],
    "transport"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["postgresql", "database", "db", "migrations", "schema", "table", "storage"],
    "database"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["task", "tasks", "queue", "worker", "jobrunner", "cron", "retry", "dlq"],
    "tasks"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["access", "roles", "permissions", "guest", "monarch", "citizen", "can("],
    "access"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["identity", "global_user_id", "user_links", "linking flow", "platform_user_id", "multi-channel"],
    "identity"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["observability", "/health", "error_events", "logs", "metrics", "alerts", "diagnostics"],
    "observability"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["memory", "chat_memory", "context", "recent", "long-term", "recall"],
    "memory"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["sources", "rss", "html", "coingecko", "source cache", "fetch", "api"],
    "sources"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["file-intake", "ocr", "pdf", "docx", "audio transcript", "vision", "file"],
    "file_intake"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["capability", "diagram", "document generation", "code/repo analysis", "automation/webhook"],
    "capability"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["billing", "legal", "tariffs", "plans", "ai-credits", "privacy", "license"],
    "billing"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["risk", "market", "btc", "alerts", "rotation", "reenter", "exit_now"],
    "risk"
  );

  addTagsFromPatterns(
    tags,
    text,
    ["psych", "mood", "technique", "safe_policies", "therapy", "diagnosis"],
    "psycho"
  );

  if (tags.size === 0) {
    tags.add("generic");
  }

  return {
    tags: Array.from(tags),
    rawText: text,
  };
}

export function buildScopeStats(scopeWorkflowItems) {
  const items = Array.isArray(scopeWorkflowItems) ? scopeWorkflowItems : [];
  const exactItems = items.filter(
    (item) => String(item?.kind || "").toLowerCase() === "item"
  ).length;
  const stageItems = items.filter(
    (item) => {
      const kind = String(item?.kind || "").toLowerCase();
      return kind === "stage" || kind === "substage";
    }
  ).length;

  return {
    scopeItemCount: items.length,
    exactItems,
    stageItems,
    isLargeScope: items.length >= 8,
    isVeryLargeScope: items.length >= 14,
  };
}

export function hasSemanticOverlap(defTags, scopeTags) {
  const left = Array.isArray(defTags) ? defTags : [];
  const right = new Set(Array.isArray(scopeTags) ? scopeTags : []);
  return left.some((tag) => right.has(tag));
}

export default {
  addTagsFromPatterns,
  buildScopeSemanticProfile,
  buildScopeStats,
  hasSemanticOverlap,
};
