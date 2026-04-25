// src/projectExperience/GitCommitCollector.js
// ============================================================================
// STAGE C.2 — Git Commit Collector
// Purpose:
// - convert real GitHub commit payloads into Project Experience repo evidence
// - keep GitHub API access outside core reconciliation logic
// - support both search-commit summaries and full commit payloads
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO final stage/status decisions here
// ============================================================================

import {
  createProjectEvidence,
  PROJECT_EXPERIENCE_EVIDENCE_TYPES,
  PROJECT_EXPERIENCE_CONFIDENCE,
} from "./projectExperienceTypes.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function shortSha(value = "") {
  return safeText(value).slice(0, 12);
}

function normalizeCommitPayload(raw = {}) {
  const commit = raw?.commit && typeof raw.commit === "object" ? raw.commit : raw;

  return {
    sha: safeText(commit?.sha || raw?.sha),
    message: safeText(commit?.message || raw?.message),
    htmlUrl: safeText(commit?.html_url || raw?.html_url || raw?.display_url),
    createdAt: safeText(commit?.created_at || raw?.created_at),
    repositoryFullName: safeText(commit?.repository_full_name || raw?.repository_full_name),
    files: ensureArray(commit?.files || raw?.files),
    diff: safeText(commit?.diff || raw?.diff),
  };
}

function normalizeFileChange(file = {}) {
  return {
    filename: safeText(file?.filename),
    status: safeText(file?.status),
    additions: Number.isFinite(Number(file?.additions)) ? Number(file.additions) : null,
    deletions: Number.isFinite(Number(file?.deletions)) ? Number(file.deletions) : null,
    changes: Number.isFinite(Number(file?.changes)) ? Number(file.changes) : null,
    patch: safeText(file?.patch),
  };
}

export class GitCommitCollector {
  constructor({ repository = "korzh260609-beep/garya-bot", ref = "main" } = {}) {
    this.repository = repository;
    this.ref = ref;
  }

  commitToEvidence(rawCommit = {}) {
    const commit = normalizeCommitPayload(rawCommit);
    const files = ensureArray(commit.files).map(normalizeFileChange).filter((file) => file.filename);

    return createProjectEvidence({
      type: PROJECT_EXPERIENCE_EVIDENCE_TYPES.COMMIT,
      source: "github",
      ref: commit.sha,
      title: commit.message || `Commit ${shortSha(commit.sha)}`,
      summary: [
        `commit=${shortSha(commit.sha) || "unknown"}`,
        commit.message ? `message=${commit.message}` : null,
        files.length > 0 ? `files=${files.length}` : "files=unknown",
      ]
        .filter(Boolean)
        .join(" | "),
      details: {
        sha: commit.sha,
        message: commit.message,
        htmlUrl: commit.htmlUrl,
        createdAt: commit.createdAt,
        repository: commit.repositoryFullName || this.repository,
        ref: this.ref,
        files,
        hasDiff: !!commit.diff,
        diffLength: commit.diff.length,
      },
      confidence: commit.sha
        ? PROJECT_EXPERIENCE_CONFIDENCE.HIGH
        : PROJECT_EXPERIENCE_CONFIDENCE.LOW,
    });
  }

  commitsToEvidences(rawCommits = []) {
    return ensureArray(rawCommits).map((commit) => this.commitToEvidence(commit));
  }
}

export default {
  GitCommitCollector,
};
