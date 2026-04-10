// ============================================================================
// === src/bot/handlers/stage-check/workflowParser.js
// ============================================================================

import {
  normalizeItemCode,
  normalizeText,
  getParentCode,
  isSameOrDescendant,
} from "./common.js";

function extractStageHeading(line) {
  const match = String(line || "").match(/^# STAGE\s+([A-Za-z0-9.-]+)\s+—\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "stage",
  };
}

function extractSubHeading(line) {
  const match = String(line || "").match(/^##+\s+(.+)$/);
  if (!match) return null;

  const raw = String(match[1] || "").trim();

  const codeMatch =
    raw.match(/\b([0-9]+[A-Za-z]*(?:\.[A-Za-z0-9-]+)+)\b/) ||
    raw.match(/\b([0-9]+[A-Za-z]*)\b/);

  if (!codeMatch) return null;

  const code = normalizeItemCode(codeMatch[1]);
  const title = raw.replace(codeMatch[1], "").trim();

  return {
    code,
    title: title || raw,
    kind: "substage",
  };
}

function extractBulletItem(line) {
  const match = String(line || "").match(/^\s*-\s+([A-Za-z0-9.-]+)\s+(.+)$/);
  if (!match) return null;

  return {
    code: normalizeItemCode(match[1]),
    title: String(match[2] || "").trim(),
    kind: "point",
  };
}

export function parseWorkflowItems(workflowText) {
  const lines = String(workflowText || "").replace(/\r/g, "").split("\n");

  const rawItems = [];
  const seenCodes = new Set();

  let insideWorkflow = false;
  let currentStageCode = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^## 4\)\s+WORKFLOW/i.test(line.trim())) {
      insideWorkflow = true;
      continue;
    }

    if (!insideWorkflow) continue;

    const stageHit = extractStageHeading(line);
    if (stageHit) {
      currentStageCode = stageHit.code;

      if (!seenCodes.has(stageHit.code)) {
        rawItems.push({
          ...stageHit,
          lineIndex: i,
          parentCode: null,
        });
        seenCodes.add(stageHit.code);
      }

      continue;
    }

    if (!currentStageCode) continue;

    const subHit = extractSubHeading(line);
    if (subHit && !seenCodes.has(subHit.code)) {
      rawItems.push({
        ...subHit,
        lineIndex: i,
        parentCode: getParentCode(subHit.code) || currentStageCode,
      });
      seenCodes.add(subHit.code);
      continue;
    }

    const bulletHit = extractBulletItem(line);
    if (bulletHit && !seenCodes.has(bulletHit.code)) {
      rawItems.push({
        ...bulletHit,
        lineIndex: i,
        parentCode: getParentCode(bulletHit.code) || currentStageCode,
      });
      seenCodes.add(bulletHit.code);
    }
  }

  return rawItems.map((item, idx) => {
    const nextLineIndex =
      idx + 1 < rawItems.length ? rawItems[idx + 1].lineIndex : lines.length;

    const body = lines.slice(item.lineIndex + 1, nextLineIndex).join("\n").trim();

    return {
      code: item.code,
      title: item.title,
      kind: item.kind,
      parentCode: item.parentCode,
      body,
      normalizedTitle: normalizeText(item.title),
      normalizedBody: normalizeText(body),
      normalizedText: normalizeText(`${item.title}\n${body}`),
    };
  });
}

export function buildItemMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.code, item);
  }
  return map;
}

export function getAncestorChain(item, itemMap) {
  const chain = [];
  let currentParentCode = item?.parentCode || null;

  while (currentParentCode) {
    const parent = itemMap.get(currentParentCode);
    if (!parent) break;
    chain.push(parent);
    currentParentCode = parent.parentCode || null;
  }

  return chain;
}

export function getSubtreeItems(baseCode, evaluatedItems) {
  return evaluatedItems.filter((item) => isSameOrDescendant(baseCode, item.code));
}