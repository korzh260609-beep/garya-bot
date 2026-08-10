import { createHash } from 'node:crypto';
import { assertProjectFactForProject } from '../projectMemory/index.js';
import { createProjectSnapshotView } from './developmentKnowledgeContract.js';

export const PDK4_COMPONENT_SNAPSHOT_CONTRACT_VERSION = 1;
export const PDK4_COMPONENT_SNAPSHOT_LIMITS = Object.freeze({ maxFacts: 10000, maxComponents: 256, maxItemsPerList: 512 });

const EVIDENCE_DIMENSIONS = Object.freeze(['source','code','test','ci','deployment','runtime']);
const TERMINAL_STATES = new Set(['closed','deprecated','superseded','rejected']);
const CURRENT_WORK_STATES = new Set(['approved','planned','implementing','testing']);
const IMPLEMENTATION_TYPES = new Set(['implementation','refactor','rework','migration','fix','test']);
const PLAN_TYPES = new Set(['plan','next-plan']);
const ISSUE_TYPES = new Set(['bug','problem','root-cause']);

function stable(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(stable).join(',')}]`;return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;}
function sha256(value){return createHash('sha256').update(stable(value)).digest('hex');}
function required(value,name){if(typeof value!=='string'||value.trim()==='')throw new TypeError(`${name} is required`);return value.trim();}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))deepFreeze(child);return Object.freeze(value);}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function timeOf(event){return Date.parse(event.effectiveAt??event.occurredAt??0);}
function uniqueSorted(values){return[...new Set(values)].sort();}
function bounded(items,limit,code){if(items.length>limit)fail(code,`PDK4.10 list limit exceeded: ${limit}`);return Object.freeze(items);}
function hasEvidence(event,kind){return(event.verification??[]).some(entry=>String(entry?.kind??'').toLowerCase()===kind);}
function latestOf(events){return[...events].sort((a,b)=>timeOf(a)-timeOf(b)||a.eventId.localeCompare(b.eventId)).at(-1)??null;}
function eventRef(event){return deepFreeze({eventId:event.eventId,component:event.component,eventType:event.eventType,title:event.title,state:event.newState,effectiveAt:event.effectiveAt});}
function dimensionRecord(events,kind){const matches=events.filter(event=>hasEvidence(event,kind)),latest=latestOf(matches);return deepFreeze({present:matches.length>0,latestAt:latest?.effectiveAt??null,eventIds:Object.freeze(matches.map(event=>event.eventId).sort())});}
function normalizeEventFact(record){
  const fact=record.fact??{};if(record.factType!=='project-event'||fact.pdk4ContractVersion==null)return null;
  const component=required(fact.component,'fact.component'),eventType=required(fact.eventType,'fact.eventType').toLowerCase(),newState=required(fact.newState??'unknown','fact.newState').toLowerCase();
  const occurredAt=required(fact.occurredAt??record.validFrom,'fact.occurredAt'),effectiveAt=required(fact.effectiveAt??occurredAt,'fact.effectiveAt');
  if(Number.isNaN(Date.parse(occurredAt))||Number.isNaN(Date.parse(effectiveAt)))throw new TypeError('PDK4 event timestamps must be ISO timestamps');
  const verification=Array.isArray(fact.verification)?fact.verification:[];
  return deepFreeze({memoryId:record.memoryId,eventId:record.entityKey,projectKey:record.projectKey,domain:record.domain,component,eventType,title:String(fact.title??eventType).slice(0,240),summary:String(fact.summary??'').slice(0,1200),newState,lifecycleState:record.lifecycleState,occurredAt:new Date(occurredAt).toISOString(),effectiveAt:new Date(effectiveAt).toISOString(),verification:Object.freeze(verification.map(entry=>Object.freeze({kind:String(entry?.kind??'').toLowerCase(),sourceId:entry?.sourceId==null?null:String(entry.sourceId),ref:entry?.ref==null?null:String(entry.ref),verifiedAt:entry?.verifiedAt==null?null:new Date(entry.verifiedAt).toISOString()}))),relatedEvents:Object.freeze(Array.isArray(fact.relatedEvents)?fact.relatedEvents.map(entry=>Object.freeze({type:String(entry?.type??''),eventId:String(entry?.eventId??'')})):[]),supersedes:Object.freeze(Array.isArray(fact.supersedes)?fact.supersedes.map(String):[]),supersededBy:Object.freeze(Array.isArray(fact.supersededBy)?fact.supersededBy.map(String):[])});
}
function assertReconciliation(reconciliation,projectKey){if(reconciliation==null)return null;if(reconciliation.projectKey!==projectKey||reconciliation.trust!=='reconciliation-derived'||reconciliation.confirmed!==false||reconciliation.authorityAllowed!==false)fail('pdk4-snapshot-reconciliation-denied','PDK4.10 requires matching non-authoritative PDK4.8 reconciliation');if(!Array.isArray(reconciliation.gaps)||!Array.isArray(reconciliation.relationLinks)||typeof reconciliation.reconciliationFingerprint!=='string')fail('pdk4-snapshot-reconciliation-invalid','PDK4.8 reconciliation shape is invalid');return reconciliation;}
function gapsForComponent(reconciliation,component){if(!reconciliation)return Object.freeze([]);return Object.freeze(reconciliation.gaps.filter(gap=>gap.component===component).map(gap=>deepFreeze({gapId:gap.gapId,gapType:gap.gapType,dimension:gap.dimension??null,severity:gap.severity,summary:gap.summary,eventIds:Object.freeze([...(gap.eventIds??[])].sort())})).sort((a,b)=>a.gapType.localeCompare(b.gapType)||a.gapId.localeCompare(b.gapId)));}
function relationsForComponent(reconciliation,component,eventMap){if(!reconciliation)return Object.freeze([]);const ids=new Set([...eventMap.values()].filter(event=>event.component===component).map(event=>event.eventId)),result=[];for(const relation of reconciliation.relationLinks){if(!['depends-on','blocks','unblocks'].includes(relation.type)||!ids.has(relation.fromEventId))continue;const target=eventMap.get(relation.toEventId);result.push(deepFreeze({type:relation.type,fromEventId:relation.fromEventId,toEventId:relation.toEventId,targetComponent:target?.component??null}));}return Object.freeze(result.sort((a,b)=>a.type.localeCompare(b.type)||a.fromEventId.localeCompare(b.fromEventId)||a.toEventId.localeCompare(b.toEventId)));}

export function createProductComponentRegistrySnapshotBuilder({limits:limitOverrides={},clock=()=>new Date()}={}){
  const limits=Object.freeze({...PDK4_COMPONENT_SNAPSHOT_LIMITS,...limitOverrides});if(!Number.isInteger(limits.maxFacts)||limits.maxFacts<1||limits.maxFacts>50000)throw new TypeError('maxFacts must be between 1 and 50000');
  function build({projectKey:projectKeyInput,facts=[],reconciliation=null,sourceRevision=null,sourceCursor=null,generatedAt=null}={}){
    const projectKey=required(projectKeyInput,'projectKey').toLowerCase();if(!Array.isArray(facts))throw new TypeError('facts must be an array');if(facts.length>limits.maxFacts)fail('pdk4-snapshot-fact-limit','PDK4.10 fact limit exceeded');const rec=assertReconciliation(reconciliation,projectKey);
    const canonicalEvents=[];let ignoredUnconfirmedCount=0;
    for(const record of facts){assertProjectFactForProject(record,projectKey);if(record.factType!=='project-event'||record.fact?.pdk4ContractVersion==null)continue;if(record.confirmed!==true||record.confirmationState!=='confirmed'){ignoredUnconfirmedCount+=1;continue;}const event=normalizeEventFact(record);if(event)canonicalEvents.push(event);}
    canonicalEvents.sort((a,b)=>timeOf(a)-timeOf(b)||a.eventId.localeCompare(b.eventId));const eventMap=new Map(canonicalEvents.map(event=>[event.eventId,event]));if(eventMap.size!==canonicalEvents.length)fail('pdk4-snapshot-duplicate-event','duplicate confirmed PDK4 event id is not allowed');
    const byComponent=new Map();for(const event of canonicalEvents){if(!byComponent.has(event.component))byComponent.set(event.component,[]);byComponent.get(event.component).push(event);}if(byComponent.size>limits.maxComponents)fail('pdk4-snapshot-component-limit','PDK4.10 component limit exceeded');
    const registry=[];
    for(const[component,allEvents]of[...byComponent.entries()].sort(([a],[b])=>a.localeCompare(b))){
      const active=allEvents.filter(event=>event.lifecycleState==='active'&&!TERMINAL_STATES.has(event.newState)),latestCurrent=latestOf(active);const dimensions=Object.freeze(Object.fromEntries(EVIDENCE_DIMENSIONS.map(kind=>[kind,dimensionRecord(active,kind)])));
      const activeDecisions=active.filter(event=>event.eventType==='decision').map(eventRef),knownIssues=active.filter(event=>ISSUE_TYPES.has(event.eventType)).map(eventRef),openIncidents=active.filter(event=>event.eventType==='incident').map(eventRef);
      const currentWork=active.filter(event=>IMPLEMENTATION_TYPES.has(event.eventType)&&CURRENT_WORK_STATES.has(event.newState)).map(eventRef),nextPlans=active.filter(event=>PLAN_TYPES.has(event.eventType)&&['proposed','approved','planned'].includes(event.newState)).map(eventRef);
      const latestVerified=latestOf(allEvents.filter(event=>event.verification.length>0)),gaps=gapsForComponent(rec,component),staleEvidence=gaps.filter(gap=>['stale-plan','temporal-evidence-order'].includes(gap.gapType));
      registry.push(deepFreeze({component,domains:Object.freeze(uniqueSorted(allEvents.map(event=>event.domain))),eventCount:allEvents.length,currentEventId:latestCurrent?.eventId??null,currentState:latestCurrent?.newState??'unknown',stateQualification:latestCurrent?'confirmed-project-memory':'unknown-no-active-confirmed-event',dimensions,activeDecisions:bounded(activeDecisions,limits.maxItemsPerList,'pdk4-snapshot-list-limit'),knownIssues:bounded(knownIssues,limits.maxItemsPerList,'pdk4-snapshot-list-limit'),openIncidents:bounded(openIncidents,limits.maxItemsPerList,'pdk4-snapshot-list-limit'),currentWork:bounded(currentWork,limits.maxItemsPerList,'pdk4-snapshot-list-limit'),nextPlans:bounded(nextPlans,limits.maxItemsPerList,'pdk4-snapshot-list-limit'),dependencies:relationsForComponent(rec,component,eventMap),latestVerifiedEvidence:latestVerified?deepFreeze({eventId:latestVerified.eventId,effectiveAt:latestVerified.effectiveAt,kinds:Object.freeze(uniqueSorted(latestVerified.verification.map(entry=>entry.kind)))}):null,unresolvedGaps:gaps,staleEvidence:Object.freeze(staleEvidence)}));
    }
    const componentSummary=entry=>deepFreeze({component:entry.component,eventId:entry.currentEventId,state:entry.currentState,qualification:entry.stateQualification});
    const implemented=registry.filter(entry=>entry.dimensions.code.present).map(componentSummary),ciVerified=registry.filter(entry=>entry.dimensions.ci.present).map(componentSummary),deployed=registry.filter(entry=>entry.dimensions.deployment.present).map(componentSummary),liveVerified=registry.filter(entry=>entry.dimensions.runtime.present).map(componentSummary);
    const activeDecisions=registry.flatMap(entry=>entry.activeDecisions),knownIssues=registry.flatMap(entry=>entry.knownIssues),openIncidents=registry.flatMap(entry=>entry.openIncidents),currentWork=registry.flatMap(entry=>entry.currentWork),nextMilestones=registry.flatMap(entry=>entry.nextPlans);
    const unresolvedGaps=rec?[...rec.gaps].sort((a,b)=>String(a.gapType).localeCompare(String(b.gapType))||String(a.component).localeCompare(String(b.component))||String(a.gapId).localeCompare(String(b.gapId))).map(gap=>deepFreeze({gapId:gap.gapId,gapType:gap.gapType,component:gap.component,dimension:gap.dimension??null,severity:gap.severity,summary:gap.summary})):[];
    const staleEvidence=unresolvedGaps.filter(gap=>['stale-plan','temporal-evidence-order'].includes(gap.gapType));
    const risks=[...openIncidents.map(item=>deepFreeze({riskType:'open-incident',eventId:item.eventId,component:item.component,title:item.title})),...knownIssues.map(item=>deepFreeze({riskType:'known-issue',eventId:item.eventId,component:item.component,title:item.title})),...unresolvedGaps.filter(gap=>gap.severity==='contradiction').map(gap=>deepFreeze({riskType:'evidence-contradiction',gapId:gap.gapId,component:gap.component,title:gap.summary}))];
    for(const list of[implemented,ciVerified,deployed,liveVerified,activeDecisions,knownIssues,openIncidents,currentWork,nextMilestones,risks,staleEvidence,unresolvedGaps])bounded(list,limits.maxItemsPerList,'pdk4-snapshot-list-limit');
    const at=generatedAt??clock().toISOString(),snapshot=createProjectSnapshotView({projectKey,sourceRevision,sourceCursor,generatedAt:at,implemented,ciVerified,deployed,liveVerified,activeDecisions,knownIssues,openIncidents,currentWork,nextMilestones,risks,staleEvidence,unresolvedGaps},{clock});
    const registryFingerprint=sha256({projectKey,eventIdentities:canonicalEvents.map(event=>`${event.memoryId}:${event.eventId}:${event.effectiveAt}`),reconciliationFingerprint:rec?.reconciliationFingerprint??null,components:registry});const snapshotFingerprint=sha256({projectKey,sourceRevision,sourceCursor,registryFingerprint,snapshot:{...snapshot,generatedAt:null}});
    return deepFreeze({contractVersion:PDK4_COMPONENT_SNAPSHOT_CONTRACT_VERSION,projectKey,componentRegistry:Object.freeze(registry),snapshot,canonicalFactCount:canonicalEvents.length,ignoredUnconfirmedCount,registryFingerprint,snapshotFingerprint,trust:'snapshot-derived',confirmed:false,authorityAllowed:false});
  }
  return Object.freeze({build});
}
