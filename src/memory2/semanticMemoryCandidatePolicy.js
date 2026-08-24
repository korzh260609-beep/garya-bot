const MAX_CANDIDATES = 4;
const MAX_KEY_LENGTH = 160;
const MAX_TAGS = 8;

function cleanString(value, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > maxLength) return null;
  return text;
}

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  const tags = [];
  for (const item of value) {
    const tag = cleanString(item, 80);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function allowedScopeKind(candidate, requestScope) {
  if (candidate?.scopeKind === 'user-group' && requestScope?.groupScope) return 'user-group';
  return 'user';
}

export function normalizeSemanticMemoryCandidates({ candidates, userText, requestScope } = {}) {
  const sourceText = cleanString(userText, 2000);
  if (!sourceText || !Array.isArray(candidates)) return Object.freeze([]);
  const normalized = [];
  const keys = new Set();
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const key = cleanString(candidate.key, MAX_KEY_LENGTH);
    if (!key || keys.has(key)) continue;
    keys.add(key);
    normalized.push(Object.freeze({
      key,
      value: sourceText,
      scopeKind: allowedScopeKind(candidate, requestScope),
      shared: false,
      tags: Object.freeze(cleanTags(candidate.tags))
    }));
  }
  return Object.freeze(normalized);
}

export async function captureSemanticMemoryCandidates({ memoryProvider, request, candidates } = {}) {
  if (typeof memoryProvider?.capture !== 'function') return Object.freeze([]);
  const normalized = normalizeSemanticMemoryCandidates({
    candidates,
    userText: request?.input?.text,
    requestScope: request?.scope
  });
  const results = [];
  for (const candidate of normalized) {
    try {
      const result = await memoryProvider.capture({
        text: request.input.text,
        scope: request.scope,
        actor: request.actor,
        metadata: {
          sourceId: request.traceContext?.requestId ?? request.input?.conversationContext?.conversationId ?? 'semantic-capture',
          platformMessageId: request.input?.conversationContext?.platformMessageId ?? null,
          conversationId: request.input?.conversationContext?.conversationId ?? null,
          topicId: request.input?.conversationContext?.topicId ?? null,
          memoryCandidate: candidate
        }
      });
      results.push(Object.freeze({ key: candidate.key, status: result?.status ?? 'unknown', persisted: result?.persisted === true }));
    } catch (error) {
      results.push(Object.freeze({ key: candidate.key, status: 'failed', persisted: false, reason: error?.code ?? 'semantic-memory-capture-failed' }));
    }
  }
  return Object.freeze(results);
}
