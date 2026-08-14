import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectFact, createProjectMemoryNamespace } from '../src/projectMemory/index.js';
import { createProductComponentRegistrySnapshotBuilder } from '../src/projectDevelopmentKnowledge/index.js';

const projectKey = 'sg2.1';
const at = (minute) => new Date(Date.UTC(2026,7,10,10,minute,0)).toISOString();

function fact({ id, component='Core', eventType='implementation', state='implemented', verification=['code'], confirmed=true, lifecycleState='active', minute=1, domain='architecture' } = {}) {
  return createProjectFact({
    memoryId: `mem-${id}`,
    projectKey,
    namespace: createProjectMemoryNamespace(projectKey, domain),
    factType: 'project-event',
    entityKey: id,
    fact: {
      pdk4ContractVersion: 1,
      eventType,
      component,
      title: `${eventType}-${id}`,
      summary: `${eventType} ${component}`,
      previousState: state === 'implemented' ? 'implementing' : 'unknown',
      newState: state,
      occurredAt: at(minute),
      effectiveAt: at(minute),
      verification: verification.map((kind) => ({ kind, projectKey, sourceId: `src-${id}-${kind}`, ref: `ref-${id}-${kind}`, verifiedAt: at(minute) })),
      relatedEvents: [], supersedes: [], supersededBy: [], derivedFrom: [`src-${id}`]
    },
    source: { kind: 'github-commit', ref: `src-${id}`, timestamp: at(minute) },
    sourceEventId: id,
    trust: confirmed ? 'verified' : 'unverified',
    confirmed,
    confirmationState: confirmed ? 'confirmed' : 'proposed',
    lifecycleState
  });
}

function reconciliation({ gaps=[], relations=[] } = {}) {
  return Object.freeze({ projectKey, trust:'reconciliation-derived', confirmed:false, authorityAllowed:false, reconciliationFingerprint:'rec-fingerprint', gaps:Object.freeze(gaps), relationLinks:Object.freeze(relations) });
}

test('PDK4.10: snapshot keeps implemented, CI, deployment and runtime dimensions distinct', () => {
  const builder = createProductComponentRegistrySnapshotBuilder({ clock: () => new Date(at(50)) });
  const result = builder.build({ projectKey, facts:[fact({id:'code',component:'Memory',minute:1,verification:['source','code'],state:'implemented'}), fact({id:'ci',component:'Memory',minute:2,eventType:'ci-verification',verification:['source','ci'],state:'ci-verified'})], reconciliation:reconciliation(), sourceRevision:'abc123', sourceCursor:'cursor-2' });
  const memory=result.componentRegistry[0];
  assert.equal(memory.dimensions.code.present,true);assert.equal(memory.dimensions.ci.present,true);assert.equal(memory.dimensions.deployment.present,false);assert.equal(memory.dimensions.runtime.present,false);
  assert.equal(result.snapshot.implemented.length,1);assert.equal(result.snapshot.ciVerified.length,1);assert.equal(result.snapshot.deployed.length,0);assert.equal(result.snapshot.liveVerified.length,0);assert.equal(result.snapshot.sourceRevision,'abc123');assert.equal(result.snapshot.sourceCursor,'cursor-2');
});

test('PDK4.10: unconfirmed stronger-state candidates cannot promote current snapshot', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const result=builder.build({projectKey,facts:[fact({id:'code',component:'Runtime',minute:1,verification:['code'],state:'implemented'}),fact({id:'deploy-proposed',component:'Runtime',minute:2,eventType:'deployment',verification:['deployment'],state:'deployed',confirmed:false}),fact({id:'runtime-proposed',component:'Runtime',minute:3,eventType:'runtime-verification',verification:['runtime'],state:'live-verified',confirmed:false})],reconciliation:reconciliation()});
  assert.equal(result.ignoredUnconfirmedCount,2);assert.equal(result.snapshot.implemented.length,1);assert.equal(result.snapshot.deployed.length,0);assert.equal(result.snapshot.liveVerified.length,0);assert.equal(result.componentRegistry[0].currentState,'implemented');
});

test('PDK4.10: superseded historical evidence remains out of current dimensions', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const result=builder.build({projectKey,facts:[fact({id:'old-live',component:'Telegram',minute:1,eventType:'runtime-verification',verification:['runtime'],state:'live-verified',lifecycleState:'superseded'}),fact({id:'new-code',component:'Telegram',minute:2,verification:['code'],state:'implemented'})],reconciliation:reconciliation()});
  assert.equal(result.componentRegistry[0].eventCount,2);assert.equal(result.componentRegistry[0].dimensions.runtime.present,false);assert.equal(result.snapshot.liveVerified.length,0);assert.equal(result.componentRegistry[0].currentEventId,'new-code');
});

