import { createCapabilityManifest } from '../capability/capabilityManifest.js';

export const PDK_CAPABILITY_MANIFEST = createCapabilityManifest({
  sourceId: 'subsystem:pdk4',
  domain: 'development-knowledge',
  sourceOfTruth: 'src/projectDevelopmentKnowledge',
  capabilities: [
    { id: 'pdk.development-search', description: 'Search project development knowledge.' },
    { id: 'pdk.github-evidence', description: 'Use commit, diff, PR and workflow evidence in development knowledge.' },
    { id: 'pdk.development-event-extraction', description: 'Extract evidence-backed development events with provenance.' }
  ]
});
