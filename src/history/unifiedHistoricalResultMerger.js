import { createHash } from 'node:crypto';

const MAX_INPUT_ITEMS = 240;
const MAX_OUTPUT_ITEMS = 80;
const MAX_DUPLICATE_REFS = 20;
const MAX_CONFLICT_GROUPS = 30;
const TRUST_SCORE = Object.freeze({ verified: 1, confirmed: 0.85, reported: 0.6, unverified: 0.35 });
const CURRENT_LIFECYCLE_SCORE = Object.freeze({ active: 1, temporary: 0.85, superseded: 0.3, archived: 0.4, expired: 0.2, deleted: 0.05 });
const HISTORICAL_LIFECYCLE_SCORE = Object.freeze({ active: 0.9, temporary: 0.8, superseded: 0.9, archived: 0.75, expired: 0.65, deleted: 0.15 });

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}
function hash(value) { return createHash('sha256').update(String(value)).digest('hex'); }
function normalizedText(value) { return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
function tokens(value) { return [...new Set(normalizedText(value).split(/\s+/u).filter((item) => item.length > 1))]; }
function clamp(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}
function relevanceScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.45;
  if (number >= 0 && number <= 1) return number;
  if (number <= 0) return 0;
  return number / (1 + number);
}
function itemTimestamp(item) { return item.timestamp ?? item.validFrom ?? null; }
function timestampMs(value) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
function rangeOverlap(item, range) {
  if (!range?.utcStart || !range?.utcEndExclusive) return 0.6;
  const start = timestampMs(range.utcStart);
  const end = timestampMs(range.utcEndExclusive);
  if (start == null || end == null) return 0.6;
  const validStart = timestampMs(item.validFrom ?? itemTimestamp(item));
  const validEnd = timestampMs(item.validTo);
  if (validStart == null) return 0.55;
  if (validStart < end && (validEnd == null || validEnd > start)) return 1;
  const at = timestampMs(itemTimestamp(item));
  if (at != null && start <= at && at < end) return 1;
  return 0.1;
}
function scopeSpecificity(item) {
  const layer = item.metadata?.layer ?? item.kind ?? '';
  if (layer === 'thread-memory') return 1;
  if (layer === 'user-group-memory') return 0.95;
  if (layer === 'user-memory' || layer === 'group-memory') return 0.9;
  if (item.source === 'project-memory' || item.source === 'decision-memory' || item.source === 'pdk4') return 0.82;
  if (item.source === 'incident-memory') return 0.8;
  if (item.source === 'conversation-history') return 0.72;
  return 0.65;
}
function provenanceQuality(item) {
  const provenance = item.provenance;
  if (!provenance || typeof provenance !== 'object') return 0.25;
  const values = [provenance.sourceId, provenance.sourceRef, provenance.ref, provenance.conversationId, provenance.topicId, provenance.kind, provenance.sourceType, provenance.timestamp];
  const count = values.filter((value) => value != null && String(value).trim() !== '').length;
  return Math.min(1, 0.35 + count * 0.12);
}
function verificationState(item) {
  if (item.trust === 'verified') return 'verified';
  if (item.confirmed === true || item.trust === 'confirmed') return 'confirmed';
  if (item.trust === 'reported') return 'reported';
  return 'unverified';
}
function entityFit(item, plan) {
  const constraints = [...(plan?.entityConstraints ?? []), plan?.semanticSubject].filter(Boolean).map(normalizedText).filter(Boolean);
  if (!constraints.length) return 0.5;
  const entity = normalizedText(item.entityKey);
  const haystack = normalizedText(`${item.entityKey ?? ''} ${item.text ?? ''} ${stable(item.value ?? null)}`);
  for (const constraint of constraints) {
    if (entity && entity === constraint) return 1;
    if (entity && (entity.includes(constraint) || constraint.includes(entity))) return 0.9;
    if (haystack.includes(constraint)) return 0.82;
  }
  const queryTokens = new Set(constraints.flatMap(tokens));
  const itemTokens = new Set(tokens(haystack));
  if (!queryTokens.size || !itemTokens.size) return 0.35;
  let common = 0;
  for (const token of queryTokens) if (itemTokens.has(token)) common += 1;
  return clamp(common / queryTokens.size, 0.35);
}
function lifecycleScore(item, historical) {
  const state = item.lifecycle ?? null;
  if (!state) return 0.55;
  return (historical ? HISTORICAL_LIFECYCLE_SCORE : CURRENT_LIFECYCLE_SCORE)[state] ?? 0.5;
}
function scoreItem(item, plan) {
  const historical = Boolean(plan?.temporalRange);
  const components = {
    relevance: relevanceScore(item.relevance),
    temporal: rangeOverlap(item, plan?.temporalRange),
    entity: entityFit(item, plan),
    scope: scopeSpecificity(item),
    trust: TRUST_SCORE[item.trust] ?? 0.45,
    confirmation: item.confirmed === true ? 1 : item.confirmed === false ? 0.45 : 0.5,
    confidence: clamp(item.confidence, 0.5),
    provenance: provenanceQuality(item),
    lifecycle: lifecycleScore(item, historical)
  };
  const total = components.relevance * 0.24
    + components.temporal * 0.12
    + components.entity * 0.14
    + components.scope * 0.08
    + components.trust * 0.10
    + components.confirmation * 0.07
    + components.confidence * 0.06
    + components.provenance * 0.07
    + components.lifecycle * 0.12;
  return { score: Number(total.toFixed(6)), components: freeze(components) };
}
function evidenceRef(item) {
  return freeze({ source: item.source, sourceId: item.sourceId ?? null, kind: item.kind ?? null, timestamp: itemTimestamp(item), provenance: clone(item.provenance ?? null) });
}
function referenceTokens(item) {
  const values = [item.sourceId, item.provenance?.sourceId, item.provenance?.sourceRef, item.provenance?.ref, item.metadata?.sourceEventId, item.metadata?.traceId];
  return new Set(values.filter((value) => value != null && String(value).trim() !== '').map(String));
}
function sameReference(left, right) {
  const a = referenceTokens(left);
  const b = referenceTokens(right);
  for (const value of a) if (b.has(value)) return true;
  return false;
}
function valueFingerprint(item) { return hash(stable(item.value ?? item.text ?? null)); }
function duplicateRelation(left, right) {
  if (sameReference(left, right)) return 'shared-source-reference';
  if (left.entityKey && right.entityKey && normalizedText(left.entityKey) === normalizedText(right.entityKey) && valueFingerprint(left) === valueFingerprint(right)) return 'same-entity-value';
  const leftText = normalizedText(left.text);
  const rightText = normalizedText(right.text);
  if (leftText && rightText && leftText === rightText) return 'same-normalized-content';
  const leftDigestSources = new Set(Array.isArray(left.value?.sourceIds) ? left.value.sourceIds.map(String) : []);
  const rightDigestSources = new Set(Array.isArray(right.value?.sourceIds) ? right.value.sourceIds.map(String) : []);
  if (right.sourceId && leftDigestSources.has(String(right.sourceId))) return 'digest-source-reference';
  if (left.sourceId && rightDigestSources.has(String(left.sourceId))) return 'digest-source-reference';
  return null;
}
function successorId(item) {
  return item.metadata?.successorMemoryId ?? item.metadata?.supersededBy ?? item.metadata?.successorSourceId ?? null;
}
function isCurrent(item) { return item.lifecycle == null || ['active', 'temporary'].includes(item.lifecycle); }
function conflictKey(item) { return item.entityKey ? normalizedText(item.entityKey) : null; }
function publicItem(entry, rank) {
  return freeze({
    rank,
    score: entry.score,
    scoreComponents: entry.components,
    source: entry.item.source,
    sourceId: entry.item.sourceId ?? null,
    kind: entry.item.kind ?? 'evidence',
    timestamp: itemTimestamp(entry.item),
    validFrom: entry.item.validFrom ?? null,
    validTo: entry.item.validTo ?? null,
    entityKey: entry.item.entityKey ?? null,
    text: entry.item.text ?? '',
    value: clone(entry.item.value ?? null),
    trust: entry.item.trust ?? null,
    confirmed: entry.item.confirmed ?? null,
    confidence: entry.item.confidence ?? null,
    lifecycle: entry.item.lifecycle ?? null,
    verificationState: verificationState(entry.item),
    provenance: clone(entry.item.provenance ?? null),
    metadata: clone(entry.item.metadata ?? {}),
    duplicateEvidence: freeze(entry.duplicates.slice(0, MAX_DUPLICATE_REFS).map((duplicate) => freeze({ ...duplicate.ref, reason: duplicate.reason }))),
    supersession: successorId(entry.item) ? freeze({ successorSourceId: String(successorId(entry.item)), state: 'superseded-by' }) : null
  });
}

