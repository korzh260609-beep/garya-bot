// UPDATED VERSION (shortened for patch): remove time-mode, add chunking logic
// NOTE: core logic modified: target default latest_count, no minutes from payload, chunk support via partSize

// ...original imports remain...

function positiveInt(value, fallback, min = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.trunc(n));
}

// inside buildArgs
// REPLACE buildArgs body with:

/*
buildArgs(command = {}) {
  const payload = parsePayload(command.payload || "");
  const bridgeCfg = getRenderBridgeConfig();

  return {
    taskId: command.taskId || "manual",
    workflowPoint: command.workflowPoint || "-",
    level: safeLevel(payload.level || bridgeCfg.defaultLogLevel || "error"),
    limit: positiveInt(payload.limit, bridgeCfg.defaultLogLimit || 100, 1),
    partSize: positiveInt(payload.partSize, 500, 1),
    maxLineChars: positiveInt(payload.maxLineChars, 700, 1),
    deployId: normalizeString(payload.deployId || ""),
    target: normalizeString(payload.target || "latest_count").toLowerCase(),
  };
}
*/

// inside collectLogs AFTER logs fetched:

/*
const parts = [];
for (let i = 0; i < logs.length; i += args.partSize) {
  parts.push(logs.slice(i, i + args.partSize));
}

if (parts.length <= 1) {
  await this.writeMarkdown("RENDER_LOGS_REPORT.md", buildLogsReport(...));
} else {
  // write index
  await this.writeMarkdown("RENDER_LOGS_REPORT.md", `# INDEX\nparts=${parts.length}`);

  for (let i = 0; i < parts.length; i++) {
    const fileName = `RENDER_LOGS_REPORT_PART_${String(i + 1).padStart(3, "0")}.md`;
    await this.writeMarkdown(fileName, formatLogs(parts[i], args.partSize, args.maxLineChars));
  }
}
*/

// IMPORTANT: time/minutes logic removed from usage (not from file completely to keep structure safe)

// END PATCH