test('PDK4.10: registry exposes decisions, incidents, work, plans, gaps and contradiction risks', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const gaps=[Object.freeze({gapId:'gap-stale',gapType:'stale-plan',component:'Workers',dimension:'source/code',severity:'evidence-gap',summary:'stale plan',eventIds:['plan']}),Object.freeze({gapId:'gap-order',gapType:'temporal-evidence-order',component:'Workers',dimension:'code→ci',severity:'contradiction',summary:'contradictory chronology',eventIds:['code','ci']})];
  const result=builder.build({projectKey,facts:[fact({id:'decision',component:'Workers',eventType:'decision',state:'approved',verification:['source'],minute:1,domain:'decisions'}),fact({id:'incident',component:'Workers',eventType:'incident',state:'proposed',verification:['source'],minute:2,domain:'incidents'}),fact({id:'work',component:'Workers',eventType:'implementation',state:'implementing',verification:['source'],minute:3}),fact({id:'plan',component:'Workers',eventType:'next-plan',state:'planned',verification:['source'],minute:4,domain:'roadmap'})],reconciliation:reconciliation({gaps})});
  const workers=result.componentRegistry[0];assert.equal(workers.activeDecisions.length,1);assert.equal(workers.openIncidents.length,1);assert.equal(workers.currentWork.length,1);assert.equal(workers.nextPlans.length,1);assert.equal(workers.unresolvedGaps.length,2);assert.equal(workers.staleEvidence.length,2);assert.equal(result.snapshot.risks.some(risk=>risk.riskType==='evidence-contradiction'),true);
});

test('PDK4.10: dependency relations are exposed without granting authority', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const result=builder.build({projectKey,facts:[fact({id:'a',component:'Core',verification:['code'],state:'implemented',minute:1}),fact({id:'b',component:'Persistence',verification:['code'],state:'implemented',minute:2,domain:'infrastructure'})],reconciliation:reconciliation({relations:[Object.freeze({type:'depends-on',fromEventId:'a',toEventId:'b'})]})});
  const core=result.componentRegistry.find(entry=>entry.component==='Core');assert.deepEqual(core.dependencies,[{type:'depends-on',fromEventId:'a',toEventId:'b',targetComponent:'Persistence'}]);assert.equal(result.authorityAllowed,false);assert.equal(result.confirmed,false);assert.equal(result.trust,'snapshot-derived');
});

test('PDK4.10: fingerprint is deterministic across fact ordering, gap ordering and generatedAt', () => {
  const facts=[fact({id:'a',component:'Core',minute:1}),fact({id:'b',component:'Core',eventType:'ci-verification',verification:['ci'],state:'ci-verified',minute:2})];
  const gaps=[Object.freeze({gapId:'g2',gapType:'missing-runtime-evidence',component:'Core',severity:'evidence-gap',summary:'g2',eventIds:['b']}),Object.freeze({gapId:'g1',gapType:'missing-deployment-evidence',component:'Core',severity:'evidence-gap',summary:'g1',eventIds:['b']})];
  const builder=createProductComponentRegistrySnapshotBuilder();const first=builder.build({projectKey,facts,reconciliation:reconciliation({gaps}),generatedAt:at(40)});const second=builder.build({projectKey,facts:[...facts].reverse(),reconciliation:reconciliation({gaps:[...gaps].reverse()}),generatedAt:at(41)});
  assert.equal(first.registryFingerprint,second.registryFingerprint);assert.equal(first.snapshotFingerprint,second.snapshotFingerprint);assert.notEqual(first.snapshot.generatedAt,second.snapshot.generatedAt);
});

test('PDK4.10: cross-project facts and authoritative reconciliation fail closed', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const other=createProjectFact({memoryId:'other',projectKey:'other',namespace:createProjectMemoryNamespace('other','architecture'),factType:'project-event',entityKey:'other-event',fact:{pdk4ContractVersion:1,eventType:'implementation',component:'Other',title:'other',summary:'other',newState:'implemented',occurredAt:at(1),effectiveAt:at(1),verification:[{kind:'code',projectKey:'other',verifiedAt:at(1)}],relatedEvents:[],supersedes:[],supersededBy:[],derivedFrom:['x']},source:{kind:'github-commit',ref:'x',timestamp:at(1)},sourceEventId:'other-event',trust:'verified',confirmed:true,confirmationState:'confirmed',lifecycleState:'active'});
  assert.throws(()=>builder.build({projectKey,facts:[other]}),error=>error.code==='project-memory-project-scope-denied');assert.throws(()=>builder.build({projectKey,facts:[fact({id:'a'})],reconciliation:{...reconciliation(),authorityAllowed:true}}),error=>error.code==='pdk4-snapshot-reconciliation-denied');
});

test('PDK4.10: empty confirmed knowledge yields rebuildable unknown snapshot instead of invented state', () => {
  const builder=createProductComponentRegistrySnapshotBuilder();const result=builder.build({projectKey,facts:[fact({id:'proposed',confirmed:false})],reconciliation:reconciliation()});assert.equal(result.componentRegistry.length,0);assert.equal(result.snapshot.implemented.length,0);assert.equal(result.snapshot.ciVerified.length,0);assert.equal(result.snapshot.deployed.length,0);assert.equal(result.snapshot.liveVerified.length,0);assert.equal(result.canonicalFactCount,0);assert.equal(result.ignoredUnconfirmedCount,1);
});