export const HISTORICAL_RESULT_MERGE_CONTRACT_VERSION = 1;

export function mergeHistoricalSearchResults({ plan, sources = [] } = {}) {
  if (!plan || plan.status !== 'planned') throw new TypeError('HS4 requires a planned historical query');
  if (!Array.isArray(sources)) throw new TypeError('HS4 sources must be an array');

  const flattened = [];
  for (const source of sources) {
    if (!source || !['ok', 'empty'].includes(source.status)) continue;
    for (const item of source.items ?? []) {
      if (flattened.length >= MAX_INPUT_ITEMS) break;
      if (item && typeof item === 'object') flattened.push(item);
    }
    if (flattened.length >= MAX_INPUT_ITEMS) break;
  }

  const decorated = flattened.map((item, index) => {
    const scoring = scoreItem(item, plan);
    return { item, index, score: scoring.score, components: scoring.components, duplicates: [] };
  }).sort((a, b) => b.score - a.score || String(itemTimestamp(b.item) ?? '').localeCompare(String(itemTimestamp(a.item) ?? '')) || a.index - b.index);

  const merged = [];
  let duplicateCount = 0;
  for (const candidate of decorated) {
    let duplicateOf = null;
    let duplicateReason = null;
    for (const existing of merged) {
      const relation = duplicateRelation(existing.item, candidate.item);
      if (relation) { duplicateOf = existing; duplicateReason = relation; break; }
    }
    if (duplicateOf) {
      duplicateOf.duplicates.push({ ref: evidenceRef(candidate.item), reason: duplicateReason });
      duplicateCount += 1;
      continue;
    }
    merged.push(candidate);
  }

  const bySourceId = new Map();
  for (const entry of merged) if (entry.item.sourceId != null) bySourceId.set(String(entry.item.sourceId), entry);
  const supersessionChains = [];
  for (const entry of merged) {
    const successor = successorId(entry.item);
    if (!successor) continue;
    const target = bySourceId.get(String(successor));
    supersessionChains.push(freeze({
      from: evidenceRef(entry.item),
      to: target ? evidenceRef(target.item) : freeze({ source: null, sourceId: String(successor), kind: null, timestamp: null, provenance: null }),
      complete: Boolean(target)
    }));
  }

  const conflictGroups = [];
  const groups = new Map();
  for (const entry of merged) {
    const key = conflictKey(entry.item);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  for (const [key, entries] of groups.entries()) {
    const values = new Map();
    for (const entry of entries) {
      const fingerprint = valueFingerprint(entry.item);
      if (!values.has(fingerprint)) values.set(fingerprint, []);
      values.get(fingerprint).push(entry);
    }
    if (values.size < 2) continue;
    const current = entries.filter((entry) => isCurrent(entry.item));
    const currentValues = new Set(current.map((entry) => valueFingerprint(entry.item)));
    const explicitSupersession = entries.some((entry) => successorId(entry.item));
    const unresolved = currentValues.size > 1 && !explicitSupersession;
    conflictGroups.push(freeze({
      conflictGroupId: `hs4:${hash(key).slice(0, 16)}`,
      entityKey: entries.find((entry) => entry.item.entityKey)?.item.entityKey ?? key,
      status: unresolved ? 'unresolved' : 'superseded-history',
      values: freeze([...values.values()].map((bucket) => freeze({
        value: clone(bucket[0].item.value ?? bucket[0].item.text ?? null),
        evidence: freeze(bucket.map((entry) => evidenceRef(entry.item)))
      }))),
      currentEvidence: freeze(current.map((entry) => evidenceRef(entry.item)))
    }));
    if (conflictGroups.length >= MAX_CONFLICT_GROUPS) break;
  }

  const output = merged.slice(0, MAX_OUTPUT_ITEMS).map((entry, index) => publicItem(entry, index + 1));
  return freeze({
    status: output.length ? 'merged' : 'empty',
    items: freeze(output),
    conflicts: freeze(conflictGroups),
    supersessionChains: freeze(supersessionChains),
    diagnostics: freeze({
      inputItemCount: flattened.length,
      mergedItemCount: merged.length,
      returnedItemCount: output.length,
      duplicateSuppressedCount: duplicateCount,
      conflictGroupCount: conflictGroups.length,
      unresolvedConflictCount: conflictGroups.filter((group) => group.status === 'unresolved').length,
      supersessionChainCount: supersessionChains.length,
      inputTruncated: flattened.length >= MAX_INPUT_ITEMS,
      outputTruncated: merged.length > MAX_OUTPUT_ITEMS
    }),
    contract: freeze({
      version: HISTORICAL_RESULT_MERGE_CONTRACT_VERSION,
      stage: 'HS4',
      deterministic: true,
      aiUsed: false,
      authorizationExpanded: false,
      sourceReferencesRetained: true,
      duplicateSuppression: true,
      conflictsPreserved: true,
      supersessionPreserved: true
    })
  });
}
