const MAX_GAPS = 1000;
function required(value,name){if(typeof value!=='string'||value.trim()==='')throw new TypeError(`${name} is required`);return value.trim();}
function project(value){return required(value,'projectKey').toLowerCase();}
function repository(value){const repo=required(value,'repository').toLowerCase();if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo))throw new TypeError('repository must be owner/name');return repo;}
function n(value){return Math.max(0,Number(value??0)||0);}
function freeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))freeze(child);return Object.freeze(value);}
function health(ok,details={}){return freeze({status:ok?'ok':'degraded',...details});}
async function scalar(database,sql,params=[]){const result=await database.query(sql,params);return n(result.rows?.[0]?.count);}

export const PDK4_DIAGNOSTICS_CONTRACT_VERSION=1;

export function createDevelopmentKnowledgeDiagnostics({database,historyCursorStore,ingestionStateStore,snapshotBuilder=null,reconciler=null,authorization=null,clock=()=>new Date()}={}){
  if(!database?.query)throw new TypeError('started PostgreSQL database is required');
  if(!historyCursorStore?.getCursor||!historyCursorStore?.countProcessed)throw new TypeError('historyCursorStore is required');
  if(!ingestionStateStore?.getState||!ingestionStateStore?.countProcessed)throw new TypeError('ingestionStateStore is required');
  async function authorize(input){if(!authorization)return;if(typeof authorization.assertAllowed!=='function')throw new TypeError('authorization.assertAllowed is required');const result=await authorization.assertAllowed(input);if(result===false||result?.allowed===false){const error=new Error('PDK4 diagnostics authorization denied');error.code='pdk4-diagnostics-authority-denied';throw error;}}
  async function inspect({projectKey,repository:repoInput}={}){
    const p=project(projectKey),repo=repository(repoInput);await authorize({projectKey:p,repository:repo,operation:'pdk4.diagnostics'});
    const cursor=await historyCursorStore.getCursor({projectKey:p,sourceKind:'github-commit',sourceScope:repo});
    const ingestion=await ingestionStateStore.getState({projectKey:p,repository:repo});
    const [commitsScanned,incrementalProcessed,eventsExtracted,eventsConfirmed,eventsRejected,eventsSuperseded,unresolvedConflicts]=await Promise.all([
      historyCursorStore.countProcessed({projectKey:p,sourceKind:'github-commit',sourceScope:repo}),
      ingestionStateStore.countProcessed({projectKey:p,repository:repo}),
      scalar(database,"SELECT count(*)::int AS count FROM project_memory_entries WHERE project_key=$1 AND fact_type='project-event'",[p]),
      scalar(database,"SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmed=true AND m.confirmation_state='confirmed'",[p]),
      scalar(database,"SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND m.confirmation_state='rejected'",[p]),
      scalar(database,"SELECT count(*)::int AS count FROM project_memory_entries e JOIN memory_records m USING(memory_id) WHERE e.project_key=$1 AND e.fact_type='project-event' AND (m.lifecycle_state='superseded' OR m.superseded_at IS NOT NULL)",[p]),
      scalar(database,"SELECT count(*)::int AS count FROM project_memory_conflicts WHERE project_key=$1 AND status='open'",[p])
    ]);
    const sourceGap=Math.max(0,commitsScanned-eventsExtracted);
    const bootstrapComplete=cursor?.status==='complete';
    const continuousReady=bootstrapComplete&&Boolean(ingestion)&&ingestion.bootstrapLastSourceId===cursor?.lastSourceId;
    let registry=null,snapshot=null,reconciliation=null;
    if(typeof snapshotBuilder?.build==='function'){
      const built=await snapshotBuilder.build({projectKey:p});
      registry=built?.registry??null;snapshot=built?.snapshot??null;
    }
    if(typeof reconciler?.diagnostics==='function')reconciliation=await reconciler.diagnostics({projectKey:p});
    const gaps=Math.min(MAX_GAPS,n(reconciliation?.gapCount??snapshot?.unresolvedGaps?.length??0));
    const timelineOk=eventsExtracted===0||eventsConfirmed<=eventsExtracted;
    const generatedAt=new Date(clock()).toISOString();
    return freeze({
      contractVersion:PDK4_DIAGNOSTICS_CONTRACT_VERSION,kind:'DevelopmentKnowledgeDiagnostics',projectKey:p,repository:repo,generatedAt,
      development_history_health:health(bootstrapComplete&&timelineOk,{bootstrapComplete,timelineIntegrity:timelineOk}),
      historical_bootstrap_status:cursor?.status??'not-started',historical_bootstrap_cursor:cursor?{lastSourceId:cursor.lastSourceId??null,scannedCount:n(cursor.scannedCount),batchCount:n(cursor.batchCount),completedAt:cursor.completedAt??null}:null,
      commits_scanned:n(commitsScanned),events_extracted:n(eventsExtracted),events_confirmed:n(eventsConfirmed),events_rejected:n(eventsRejected),events_superseded:n(eventsSuperseded),
      unresolved_conflicts:n(unresolvedConflicts),unlinked_source_events:sourceGap,timeline_integrity:health(timelineOk,{eventCount:n(eventsExtracted),confirmedCount:n(eventsConfirmed)}),
      component_registry_health:health(registry!==null||snapshotBuilder===null,{available:registry!==null,componentCount:n(registry?.components?.length)}),
      current_snapshot_health:health(snapshot!==null||snapshotBuilder===null,{available:snapshot!==null}),
      continuous_ingestion_health:health(continuousReady,{ready:continuousReady,processed:n(incrementalProcessed),lastCommitSha:ingestion?.lastCommitSha??null}),
      last_successful_ingestion:ingestion?.lastProcessedAt??null,reconciliation_gap_count:gaps,
      source_gap_check:health(sourceGap===0||eventsExtracted===0,{unlinkedSourceCount:sourceGap,note:'scanner bookkeeping and accepted project events are distinct evidence dimensions'})
    });
  }
  return Object.freeze({inspect});
}
