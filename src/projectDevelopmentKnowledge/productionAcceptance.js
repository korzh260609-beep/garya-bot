function required(value,name){if(typeof value!=='string'||value.trim()==='')throw new TypeError(`${name} is required`);return value.trim();}
function project(value){return required(value,'projectKey').toLowerCase();}
function repository(value){const repo=required(value,'repository').toLowerCase();if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo))throw new TypeError('repository must be owner/name');return repo;}
function freeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))freeze(child);return Object.freeze(value);}
function fail(code,message){const error=new Error(message);error.code=code;throw error;}
function nonEmptyAnswer(value){return typeof value==='string'&&value.trim().length>0;}

export const PDK4_PRODUCTION_ACCEPTANCE_CONTRACT_VERSION=1;
export const PDK4_ACCEPTANCE_QUERY_SET=Object.freeze([
  Object.freeze({key:'genesis',text:'What is the project genesis?'}),
  Object.freeze({key:'evolution',text:'How did the project evolve?'}),
  Object.freeze({key:'current',text:'What is the current project state?'}),
  Object.freeze({key:'planning',text:'What is planned next?'})
]);

export function createDevelopmentKnowledgeProductionAcceptance({historicalScanner,continuousIngestion,diagnostics,answerQuery,restartProbe,authorization=null}={}){
  if(typeof historicalScanner?.scanToCurrent!=='function')throw new TypeError('historicalScanner.scanToCurrent is required');
  if(typeof continuousIngestion?.runToCurrent!=='function')throw new TypeError('continuousIngestion.runToCurrent is required');
  if(typeof diagnostics?.inspect!=='function')throw new TypeError('diagnostics.inspect is required');
  if(typeof answerQuery!=='function')throw new TypeError('answerQuery is required');
  if(typeof restartProbe!=='function')throw new TypeError('restartProbe is required');
  async function authorize(input){if(!authorization)return;if(typeof authorization.assertAllowed!=='function')throw new TypeError('authorization.assertAllowed is required');const result=await authorization.assertAllowed(input);if(result===false||result?.allowed===false)fail('pdk4-acceptance-authority-denied','PDK4 production acceptance authorization denied');}
  async function run({projectKey,repository:repoInput,request,batchLimit=50,maxBootstrapBatches=1000,maxIncrementalBatches=20,queries=PDK4_ACCEPTANCE_QUERY_SET}={}){
    const p=project(projectKey),repo=repository(repoInput);if(!request?.scope||String(request.scope.projectScope??'').toLowerCase()!==p)fail('pdk4-acceptance-scope-mismatch','acceptance request scope does not match project');await authorize({projectKey:p,repository:repo,operation:'pdk4.production-acceptance'});
    const bootstrap=await historicalScanner.scanToCurrent({projectKey:p,repository:repo,batchLimit,maxBatches:maxBootstrapBatches});if(bootstrap?.status!=='complete')fail('pdk4-acceptance-bootstrap-incomplete','historical bootstrap did not reach current');
    const beforeRestart=await diagnostics.inspect({projectKey:p,repository:repo});if(beforeRestart.historical_bootstrap_status!=='complete')fail('pdk4-acceptance-bootstrap-diagnostics-failed','diagnostics did not confirm completed bootstrap');
    const restart=await restartProbe({projectKey:p,repository:repo,expectedLastSourceId:bootstrap.cursor?.lastSourceId??null});if(restart?.durable!==true||restart?.lastSourceId!==(bootstrap.cursor?.lastSourceId??null))fail('pdk4-acceptance-restart-failed','PostgreSQL restart/resume probe did not preserve bootstrap cursor');
    const incremental=await continuousIngestion.runToCurrent({projectKey:p,repository:repo,maxBatches:maxIncrementalBatches});if(incremental?.status!=='current')fail('pdk4-acceptance-incremental-incomplete','incremental ingestion did not reach current');
    const replay=await continuousIngestion.runToCurrent({projectKey:p,repository:repo,maxBatches:1});if(replay?.status!=='current'||Number(replay.processed??0)!==0)fail('pdk4-acceptance-replay-not-idempotent','incremental replay processed duplicate sources');
    const after=await diagnostics.inspect({projectKey:p,repository:repo});if(after.development_history_health?.status!=='ok'||after.continuous_ingestion_health?.status!=='ok')fail('pdk4-acceptance-diagnostics-degraded','PDK4 diagnostics are degraded after acceptance flow');
    if(!Array.isArray(queries)||queries.length<4||queries.length>9)throw new TypeError('queries must contain 4..9 bounded acceptance queries');const answers={};
    for(const query of queries){const text=required(query?.text,'query.text');const key=required(query?.key,'query.key');const answer=await answerQuery({text,request,projectKey:p});if(!nonEmptyAnswer(answer)||answer.trim()===text.trim())fail('pdk4-acceptance-answer-failed',`ordinary SG answer failed for ${key}`);answers[key]=answer;}
    return freeze({contractVersion:PDK4_PRODUCTION_ACCEPTANCE_CONTRACT_VERSION,kind:'DevelopmentKnowledgeProductionAcceptance',status:'passed',projectKey:p,repository:repo,bootstrap,restart,incremental,replay,diagnostics:after,answers});
  }
  return Object.freeze({run});
}
