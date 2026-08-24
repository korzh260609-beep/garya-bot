import { createCapabilityManifest } from '../capability/capabilityManifest.js';

export const PROJECT_MEMORY_CAPABILITY_MANIFEST = createCapabilityManifest({
  sourceId: 'subsystem:project-memory-3',
  domain: 'project-memory',
  sourceOfTruth: 'src/projectMemory',
  capabilities: [
    { id: 'project-memory.hybrid-retrieval', description: 'Retrieve authorized project knowledge with hybrid search.' },
    { id: 'project-memory.temporal-history', description: 'Track project memory temporal history and supersession.' },
    { id: 'project-memory.decision-memory', description: 'Recall project decisions and rationale.' },
    { id: 'project-memory.incident-memory', description: 'Recall verified incidents, root causes and guidance.' },
    { id: 'project-memory.ai-context-integration', description: 'Provide guarded project context to AI routing.' }
  ]
});
