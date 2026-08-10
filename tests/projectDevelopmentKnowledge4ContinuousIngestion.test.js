import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/persistence/index.js';
import {
  createContinuousGitHubIngestion,
  createPostgresContinuousIngestionStore,
  createIncrementalDevelopmentKnowledgeProcessor
} from '../src/projectDevelopmentKnowledge/index.js';

const repo='korzh260609-beep/garya-bot';
const sha=(n)=>n.toString(16).padStart(40,'0');
const commit=(n)=>({sha:sha(n),committedAt:new Date(Date.UTC(2026,7,10,12,n,0)).toISOString()});

function memoryStateStore(){
  const states=new Map(),processed=new Map(),triggers=new Set();const key=(p,r)=>`${p}|${r}`;
  return {
    async getState({projectKey,repository}){return states.get(key(projectKey,repository))??null;},
    async ensureState({projectKey,repository,bootstrapLastSourceId}){const k=key(projectKey,repository);if(!states.has(k))states.set(k,{projectKey,repository,bootstrapLastSourceId,lastSourceId:null,lastCommitSha:null,processedCount:0});return states.get(k);},
    async isProcessed({projectKey,repository,sourceId}){return (processed.get(key(projectKey,repository))??new Set()).has(sourceId);},
    async recordTrigger({projectKey,repository,triggerId}){const k=`${key(projectKey,repository)}|${triggerId}`;if(triggers.has(k))return{duplicate:true};triggers.add(k);return{duplicate:false};},
    async commitProcessed({projectKey,repository,sourceId,commitSha,occurredAt}){const k=key(projectKey,repository),bucket=processed.get(k)??new Set();if(bucket.has(sourceId))return{duplicate:true,state:states.get(k)};bucket.add(sourceId);processed.set(k,bucket);const s=states.get(k);const next={...s,lastSourceId:sourceId,lastCommitSha:commitSha,processedCount:s.processedCount+1,lastProcessedAt:occurredAt};states.set(k,next);return{duplicate:false,state:next};},
    async countProcessed({projectKey,repository}){return(processed.get(key(projectKey,repository))??new Set()).size;}
  };
}
function historyCursor(projectKey='sg2.1'){return{async getCursor({projectKey:p,sourceScope}){return p===projectKey&&sourceScope===repo?{projectKey:p,sourceKind:'github-commit',sourceScope,status:'complete',lastSourceId:`github:${repo}:commit:${sha(1)}`}:null;}};}
function source(commits){return{async listCommitsAfter({afterSha,limit,order}){assert.equal(order,'asc');const start=afterSha?Math.max(0,commits.findIndex(c=>c.sha===afterSha)+1):0;const page=commits.slice(start,start+limit);return{commits:page,hasMore:start+page.length<commits.length};}};}
function eventResult({projectKey,repository,commitSha}){return{status:'processed',disposition:'event',projectKey,repository,commitSha,sourceFingerprint:`fp-${commitSha}`,occurredAt:commit(2).committedAt,extraction:{trust:'extracted-candidate',confirmed:false,authorityAllowed:false,extractionFingerprint:`ext-${commitSha}`},projectMemoryCandidate:{memoryId:`mem-${commitSha}`,projectKey,trust:'unverified',confirmed:false},reconciliation:{projectKey,confirmed:false,authorityAllowed:false,reconciliationFingerprint:`rec-${commitSha}`}};}

test('PDK4.9: bounded polling processes only commits after completed historical bootstrap',async()=>{
  const store=memoryStateStore();let calls=0;
  const ingestion=createContinuousGitHubIngestion({historyCursorStore:historyCursor(),ingestionStateStore:store,githubSource:source([commit(2),commit(3)]),processCommit:async x=>{calls++;return eventResult(x);}});
  const result=await ingestion.poll({projectKey:'sg2.1',repository:repo,batchLimit:10,triggerId:'poll-1'});
  assert.equal(result.status,'current');assert.equal(result.processed,2);assert.equal(calls,2);assert.equal(result.state.lastCommitSha,sha(3));
});

