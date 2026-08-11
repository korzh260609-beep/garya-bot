import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence, runMigrations } from '../src/persistence/index.js';
import { createPostgresProjectMemoryStore, createProjectFact } from '../src/projectMemory/index.js';
import { createLocalProductionHarness } from '../src/runtime/localProductionHarness.js';

const connectionString=process.env.DATABASE_URL;
const integration=connectionString?test:test.skip;
const REPOSITORY='korzh260609-beep/garya-bot';
const SHA='dddddddddddddddddddddddddddddddddddddddd';

integration('PDK4.12: durable PDK4 fact survives restart and ordinary SG answer uses guarded development knowledge',async()=>{
  const projectKey=`pdk412-runtime-${randomUUID().slice(0,8)}`;
  const memoryId=`pdk412:${projectKey}:current`;
  const at='2026-08-11T04:00:00Z';
  const first=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk412-runtime-setup'});
  await first.start();await runMigrations(first.database);
  try{
    const store=createPostgresProjectMemoryStore(first.database);
    const fact=createProjectFact({
      memoryId,projectKey,namespace:`project.${projectKey}.architecture`,factType:'project-event',entityKey:'pdk4.12-production-acceptance',
      fact:{pdk4ContractVersion:1,eventType:'current-state',component:'project-development-knowledge',title:'PDK4.12 production acceptance',summary:'PDK4.12 production acceptance is verified in the production-like runtime E2E.',newState:'closed',occurredAt:at,effectiveAt:at,verification:[{kind:'ci',sourceId:'ci:pdk4.12',ref:`github:${REPOSITORY}@${SHA}`,verifiedAt:at}]},
      source:{kind:'github',ref:`github:${REPOSITORY}@${SHA}`,actorId:'monarch',timestamp:at},sourceEventId:`event:${memoryId}`,traceId:`trace:${memoryId}`,trust:'verified',confirmed:true,confirmationState:'confirmed',lifecycleState:'active',validFrom:at,createdAt:at,updatedAt:at,tags:['pdk4.12','production-e2e']
    },{clock:()=>new Date(at)});
    await store.put(fact);
  }finally{await first.close();}

  const harness=createLocalProductionHarness({env:{SG_PERSISTENCE_MODE:'postgres',DATABASE_URL:connectionString,DATABASE_SSL:'false',SG_PROJECT_SCOPE:projectKey,SG_REVISION:'pdk4.12-production-e2e'},clock:()=>new Date('2026-08-11T04:30:00Z')});
  await harness.runtime.start();let result;
  try{
    const restored=await harness.projectMemoryStore.get(memoryId,{projectKey});assert.equal(restored.memoryId,memoryId);
    result=await harness.transport.send({text:'What is the current project state?',locale:'en',userId:'pdk412-runtime-user',projectId:projectKey});
    assert.equal(result.response.status,'success');const rendered=JSON.stringify(result.response);
    assert.match(rendered,/PDK4\.12 production acceptance is verified/i);
    assert.match(rendered,/github:/i);
    assert.match(rendered,/live state was not independently re-verified/i);
  }finally{await harness.runtime.stop();}

  const cleanup=createPostgresPersistence({connectionString,ssl:false,applicationName:'pdk412-runtime-cleanup'});await cleanup.start();try{await cleanup.database.query("DELETE FROM memory_records WHERE project_scope=$1 AND memory_layer='project-memory'",[projectKey]);}finally{await cleanup.close();}
});
