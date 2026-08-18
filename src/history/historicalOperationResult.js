const MAX_TIMELINE_EVENTS = 80;
const MAX_FACT_STATES = 80;
const MAX_TEXT = 1200;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function text(value, max = MAX_TEXT) {
  const normalized = String(value ?? '').trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 1))}…`;
}
function ms(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function evidenceTime(item) {
  return item?.validFrom ?? item?.timestamp ?? item?.provenance?.timestamp ?? null;
}
function sourceLabel(source) {
  const labels = {
    'conversation-history': 'Conversation History',
    memory2: 'Memory 2.0',
    'project-memory': 'Project Memory',
    pdk4: 'Project Development Knowledge',
    'decision-memory': 'Decision Memory',
    'incident-memory': 'Incident Memory'
  };
  return labels[source] ?? text(source || 'Historical evidence', 80);
}
function evidenceRef(item) {
  return freeze({ source: item.source ?? null, sourceId: item.sourceId ?? null, timestamp: evidenceTime(item), provenance: clone(item.provenance ?? null) });
}
function humanView(item) {
  return freeze({
    date: evidenceTime(item),
    source: sourceLabel(item.source),
    subject: item.entityKey ?? null,
    summary: text(item.text || (item.value == null ? '' : JSON.stringify(item.value)))
  });
}
function chronological(items) {
  return [...(items ?? [])]
    .map((item, index) => ({ item, index, at: ms(evidenceTime(item)) }))
    .filter((entry) => entry.at != null)
    .sort((a, b) => a.at - b.at || a.index - b.index);
}
function groupingFor(plan, entries) {
  const explicit = plan?.timelineGrouping;
  if (['day', 'week', 'month', 'year'].includes(explicit)) return explicit;
  if (!entries.length) return 'day';
  const span = entries.at(-1).at - entries[0].at;
  const day = 86_400_000;
  if (span > day * 730) return 'year';
  if (span > day * 60) return 'month';
  return 'day';
}
function bucketKey(dateValue, grouping) {
  const date = new Date(dateValue);
  if (!Number.isFinite(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  if (grouping === 'year') return `${year}`;
  if (grouping === 'month') return `${year}-${month}`;
  if (grouping === 'week') {
    const start = new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate()));
    const weekday = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - weekday + 1);
    return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-${String(start.getUTCDate()).padStart(2, '0')}`;
  }
  return `${year}-${month}-${day}`;
}
function buildTimeline(plan, items) {
  const entries = chronological(items).slice(0, MAX_TIMELINE_EVENTS);
  const grouping = groupingFor(plan, entries);
  const events = entries.map(({ item }) => freeze({
    at: evidenceTime(item),
    event: humanView(item),
    lifecycle: item.lifecycle ?? null,
    confirmationState: item.metadata?.confirmationState ?? (item.confirmed === true ? 'confirmed' : item.confirmed === false ? 'unconfirmed' : null),
    supersession: clone(item.supersession ?? null),
    evidence: freeze([evidenceRef(item), ...(item.duplicateEvidence ?? []).map((duplicate) => freeze({ source: duplicate.source ?? null, sourceId: duplicate.sourceId ?? null, timestamp: duplicate.timestamp ?? null, provenance: clone(duplicate.provenance ?? null) }))])
  }));
  const groups = [];
  let current = null;
  for (const event of events) {
    const key = bucketKey(event.at, grouping);
    if (!key) continue;
    if (!current || current.period !== key) {
      current = { period: key, events: [] };
      groups.push(current);
    }
    current.events.push(event);
  }
  return freeze({
    status: events.length ? 'available' : 'empty',
    grouping,
    events: freeze(events),
    groups: freeze(groups.map((group) => freeze({ period: group.period, events: freeze(group.events) }))),
    emptyPeriodsFabricated: false
  });
}
function occurrence(kind, items) {
  const entries = chronological(items);
  const selected = kind === 'first' ? entries[0]?.item : entries.at(-1)?.item;
  if (!selected) return freeze({ status: 'empty', occurrence: null, evidence: [] });
  return freeze({
    status: 'available',
    occurrence: humanView(selected),
    evidence: freeze([evidenceRef(selected), ...(selected.duplicateEvidence ?? []).map((duplicate) => freeze({ source: duplicate.source ?? null, sourceId: duplicate.sourceId ?? null, timestamp: duplicate.timestamp ?? null, provenance: clone(duplicate.provenance ?? null) }))])
  });
}
function normalizedEntity(value) { return String(value ?? '').trim().toLowerCase(); }
function sameFactSubject(seed, item) {
  const seedEntity = normalizedEntity(seed?.entityKey);
  const itemEntity = normalizedEntity(item?.entityKey);
  if (seedEntity) return itemEntity === seedEntity;
  return !itemEntity;
}
function chainForRelated(merged, sourceIds) {
  return freeze((merged?.supersessionChains ?? []).filter((chain) => {
    const from = chain?.from?.sourceId == null ? null : String(chain.from.sourceId);
    const to = chain?.to?.sourceId == null ? null : String(chain.to.sourceId);
    return (from && sourceIds.has(from)) || (to && sourceIds.has(to));
  }).map((chain) => clone(chain)));
}
function factHistory(merged) {
  const entries = chronological(merged.items);
  if (!entries.length) return freeze({ status: 'empty', subject: null, firstOccurrence: null, firstConfirmedFact: null, latestSupportedUpdate: null, states: [], supersessionChains: [], currentState: null });
  const seed = entries.find(({ item }) => item.entityKey)?.item ?? entries[0].item;
  const related = entries.filter(({ item }) => sameFactSubject(seed, item)).slice(0, MAX_FACT_STATES);
  const sourceIds = new Set(related.map(({ item }) => item.sourceId).filter((id) => id != null).map(String));
  const states = related.map(({ item }) => freeze({
    at: evidenceTime(item),
    value: clone(item.value ?? item.text ?? null),
    lifecycle: item.lifecycle ?? null,
    trust: item.trust ?? null,
    confirmed: item.confirmed ?? null,
    confidence: item.confidence ?? null,
    confirmationState: item.metadata?.confirmationState ?? null,
    supersession: clone(item.supersession ?? null),
    provenance: clone(item.provenance ?? null),
    evidence: evidenceRef(item)
  }));
  const firstConfirmed = related.find(({ item }) => item.confirmed === true || item.verificationState === 'confirmed' || item.verificationState === 'verified')?.item ?? null;
  const current = [...related].reverse().find(({ item }) => item.lifecycle == null || ['active', 'temporary'].includes(item.lifecycle))?.item ?? null;
  return freeze({
    status: 'available',
    subject: seed.entityKey ?? null,
    firstOccurrence: humanView(related[0].item),
    firstConfirmedFact: firstConfirmed ? humanView(firstConfirmed) : null,
    latestSupportedUpdate: humanView(related.at(-1).item),
    states: freeze(states),
    supersessionChains: chainForRelated(merged, sourceIds),
    currentState: current ? humanView(current) : null
  });
}

export const HISTORICAL_OPERATION_CONTRACT_VERSION = 1;

export function buildHistoricalOperationResult({ plan, merged } = {}) {
  if (!plan || plan.status !== 'planned') throw new TypeError('HS5 requires a planned historical query');
  if (!merged || !Array.isArray(merged.items)) throw new TypeError('HS5 requires HS4 merged evidence');
  const operation = plan.operation;
  let result = null;
  if (operation === 'timeline') result = buildTimeline(plan, merged.items);
  else if (operation === 'first-occurrence') result = occurrence('first', merged.items);
  else if (operation === 'last-occurrence') result = occurrence('last', merged.items);
  else if (operation === 'fact-history') result = factHistory(merged);
  else return null;

  return freeze({
    operation,
    result,
    contract: freeze({
      version: HISTORICAL_OPERATION_CONTRACT_VERSION,
      stage: 'HS5',
      deterministic: true,
      aiUsed: false,
      authorizationExpanded: false,
      sourceVerifiedOnly: true,
      internalEvidenceRetained: true,
      humanReadableDefaultView: true,
      internalIdsExposedByDefault: false
    })
  });
}