test('PDK4.9: retry/replay is idempotent for both trigger and source',async()=>{
  const store=memoryStateStore();let calls=0;
  const ingestion=createContinuousGitHubIngestion({historyCursorStore:historyCursor(),ingestionStateStore:store,githubSource:source([commit(2)]),processCommit:async x=>{calls++;return eventResult(x);}});
  const first=await ingestion.poll({projectKey:'sg2.1',repository:repo,triggerId:'same'});
  const duplicate=await ingestion.poll({projectKey:'sg2.1',repository:repo,triggerId:'same'});
  const replay=await ingestion.poll({projectKey:'sg2.1',repository:repo,triggerId:'other'});
  assert.equal(first.processed,1);assert.equal(duplicate.status,'duplicate-trigger');assert.equal(replay.processed,0);assert.equal(calls,1);assert.equal(await store.countProcessed({projectKey:'sg2.1',repository:repo}),1);
});

test('PDK4.9: webhook is trigger-only and repository mismatch fails closed',async()=>{
  const store=memoryStateStore();let calls=0;
  const ingestion=createContinuousGitHubIngestion({historyCursorStore:historyCursor(),ingestionStateStore:store,githubSource:source([commit(2)]),processCommit:async x=>{calls++;return eventResult(x);}});
  const result=await ingestion.handleWebhook({projectKey:'sg2.1',repository:repo,deliveryId:'delivery-1',eventName:'push',payload:{repository:{full_name:repo},before:sha(1)}});
  assert.equal(result.processed,1);assert.equal(calls,1);
  await assert.rejects(()=>ingestion.handleWebhook({projectKey:'sg2.1',repository:repo,deliveryId:'delivery-2',eventName:'push',payload:{repository:{full_name:'evil/other'}}}),(e)=>e.code==='pdk4-continuous-webhook-repository-mismatch');
});

test('PDK4.9: suppressed/non-event commit advances durable ingestion state without PM3 mutation',async()=>{
  const store=memoryStateStore();
  const ingestion=createContinuousGitHubIngestion({historyCursorStore:historyCursor(),ingestionStateStore:store,githubSource:source([commit(2)]),processCommit:async({projectKey,repository,commitSha})=>({status:'processed',disposition:'non-event',projectKey,repository,commitSha,sourceFingerprint:'noise-fp',occurredAt:commit(2).committedAt,extraction:null,projectMemoryCandidate:null,reconciliation:null})});
  const result=await ingestion.poll({projectKey:'sg2.1',repository:repo,triggerId:'noise'});
  assert.equal(result.processed,1);assert.equal(result.state.lastCommitSha,sha(2));assert.equal(result.results[0].result.projectMemoryCandidate,null);
});

test('PDK4.9: incomplete historical bootstrap and denied authorization fail closed before GitHub fetch',async()=>{
  let fetches=0;const badHistory={async getCursor(){return{projectKey:'sg2.1',sourceKind:'github-commit',sourceScope:repo,status:'scanning',lastSourceId:'x'};}};
  const ingestion=createContinuousGitHubIngestion({historyCursorStore:badHistory,ingestionStateStore:memoryStateStore(),githubSource:{async listCommitsAfter(){fetches++;return{commits:[],hasMore:false};}},processCommit:async x=>eventResult(x)});
  await assert.rejects(()=>ingestion.poll({projectKey:'sg2.1',repository:repo}),(e)=>e.code==='pdk4-continuous-bootstrap-required');assert.equal(fetches,0);
  const denied=createContinuousGitHubIngestion({historyCursorStore:historyCursor(),ingestionStateStore:memoryStateStore(),githubSource:{async listCommitsAfter(){fetches++;return{commits:[],hasMore:false};}},processCommit:async x=>eventResult(x),authorization:{async assertAllowed(){return{allowed:false};}}});
  await assert.rejects(()=>denied.poll({projectKey:'sg2.1',repository:repo}),(e)=>e.code==='pdk4-continuous-authority-denied');assert.equal(fetches,0);
});

