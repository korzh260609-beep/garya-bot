function nonNegative(value, field, fallback = 0) {
  if (value == null) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new TypeError(`${field} must be non-negative`);
  return number;
}

function instant(value, field) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${field} must be a valid timestamp`);
  return date.toISOString();
}

function normalizeRate(entry) {
  if (!entry?.provider || !entry?.model || !entry?.version || !entry?.source) {
    throw new TypeError('pricing entry requires provider, model, version and source');
  }
  const effectiveFrom = instant(entry.effectiveFrom, 'pricing.effectiveFrom');
  const effectiveTo = entry.effectiveTo == null ? null : instant(entry.effectiveTo, 'pricing.effectiveTo');
  if (effectiveTo && effectiveTo <= effectiveFrom) throw new TypeError('pricing effectiveTo must be after effectiveFrom');
  return Object.freeze({
    provider: String(entry.provider), model: String(entry.model), version: String(entry.version),
    currency: String(entry.currency ?? 'USD'), source: String(entry.source), effectiveFrom, effectiveTo,
    ratesPerMillion: Object.freeze({
      input: nonNegative(entry.ratesPerMillion?.input, 'pricing.input'),
      cachedInput: nonNegative(entry.ratesPerMillion?.cachedInput, 'pricing.cachedInput'),
      output: nonNegative(entry.ratesPerMillion?.output, 'pricing.output'),
      reasoning: nonNegative(entry.ratesPerMillion?.reasoning, 'pricing.reasoning'),
    }),
  });
}

export function createVersionedPricingCatalog(entries = []) {
  const rates = entries.map(normalizeRate);
  return Object.freeze({
    resolve({ provider, model, occurredAt = new Date() }) {
      const at = instant(occurredAt, 'occurredAt');
      const matches = rates.filter((rate) => rate.provider === provider && rate.model === model
        && rate.effectiveFrom <= at && (!rate.effectiveTo || at < rate.effectiveTo));
      if (matches.length > 1) throw new TypeError('overlapping pricing versions are not allowed');
      return matches[0] ?? null;
    },
    list() { return Object.freeze([...rates]); },
  });
}

function usage(input = {}) {
  return Object.freeze({
    inputTokens: nonNegative(input.inputTokens, 'usage.inputTokens'),
    cachedInputTokens: nonNegative(input.cachedInputTokens, 'usage.cachedInputTokens'),
    outputTokens: nonNegative(input.outputTokens, 'usage.outputTokens'),
    reasoningTokens: nonNegative(input.reasoningTokens, 'usage.reasoningTokens'),
    totalTokens: nonNegative(input.totalTokens, 'usage.totalTokens'),
    otherBillableUnits: Object.freeze({ ...(input.otherBillableUnits ?? {}) }),
  });
}

function calculatedCost(snapshot, units) {
  if (!snapshot) return null;
  const rates = snapshot.ratesPerMillion;
  return (units.inputTokens * rates.input + units.cachedInputTokens * rates.cachedInput
    + units.outputTokens * rates.output + units.reasoningTokens * rates.reasoning) / 1_000_000;
}

export function createAICostIntelligence({ pricingCatalog = createVersionedPricingCatalog(), now = () => new Date() } = {}) {
  const calls = [];
  const reconciliations = [];
  return Object.freeze({
    recordCall({ model, request, result, providerReportedCostUsd = null, fallbackUsed = false, escalationUsed = false }) {
      const occurredAt = instant(now(), 'occurredAt');
      const units = usage(result.usage);
      const configured = pricingCatalog.resolve({ provider: model.provider, model: model.model, occurredAt });
      const pricingSnapshot = configured ?? Object.freeze({
        provider: model.provider, model: model.model, version: 'legacy-model-config', currency: 'USD',
        source: 'model-registry', effectiveFrom: occurredAt, effectiveTo: null,
        ratesPerMillion: Object.freeze({ input: model.inputCostPerMillion ?? 0, cachedInput: 0, output: model.outputCostPerMillion ?? 0, reasoning: 0 }),
      });
      const calculatedCostUsd = calculatedCost(pricingSnapshot, units);
      const reported = providerReportedCostUsd == null ? null : nonNegative(providerReportedCostUsd, 'providerReportedCostUsd');
      const record = Object.freeze({
        version: 'AR2.10', callId: `${request.traceContext.requestId}:${calls.length + 1}`,
        traceId: request.traceContext.traceId, requestId: request.traceContext.requestId,
        occurredAt, provider: model.provider, model: model.model, tier: model.tier,
        reasoningEffort: result.reasoningEffort ?? null, taskClass: request.routing.taskClass,
        usage: units, pricingSnapshot, calculatedCostUsd, providerReportedCostUsd: reported,
        effectiveCostUsd: reported ?? calculatedCostUsd, costSource: reported == null ? 'calculated' : 'provider-reported',
        fallbackUsed: Boolean(fallbackUsed), escalationUsed: Boolean(escalationUsed),
        role: request.metadata?.role ?? null, workspaceId: request.metadata?.workspaceId ?? null,
        projectId: request.metadata?.projectId ?? null,
      });
      calls.push(record);
      return record;
    },
    summarizeRequest(requestId) {
      const selected = calls.filter((call) => call.requestId === requestId);
      return Object.freeze({
        version: 'AR2.10', requestId, callCount: selected.length,
        usage: usage(selected.reduce((sum, call) => ({
          inputTokens: sum.inputTokens + call.usage.inputTokens,
          cachedInputTokens: sum.cachedInputTokens + call.usage.cachedInputTokens,
          outputTokens: sum.outputTokens + call.usage.outputTokens,
          reasoningTokens: sum.reasoningTokens + call.usage.reasoningTokens,
          totalTokens: sum.totalTokens + call.usage.totalTokens,
        }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 })),
        costUsd: selected.reduce((sum, call) => sum + (call.effectiveCostUsd ?? 0), 0),
        fallbackCount: selected.filter((call) => call.fallbackUsed).length,
        escalationCallCount: selected.filter((call) => call.escalationUsed).length,
      });
    },
    aggregate(filter = {}) {
      const selected = calls.filter((call) => Object.entries(filter).every(([key, value]) => value == null || call[key] === value));
      const requestIds = new Set(selected.map((call) => call.requestId));
      return Object.freeze({
        version: 'AR2.10', callCount: selected.length, requestCount: requestIds.size,
        costUsd: selected.reduce((sum, call) => sum + (call.effectiveCostUsd ?? 0), 0),
        totalTokens: selected.reduce((sum, call) => sum + call.usage.totalTokens, 0),
        byTier: Object.freeze(Object.fromEntries(['L1', 'L2', 'L3'].map((tier) => [tier, selected.filter((call) => call.tier === tier).length]))),
        escalationRate: selected.length ? selected.filter((call) => call.escalationUsed).length / selected.length : 0,
      });
    },
    reconcile({ callId, providerCostUsd, source, occurredAt = now() }) {
      const original = calls.find((call) => call.callId === callId);
      if (!original) throw new TypeError('call record does not exist');
      const evidence = Object.freeze({
        version: 'AR2.10', callId, occurredAt: instant(occurredAt, 'reconciliation.occurredAt'),
        source: String(source), originalCalculatedCostUsd: original.calculatedCostUsd,
        originalEffectiveCostUsd: original.effectiveCostUsd,
        providerCostUsd: nonNegative(providerCostUsd, 'reconciliation.providerCostUsd'),
      });
      reconciliations.push(evidence);
      return evidence;
    },
    listCalls() { return Object.freeze([...calls]); },
    listReconciliations() { return Object.freeze([...reconciliations]); },
  });
}
