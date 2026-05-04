// AGENT NOTE:
// RenderLogsCollector report builder skeleton.
// Purpose: format collected Render facts into markdown reports.
// Do not analyze logs, diagnose errors, call AI, or modify external state here.

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function formatDeploys(deploys = []) {
  const list = asArray(deploys);
  if (!list.length) return "-";

  return list.map((deploy, index) => {
    return [
      `${index + 1}) id=${safeText(deploy?.id)}`,
      `status=${safeText(deploy?.status)}`,
      `commit=${safeText(deploy?.commit)}`,
      `createdAt=${safeText(deploy?.createdAt)}`,
      `finishedAt=${safeText(deploy?.finishedAt)}`,
    ].join(" | ");
  }).join("\n");
}

function formatLogs(logs = [], { limit = 100, maxLineChars = 700 } = {}) {
  const max = clampInt(limit, 100, 1, 1000);
  const maxChars = clampInt(maxLineChars, 700, 80, 2000);
  const list = asArray(logs).slice(0, max);

  if (!list.length) return "-";

  return list.map((item, index) => {
    const timestamp = safeText(item?.timestamp);
    const level = safeText(item?.level);
    const rawMessage = safeText(item?.message);
    const message = rawMessage.length > maxChars
      ? `${rawMessage.slice(0, maxChars - 1)}…`
      : rawMessage;

    return `${index + 1}) [${timestamp}] [${level}] ${message}`;
  }).join("\n");
}

export function buildRenderDeploysReport({ deploys = [], metadata = {} } = {}) {
  const collectedAt = metadata.collectedAt || nowIso();

  return `# RENDER_DEPLOYS_REPORT\n\nFactual Render deploys report collected by RenderLogsCollector.\n\n---\n\nCollected at: \`${collectedAt}\`\nAnalysis: \`none\`\nCode changes: \`none\`\nRender mutations: \`none\`\n\n---\n\n## Summary\n\n- Deploys returned: \`${asArray(deploys).length}\`\n\n## Deploys\n\n\`\`\`text\n${formatDeploys(deploys)}\n\`\`\`\n`;
}

export function buildRenderDeployReport({ deploy = {}, metadata = {} } = {}) {
  const collectedAt = metadata.collectedAt || nowIso();

  return `# RENDER_DEPLOY_REPORT\n\nFactual Render single deploy report collected by RenderLogsCollector.\n\n---\n\nCollected at: \`${collectedAt}\`\nAnalysis: \`none\`\nCode changes: \`none\`\nRender mutations: \`none\`\n\n---\n\n## Deploy\n\n\`\`\`text\nid=${safeText(deploy?.id)}\nstatus=${safeText(deploy?.status)}\ncommit=${safeText(deploy?.commit)}\ncreatedAt=${safeText(deploy?.createdAt)}\nfinishedAt=${safeText(deploy?.finishedAt)}\n\`\`\`\n`;
}

export function buildRenderLogsReport({ logs = [], metadata = {} } = {}) {
  const collectedAt = metadata.collectedAt || nowIso();
  const limit = clampInt(metadata.limit, 100, 1, 1000);
  const maxLineChars = clampInt(metadata.maxLineChars, 700, 80, 2000);

  return `# RENDER_LOGS_REPORT\n\nFactual Render logs report collected by RenderLogsCollector.\n\n---\n\nCollected at: \`${collectedAt}\`\nTarget: \`${safeText(metadata.target, "latest_count")}\`\nDeploy ID: \`${safeText(metadata.deployId)}\`\nRequested: \`${limit}\`\nReturned: \`${asArray(logs).length}\`\nAnalysis: \`none\`\nCode changes: \`none\`\nRender mutations: \`none\`\n\n---\n\n## Logs\n\n\`\`\`text\n${formatLogs(logs, { limit, maxLineChars })}\n\`\`\`\n`;
}

export function buildRenderStatusReport({ status = {}, metadata = {} } = {}) {
  const collectedAt = metadata.collectedAt || nowIso();

  return `# RENDER_STATUS_REPORT\n\nFactual Render status report collected by RenderLogsCollector.\n\n---\n\nCollected at: \`${collectedAt}\`\nAnalysis: \`none\`\nCode changes: \`none\`\nRender mutations: \`none\`\n\n---\n\n## Status\n\n\`\`\`text\nready=${safeText(status?.ready)}\nserviceId=${safeText(status?.serviceId)}\nserviceName=${safeText(status?.serviceName)}\nlatestDeployId=${safeText(status?.latestDeployId)}\nlatestCommit=${safeText(status?.latestCommit)}\n\`\`\`\n`;
}

export default {
  buildRenderDeploysReport,
  buildRenderDeployReport,
  buildRenderLogsReport,
  buildRenderStatusReport,
};
