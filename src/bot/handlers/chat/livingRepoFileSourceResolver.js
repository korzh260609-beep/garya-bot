// src/bot/handlers/chat/livingRepoFileSourceResolver.js
// ============================================================================
// Living Repo File Source Resolver
//
// Purpose:
// - read one explicitly requested repository file through the existing
//   RepoStateGitHubClient;
// - return prompt-safe source evidence for GPT/model analysis;
// - keep this strictly read-only and separate from repo write authority.
//
// Hard boundaries:
// - read-only only;
// - no repository writes;
// - no branch writes;
// - no commit / PR / deploy;
// - no executor;
// - no Technical Mode command surface;
// - no phrase response builder.
// ============================================================================

import { getRepoStateConfig } from "../../../repoStateCollector/RepoStateConfig.js";
import RepoStateGitHubClient from "../../../repoStateCollector/RepoStateGitHubClient.js";

const DEFAULT_REPO_FULL_NAME = "korzh260609-beep/garya-bot";
const DEFAULT_BRANCH = "main";
const MAX_FILE_CHARS = 30_000;

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeRepoPath(value = "") {
  return safeText(value)
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function isUnsafePath(path = "") {
  const normalized = normalizeRepoPath(path);
  return (
    !normalized ||
    normalized.includes("..") ||
    normalized.startsWith(".") && normalized !== ".env.example" ||
    normalized.includes("//")
  );
}

function looksLikeRepoFilePath(token = "") {
  const path = normalizeRepoPath(token);
  if (!path || isUnsafePath(path)) return false;
  if (!path.includes("/")) return /\.[a-z0-9]+$/i.test(path);
  return /\.[a-z0-9]+$/i.test(path);
}

export function extractExplicitRepoFilePath(text = "") {
  const raw = safeText(text);
  if (!raw) return "";

  const quoted = raw.match(/["'`]([^"'`]+\.[a-z0-9]+)["'`]/i);
  if (quoted?.[1] && looksLikeRepoFilePath(quoted[1])) {
    return normalizeRepoPath(quoted[1]);
  }

  const fenced = raw.match(/(?:файл|file|open|прочитай|открой|read)\s+([A-Za-z0-9._/-]+\.[A-Za-z0-9]+)/i);
  if (fenced?.[1] && looksLikeRepoFilePath(fenced[1])) {
    return normalizeRepoPath(fenced[1]);
  }

  const tokens = raw.split(/\s+/).map((item) => item.replace(/[,:;!?)}\]]+$/g, ""));
  const found = tokens.find(looksLikeRepoFilePath);
  return found ? normalizeRepoPath(found) : "";
}

function buildFileEvidenceMessage({ repoFullName, branch, path, result }) {
  const content = safeText(result?.content);
  const truncated = content.length > MAX_FILE_CHARS;
  const safeContent = truncated ? content.slice(0, MAX_FILE_CHARS) : content;

  return {
    role: "system",
    content: [
      "REPO FILE SOURCE EVIDENCE:",
      "status=confirmed",
      "verified=true",
      "canClaimVerifiedFacts=true",
      "canAuthorizeWrite=false",
      "readOnly=true",
      `repo.fullName=${repoFullName}`,
      `repo.branch=${branch}`,
      `file.path=${path}`,
      `file.sha=${safeText(result?.sha, "-")}`,
      `file.size=${Number.isFinite(Number(result?.size)) ? Number(result.size) : "unknown"}`,
      `file.encoding=${safeText(result?.encoding, "-")}`,
      `file.contentTruncated=${String(truncated)}`,
      "Instruction: Use this file content as verified repository source evidence for this exact file only.",
      "Instruction: Do not claim other file contents unless separate verified evidence is provided.",
      "Safety: This evidence does not authorize repository writes, commits, PRs, deploys, deletes or file modifications.",
      "",
      "FILE CONTENT:",
      safeContent,
    ].join("\n"),
  };
}

export async function resolveLivingRepoFileSource({ text = "", livingSGPlan = null } = {}) {
  const path = extractExplicitRepoFilePath(text);

  if (!path) {
    return {
      sourceResultSystemMessage: null,
      handled: false,
      reason: "explicit_repo_file_path_missing",
      path: "",
    };
  }

  if (livingSGPlan?.capabilityPlan?.actionType && livingSGPlan.capabilityPlan.actionType !== "read_only") {
    return {
      sourceResultSystemMessage: null,
      handled: false,
      reason: "living_plan_not_read_only",
      path,
    };
  }

  if (isUnsafePath(path)) {
    return {
      sourceResultSystemMessage: null,
      handled: false,
      reason: "unsafe_repo_file_path",
      path,
    };
  }

  try {
    const config = getRepoStateConfig();
    const repoFullName = safeText(config.repoFullName) || DEFAULT_REPO_FULL_NAME;
    const branch = safeText(config.branch) || DEFAULT_BRANCH;
    const client = new RepoStateGitHubClient({
      token: config.githubToken,
      apiBaseUrl: config.githubApiBaseUrl,
    });

    const result = await client.readFile({
      repoFullName,
      branch,
      path,
    });

    return {
      sourceResultSystemMessage: buildFileEvidenceMessage({
        repoFullName,
        branch,
        path,
        result,
      }),
      handled: true,
      reason: "repo_file_source_evidence_confirmed",
      path,
      metadata: {
        readOnly: true,
        noRepoWrite: true,
        noExecutor: true,
        repoFullName,
        branch,
        fileSha: result?.sha || null,
        fileSize: Number.isFinite(Number(result?.size)) ? Number(result.size) : null,
      },
    };
  } catch (error) {
    return {
      sourceResultSystemMessage: {
        role: "system",
        content: [
          "REPO FILE SOURCE EVIDENCE:",
          "status=failed",
          "verified=false",
          "canClaimVerifiedFacts=false",
          "canAuthorizeWrite=false",
          "readOnly=true",
          `file.path=${path}`,
          `reason=${safeText(error?.message || "repo_file_read_failed")}`,
          "Instruction: The requested file was not verified in current runtime. Do not invent its content.",
          "Safety: This failed read does not authorize repository writes.",
        ].join("\n"),
      },
      handled: false,
      reason: "repo_file_read_failed",
      path,
      error: error?.message || "unknown_error",
    };
  }
}

export default {
  extractExplicitRepoFilePath,
  resolveLivingRepoFileSource,
};
