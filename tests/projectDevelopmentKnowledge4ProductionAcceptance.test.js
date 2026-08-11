import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import {
  createGitHubDevelopmentHistorySource,
  createPostgresHistoricalCursorStore,
  createPostgresContinuousIngestionStore,
  createDevelopmentKnowledgeDiagnostics,
  createDevelopmentKnowledgeProductionAcceptance
} from '../src/projectDevelopmentKnowledge/index.js';

const repository='korzh260609-beep/garya-bot';
const branch='dev/sg2.1-semantic';
const A='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B='bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const C='cccccccccccccccccccccccccccccccccccccccc';
function response(body,{link=null,status=200}={}){return{ok:status>=200&&status<300,status,headers:{get(name){return name.toLowerCase()==='link'?link:null;}},async json(){return body;}};}
function commit(sha,date){return{sha,commit:{committer:{date},author:{date,name:'dev'},message:`commit ${sha[0]}`},parents:[]};}

test('PDK4.12: production GitHub source scans oldest-first from immutable branch anchor and supports bounded compare ingestion',async()=>{
  const calls=[];
  const fetchImpl=async(url)=>{calls.push(url);if(url.endsWith(`/commits/${branch}`))return response(commit(C,'2026-08-03T00:00:00Z'));
    if(url.includes(`commits?sha=${C}&per_page=2&page=1`)&&calls.filter(v=>v.includes('per_page=2&page=1')).length===1)return response([commit(C,'2026-08-03T00:00:00Z'),commit(B,'2026-08-02T00:00:00Z')],{link:'<https://api.github.com/x?page=2>; rel="last"'});
    if(url.includes(`commits?sha=${C}&per_page=2&page=2`))return response([commit(A,'2026-08-01T00:00:00Z')]);
    if(url.includes(`commits?sha=${C}&per_page=2&page=1`))return response([commit(C,'2026-08-03T00:00:00Z'),commit(B,'2026-08-02T00:00:00Z')]);
    if(url.includes(`/compare/${B}...${C}`))return response({status:'ahead',total_commits:1,commits:[commit(C,'2026-08-03T00:00:00Z')]});throw new Error(`unexpected ${url}`);};
  const source=createGitHubDevelopmentHistorySource({fetchImpl,allowedRepositories:[repository],branch});
  const first=await source.listCommits({repository,limit:2,order:'asc'});assert.deepEqual(first.commits.map(x=>x.sha),[A]);assert.equal(first.complete,false);assert.equal(first.anchorSha,C);
  const second=await source.listCommits({repository,cursorToken:first.nextCursorToken,limit:2,order:'asc'});assert.deepEqual(second.commits.map(x=>x.sha),[B,C]);assert.equal(second.complete,true);
  const incremental=await source.listCommitsAfter({repository,afterSha:B,limit:2,order:'asc'});assert.deepEqual(incremental.commits.map(x=>x.sha),[C]);assert.equal(incremental.hasMore,false);
});

test('PDK4.12: production acceptance proves bootstrap, restart, incremental replay and ordinary SG answers',async()=>{
  let continuousCalls=0;
  const acceptance=createDevelopmentKnowledgeProductionAcceptance({
    historicalScanner:{async scanToCurrent(){return{status:'complete',cursor:{lastSourceId:`github:${repository}:commit:${B}`}};}},
    continuousIngestion:{async runToCurrent(){continuousCalls++;return continuousCalls===1?{status:'current',processed:1,state:{lastCommitSha:C}}:{status:'current',processed:0,state:{lastCommitSha:C}};}},
    diagnostics:{async inspect(){return{historical_bootstrap_status:'complete',development_history_health:{status:'ok'},continuous_ingestion_health:{status:'ok'}};}},
    async restartProbe({expectedLastSourceId}){return{durable:true,lastSourceId:expectedLastSourceId};},
    async answerQuery({text}){return`Verified answer: ${text}`;},authorization:{async assertAllowed(){return true;}}
  });
  const result=await acceptance.run({projectKey:'sg2.1',repository,request:{scope:{projectScope:'sg2.1'}}});assert.equal(result.status,'passed');assert.equal(Object.keys(result.answers).length,4);assert.equal(result.replay.processed,0);
});