test('PDK4.9: incremental processor re-verifies immutable commit and stores only unconfirmed PM3 candidate',async()=>{
  const calls=[];
  const processor=createIncrementalDevelopmentKnowledgeProcessor({
    sourceNormalizer:{async normalizeAndVerify(input){calls.push(['normalize',input.sha]);return{projectKey:input.projectKey,repository:input.repository,payload:{sha:input.sha},trust:'verified-source',sourceId:`github:${input.repository}:commit:${input.sha}`,sourceFingerprint:'source-fp',normalizedFingerprint:'norm-fp',occurredAt:commit(2).committedAt};}},
    classifier:{async classify(source){calls.push(['classify',source.sourceId]);return{projectKey:source.projectKey,sourceId:source.sourceId,authorityAllowed:false,retain:true,eventEligible:true};}},
    extractor:{async extract(){return{trust:'extracted-candidate',confirmed:false,authorityAllowed:false,extractionFingerprint:'ext',candidate:{memoryId:'mem',projectKey:'sg2.1',trust:'unverified',confirmed:false}};}},
    projectMemoryStore:{async put(candidate){calls.push(['put',candidate.memoryId]);return candidate;}},
    reconciliationUpdater:{async update({projectKey}){calls.push(['reconcile',projectKey]);return{projectKey,confirmed:false,authorityAllowed:false,reconciliationFingerprint:'rec'};}}
  });
  const result=await processor.processCommit({projectKey:'sg2.1',repository:repo,commitSha:sha(2)});
  assert.equal(result.projectMemoryCandidate.confirmed,false);assert.equal(result.reconciliation.authorityAllowed,false);assert.deepEqual(calls.map(x=>x[0]),['normalize','classify','put','reconcile']);
});

test('PDK4.9: incremental processor never stores suppressed source as PM3 fact',async()=>{
  let writes=0;
  const processor=createIncrementalDevelopmentKnowledgeProcessor({sourceNormalizer:{async normalizeAndVerify(input){return{projectKey:input.projectKey,repository:input.repository,payload:{sha:input.sha},trust:'verified-source',sourceId:'s',sourceFingerprint:'fp',normalizedFingerprint:'n',occurredAt:commit(2).committedAt};}},classifier:{async classify(){return{projectKey:'sg2.1',sourceId:'s',authorityAllowed:false,retain:false,eventEligible:false};}},extractor:{async extract(){throw new Error('must not extract');}},projectMemoryStore:{async put(){writes++;}}});
  const result=await processor.processCommit({projectKey:'sg2.1',repository:repo,commitSha:sha(2)});assert.equal(result.disposition,'non-event');assert.equal(writes,0);
});

const connectionString=process.env.DATABASE_URL;const integration=connectionString?test:test.skip;
integration('PDK4.9: PostgreSQL continuous cursor and idempotency survive restart',async()=>{
  const suffix=randomUUID().toLowerCase(),projectKey=`pdk49-${suffix}`,repository=`korzh260609-beep/garya-bot-${suffix}`;
  const first=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk4.9-first'});await first.start();const store=createPostgresContinuousIngestionStore(first.database);
  await store.ensureState({projectKey,repository,bootstrapLastSourceId:'bootstrap-source'});await store.recordTrigger({projectKey,repository,triggerId:'t1',triggerType:'poll'});await store.commitProcessed({projectKey,repository,sourceId:'source-1',sourceFingerprint:'fp-1',commitSha:sha(2),occurredAt:commit(2).committedAt,triggerId:'t1'});await first.close();
  const restarted=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk4.9-restart'});await restarted.start();const restartedStore=createPostgresContinuousIngestionStore(restarted.database);const state=await restartedStore.getState({projectKey,repository});assert.equal(state.lastCommitSha,sha(2));assert.equal(state.processedCount,1);assert.equal(await restartedStore.isProcessed({projectKey,repository,sourceId:'source-1'}),true);assert.equal((await restartedStore.recordTrigger({projectKey,repository,triggerId:'t1',triggerType:'poll'})).duplicate,true);
  await restarted.database.query('DELETE FROM pdk4_continuous_processed_sources WHERE project_key=$1',[projectKey]);await restarted.database.query('DELETE FROM pdk4_continuous_triggers WHERE project_key=$1',[projectKey]);await restarted.database.query('DELETE FROM pdk4_continuous_ingestion_state WHERE project_key=$1',[projectKey]);await restarted.close();
});
