// src/capabilities/capabilityRegistry.js
// ============================================================================
// STAGE 12A.5 — CAPABILITY REGISTRY (SKELETON)
// Purpose:
// - keep capability definitions in one place
// - avoid scattered hardcode across handlers
// - registry only, no execution side-effects
// ============================================================================

export const CAPABILITY_REGISTRY_VERSION = "12A.5-skeleton-v1";

const CAPABILITIES = [
  {
    key: "diagram_chart",
    title: "Diagram / Chart capability",
    stage: "12A.1",
    status: "skeleton",
    command: "/cap_diagram",
    readOnly: true,
    autoExecute: false,
    fileOutput: false,
    supportedRequests: [
      "diagram_plan",
      "chart_plan",
      "mermaid_plan",
      "flow_plan",
    ],
    outputModes: [
      "registry_info",
      "request_echo",
      "safe_plan_only",
    ],
    currentLimits: [
      "No real image/chart generation yet",
      "No file export yet",
      "No external renderer yet",
    ],
    notes:
      "Skeleton only. Defines safe contract and user-facing status for future diagram/chart generation.",
  },
  {
    key: "document_generation",
    title: "Document generation capability",
    stage: "12A.2",
    status: "skeleton",
    command: "/cap_doc",
    readOnly: true,
    autoExecute: false,
    fileOutput: false,
    supportedRequests: [
      "doc_plan",
      "report_plan",
      "pdf_plan",
      "docx_plan",
    ],
    outputModes: [
      "registry_info",
      "request_echo",
      "safe_plan_only",
    ],
    currentLimits: [
      "No PDF/DOCX artifact generation in this skeleton",
      "No storage/export pipeline yet",
      "No template registry yet",
    ],
    notes:
      "Skeleton only. Defines future document-generation contract without creating files yet.",
  },
  {
    key: "code_repo_analysis",
    title: "Code / Repo analysis capability",
    stage: "12A.3",
    status: "partial_read_only",
    command: "/repo_analyze",
    readOnly: true,
    autoExecute: false,
    fileOutput: false,
    supportedRequests: [
      "repo_status",
      "repo_tree",
      "repo_search",
      "repo_file",
      "repo_analyze",
      "reindex",
    ],
    outputModes: [
      "read_only_analysis",
      "snapshot_based_lookup",
      "safe_summary",
    ],
    currentLimits: [
      "No write-back to repo",
      "No deploy",
      "No auto-PR in this stage",
    ],
    notes:
      "Partially active through snapshot-based repo tooling and read-only analysis commands.",
  },
  {
    key: "automation_webhook",
    title: "Automation / Webhook capability",
    stage: "12A.4",
    status: "skeleton",
    command: "/cap_automation",
    readOnly: true,
    autoExecute: false,
    fileOutput: false,
    supportedRequests: [
      "automation_plan",
      "webhook_plan",
      "trigger_plan",
      "delivery_plan",
    ],
    outputModes: [
      "registry_info",
      "request_echo",
      "safe_plan_only",
    ],
    currentLimits: [
      "No real webhook creation from this command",
      "No external endpoint registration",
      "No secrets/config mutation",
    ],
    notes:
      "Skeleton only. Defines future automation/webhook capability contract without side-effects.",
  },
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function listCapabilities() {
  return CAPABILITIES.map((item) => ({ ...item }));
}

export function getCapabilityByKey(key) {
  const normalized = normalizeText(key);
  if (!normalized) return null;

  const found = CAPABILITIES.find((item) => normalizeText(item.key) === normalized);
  return found ? { ...found } : null;
}

export function getCapabilityByCommand(command) {
  const normalized = normalizeText(command);
  if (!normalized) return null;

  const found = CAPABILITIES.find(
    (item) => normalizeText(item.command) === normalized
  );
  return found ? { ...found } : null;
}

export function resolveCapability(ref) {
  return getCapabilityByKey(ref) || getCapabilityByCommand(ref) || null;
}

export function buildCapabilityRegistrySummary() {
  const items = listCapabilities();

  return {
    registryVersion: CAPABILITY_REGISTRY_VERSION,
    total: items.length,
    items: items.map((item) => ({
      key: item.key,
      title: item.title,
      stage: item.stage,
      status: item.status,
      command: item.command,
      readOnly: item.readOnly === true,
      autoExecute: item.autoExecute === true,
      fileOutput: item.fileOutput === true,
    })),
  };
}

export default {
  CAPABILITY_REGISTRY_VERSION,
  listCapabilities,
  getCapabilityByKey,
  getCapabilityByCommand,
  resolveCapability,
  buildCapabilityRegistrySummary,
};