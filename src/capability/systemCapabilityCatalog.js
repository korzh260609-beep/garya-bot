import { TELEGRAM_CAPABILITY_MANIFEST } from '../telegram/telegramCapabilityManifest.js';
import { HISTORICAL_CAPABILITY_MANIFEST } from '../history/historicalCapabilityManifest.js';
import { PROJECT_MEMORY_CAPABILITY_MANIFEST } from '../projectMemory/projectMemoryCapabilityManifest.js';
import { PDK_CAPABILITY_MANIFEST } from '../projectDevelopmentKnowledge/pdkCapabilityManifest.js';
import { PLATFORM_CAPABILITY_MANIFEST } from './platformCapabilityManifest.js';
import { createCapabilityManifest } from './capabilityManifest.js';

export { createCapabilityManifest } from './capabilityManifest.js';

const VALID_STATUSES = new Set(['implemented', 'partial', 'planned', 'disabled']);

function text(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${name} is required`);
  return value.trim();
}

function inferredDomain(id) {
  const value = String(id ?? '').toLowerCase();
  if (value.startsWith('memory')) return 'memory';
  if (value.startsWith('task') || value.startsWith('automation')) return 'automation';
  if (value.startsWith('temporal')) return 'temporal';
  if (value.startsWith('language')) return 'language';
  if (value.startsWith('user-settings')) return 'settings';
  if (value.startsWith('source') || value.startsWith('document') || value.startsWith('repository')) return 'sources';
  if (value.includes('diagnostic')) return 'observability';
  if (value.startsWith('domain')) return 'domains';
  if (value.startsWith('compose')) return 'conversation';
  return 'runtime';
}

function humanize(id) {
  return String(id).replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeEntry(entry, manifest, sourceRevision) {
  const id = text(entry?.id ?? entry?.name, 'capability.id');
  const status = entry?.status ?? manifest.status ?? 'implemented';
  if (!VALID_STATUSES.has(status)) throw new TypeError(`Invalid capability status: ${status}`);
  return Object.freeze({
    id,
    domain: text(entry?.domain ?? manifest.domain ?? inferredDomain(id), 'capability.domain'),
    humanReadableName: entry?.humanReadableName ?? humanize(id),
    description: entry?.description ?? null,
    status,
    requiresConnection: Boolean(entry?.requiresConnection),
    requiresAuthorization: entry?.requiresAuthorization !== false,
    supportedTransports: Object.freeze([...(entry?.supportedTransports ?? manifest.supportedTransports ?? [])]),
    riskTier: Number.isInteger(entry?.riskTier) ? entry.riskTier : null,
    sourceOfTruth: entry?.sourceOfTruth ?? manifest.sourceOfTruth ?? manifest.sourceId,
    sourceRevision: entry?.sourceRevision ?? manifest.sourceRevision ?? sourceRevision,
    runtimeAvailability: entry?.runtimeAvailability ?? (status === 'implemented' ? 'registered' : status),
    connectionDependent: Boolean(entry?.connectionDependent ?? entry?.requiresConnection),
    permissionDependent: entry?.permissionDependent !== false && entry?.requiresAuthorization !== false,
    grantsAuthority: false
  });
}

export function createCapabilityCatalog({ manifests = [] } = {}) {
  const baseManifests = Object.freeze([...manifests]);
  return Object.freeze({
    snapshot({ sourceRevision = 'unknown', additionalManifests = [] } = {}) {
      const entries = new Map();
      for (const manifest of [...baseManifests, ...additionalManifests]) {
        if (!manifest || !Array.isArray(manifest.capabilities)) throw new TypeError('Capability manifest is invalid');
        for (const raw of manifest.capabilities) {
          const capability = normalizeEntry(raw, manifest, sourceRevision);
          const existing = entries.get(capability.id);
          if (existing && (existing.domain !== capability.domain || existing.status !== capability.status)) {
            throw new TypeError(`Conflicting capability metadata: ${capability.id}`);
          }
          entries.set(capability.id, existing ?? capability);
        }
      }
      const capabilities = Object.freeze([...entries.values()].sort((a, b) => a.domain.localeCompare(b.domain) || a.id.localeCompare(b.id)));
      const domains = {};
      for (const capability of capabilities) {
        if (!domains[capability.domain]) domains[capability.domain] = [];
        domains[capability.domain].push(capability.id);
      }
      return Object.freeze({
        sourceRevision,
        totalCapabilities: capabilities.length,
        capabilities,
        domains: Object.freeze(Object.fromEntries(Object.entries(domains).sort(([a], [b]) => a.localeCompare(b)).map(([domain, ids]) => [domain, Object.freeze(ids)]))),
        refreshMode: 'runtime-snapshot',
        perRequestExternalScan: false,
        grantsAuthority: false
      });
    }
  });
}

function runtimeManifest(runtimeCapabilityNames, sourceRevision) {
  return createCapabilityManifest({
    sourceId: 'runtime:capability-registry',
    sourceRevision,
    sourceOfTruth: 'runtime capability registration',
    capabilities: [...new Set(runtimeCapabilityNames)].map((id) => ({
      id,
      domain: inferredDomain(id),
      status: 'implemented',
      requiresAuthorization: true,
      runtimeAvailability: 'registered'
    }))
  });
}

export function createSystemCapabilityCatalog({ runtimeCapabilityNames = [], sourceRevision = 'unknown', additionalManifests = [] } = {}) {
  return createCapabilityCatalog({
    manifests: [
      runtimeManifest(runtimeCapabilityNames, sourceRevision),
      TELEGRAM_CAPABILITY_MANIFEST,
      HISTORICAL_CAPABILITY_MANIFEST,
      PROJECT_MEMORY_CAPABILITY_MANIFEST,
      PDK_CAPABILITY_MANIFEST,
      PLATFORM_CAPABILITY_MANIFEST,
      ...additionalManifests
    ]
  }).snapshot({ sourceRevision });
}