test('PDK4.12: acceptance fails closed on authorization and non-idempotent replay',async()=>{
  const base={historicalScanner:{async scanToCurrent(){return{status:'complete',cursor:{lastSourceId:'x'}};}},diagnostics:{async inspect(){return{historical_bootstrap_status:'complete',development_history_health:{status:'ok'},continuous_ingestion_health:{status:'ok'}};}},restartProbe:async()=>({durable:true,lastSourceId:'x'}),answerQuery:async()=>('answer')};
  const denied=createDevelopmentKnowledgeProductionAcceptance({...base,continuousIngestion:{async runToCurrent(){return{status:'current',processed:0};}},authorization:{async assertAllowed(){return false;}}});
  await assert.rejects(()=>denied.run({projectKey:'sg2.1',repository,request:{scope:{projectScope:'sg2.1'}}}),(error)=>error.code==='pdk4-acceptance-authority-denied');
  let calls=0;const replay=createDevelopmentKnowledgeProductionAcceptance({...base,continuousIngestion:{async runToCurrent(){calls++;return{status:'current',processed:calls===1?1:1};}}});
  await assert.rejects(()=>replay.run({projectKey:'sg2.1',repository,request:{scope:{projectScope:'sg2.1'}}}),(error)=>error.code==='pdk4-acceptance-replay-not-idempotent');
});

test('PDK4.12: bounded diagnostics exposes bootstrap, ingestion, history and fail-closed authorization',async()=>{
  const cursor={status:'complete',lastSourceId:`github:${repository}:commit:${B}`,scannedCount:9,batchCount:2,completedAt:'2026-08-10T00:00:00Z'};
  const history={async getCursor(){return cursor;},async countProcessed(){return 9;}};const ingestion={async getState(){return{bootstrapLastSourceId:cursor.lastSourceId,lastCommitSha:C,lastProcessedAt:'2026-08-11T00:00:00Z'};},async countProcessed(){return 1;}};
  const database={async query(sql){if(sql.includes("fact_type='project-event' AND m.confirmed=true")&&sql.includes('superseded'))return{rows:[{count:1}]};if(sql.includes('count(DISTINCT'))return{rows:[{count:3}]};if(sql.includes("lifecycle_state='active'"))return{rows:[{count:2}]};if(sql.includes('project_memory_conflicts'))return{rows:[{count:0}]};if(sql.includes("confirmation_state='rejected'"))return{rows:[{count:1}]};if(sql.includes("m.confirmed=true"))return{rows:[{count:4}]};if(sql.includes("fact_type='project-event'"))return{rows:[{count:5}]};return{rows:[{count:0}]};}};
  const diagnostics=createDevelopmentKnowledgeDiagnostics({database,historyCursorStore:history,ingestionStateStore:ingestion,authorization:{async assertAllowed(){return true;}}});const result=await diagnostics.inspect({projectKey:'sg2.1',repository});assert.equal(result.historical_bootstrap_status,'complete');assert.equal(result.commits_scanned,9);assert.equal(result.events_extracted,5);assert.equal(result.continuous_ingestion_health.status,'ok');assert.equal(result.component_registry_health.status,'ok');
  const denied=createDevelopmentKnowledgeDiagnostics({database,historyCursorStore:history,ingestionStateStore:ingestion,authorization:{async assertAllowed(){return false;}}});await assert.rejects(()=>denied.inspect({projectKey:'sg2.1',repository}),(error)=>error.code==='pdk4-diagnostics-authority-denied');
});

const connectionString=process.env.DATABASE_URL;const integration=connectionString?test:test.skip;
integration('PDK4.12: PostgreSQL restart preserves completed bootstrap and incremental anchor',async()=>{
  const projectKey=`pdk412-${randomUUID().slice(0,8)}`;const sourceId=`github:${repository}:commit:${B}`;
  const first=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk412-a'});await first.start();await runMigrations(first.database);const h1=createPostgresHistoricalCursorStore(first.database);const i1=createPostgresContinuousIngestionStore(first.database);const initial=await h1.ensureCursor({projectKey,sourceKind:'github-commit',sourceScope:repository});await h1.commitBatch({projectKey,sourceKind:'github-commit',sourceScope:repository,expectedCursorToken:initial.cursorToken,nextCursorToken:null,lastSourceId:sourceId,processedSources:[{sourceId,fingerprint:'fp',timestamp:'2026-08-10T00:00:00Z'}],complete:true});await i1.ensureState({projectKey,repository,bootstrapLastSourceId:sourceId,bootstrapLastCommitSha:B});await first.close();
  const second=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk412-b'});await second.start();try{const h2=createPostgresHistoricalCursorStore(second.database);const i2=createPostgresContinuousIngestionStore(second.database);const cursor=await h2.getCursor({projectKey,sourceKind:'github-commit',sourceScope:repository});const state=await i2.getState({projectKey,repository});assert.equal(cursor.status,'complete');assert.equal(cursor.lastSourceId,sourceId);assert.equal(state.bootstrapLastSourceId,sourceId);assert.equal(state.lastCommitSha,B);}finally{await second.close();}
});
