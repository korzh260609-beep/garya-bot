// src/projectExperience/ProjectTimelineBuilder.js
// ============================================================================
// STAGE C.3A — Project Timeline Builder (SKELETON)
// Purpose:
// - connect commits, actions, decisions, manual claims and memory facts by time
// - preserve chronology so SG can understand how project work evolved
// - prepare future Project Memory timeline/digest writes
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - NO final stage completion claims
// ============================================================================

function safeText(value) {
  return String(value ?? "").trim();
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTime(value) {
  const raw = safeText(value);
  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function fallbackTime() {
  return "9999-12-31T23:59:59.999Z";
}

function inferTimeFromEvidence(evidence = {}) {
  return (
    normalizeTime(evidence?.time) ||
    normalizeTime(evidence?.createdAt) ||
    normalizeTime(evidence?.updatedAt) ||
    normalizeTime(evidence?.details?.createdAt) ||
    normalizeTime(evidence?.details?.committedAt) ||
    normalizeTime(evidence?.details?.authoredAt) ||
    normalizeTime(evidence?.details?.timestamp) ||
    null
  );
}

function normalizeTimelineItem(raw = {}, index = 0) {
  const source = safeText(raw?.source) || "unknown";
  const type = safeText(raw?.type) || "unknown";
  const time = inferTimeFromEvidence(raw);

  return {
    id: safeText(raw?.id) || `${source}:${type}:${safeText(raw?.ref) || index}`,
    time,
    sortTime: time || fallbackTime(),
    source,
    type,
    ref: safeText(raw?.ref),
    title: safeText(raw?.title),
    summary: safeText(raw?.summary),
    details: raw?.details && typeof raw.details === "object" && !Array.isArray(raw.details) ? raw.details : {},
    confidence: safeText(raw?.confidence) || "unknown",
  };
}

export class ProjectTimelineBuilder {
  buildTimeline({
    repoEvidences = [],
    diffEvidences = [],
    pillarEvidences = [],
    memoryEvidences = [],
    manualClaims = [],
  } = {}) {
    const rawItems = [
      ...ensureArray(repoEvidences),
      ...ensureArray(diffEvidences),
      ...ensureArray(pillarEvidences),
      ...ensureArray(memoryEvidences),
      ...ensureArray(manualClaims),
    ];

    const items = rawItems
      .map((item, index) => normalizeTimelineItem(item, index))
      .sort((a, b) => {
        if (a.sortTime < b.sortTime) return -1;
        if (a.sortTime > b.sortTime) return 1;
        return a.id.localeCompare(b.id);
      });

    const unknownTimeCount = items.filter((item) => !item.time).length;

    return {
      items,
      summary: {
        total: items.length,
        unknownTimeCount,
        hasUnknownTime: unknownTimeCount > 0,
        firstTime: items.find((item) => item.time)?.time || null,
        lastTime: [...items].reverse().find((item) => item.time)?.time || null,
      },
      warnings: unknownTimeCount > 0
        ? ["Some timeline items do not have a reliable timestamp."]
        : [],
    };
  }
}

export default {
  ProjectTimelineBuilder,
};
