import { createCapabilityManifest } from '../capability/capabilityManifest.js';

export const HISTORICAL_CAPABILITY_MANIFEST = createCapabilityManifest({
  sourceId: 'subsystem:historical-semantic-search',
  domain: 'historical-search',
  sourceOfTruth: 'src/history',
  capabilities: [
    { id: 'history.semantic-hybrid-search', description: 'Search historical context through semantic and structured retrieval.' },
    { id: 'history.timeline', description: 'Build scoped historical timelines.' },
    { id: 'history.first-last-occurrence', description: 'Resolve first and last known occurrence of facts/events.' },
    { id: 'history.fact-history', description: 'Inspect fact lifecycle, provenance, supersession and confirmation history.' },
    { id: 'history.cross-store-orchestration', description: 'Orchestrate authorized history across conversation, Memory 2.0, Project Memory and development knowledge.' }
  ]
});
