import { createHash } from 'node:crypto';
import { createGitHubRepositoryIdentity } from './githubDevelopmentContract.js';

const SHA=/^[0-9a-f]{40}$/u;
const READ_ACTIONS=new Set(['github.repository.inspect','github.code.search','github.file.read','github.branch.inspect','github.branch.compare','github.pr.inspect','github.review.inspect','github.issue.inspect','github.ci.verify','github.workflow.inspect','github.discovery.public','github.discovery.private']);
const METHODS=Object.freeze({
  'github.pr.create':['collaborationService','upsertPullRequest'],'github.pr.update':['collaborationService','upsertPullRequest'],
  'github.review.inspect':['collaborationService','readReviewThreads'],'github.review.respond':['collaborationService','replyToReview'],
  'github.issue.create':['collaborationService','upsertIssue'],'github.issue.update':['collaborationService','upsertIssue'],'github.issue.close':['collaborationService','upsertIssue'],
  'github.branch.create':['atomicCommitService','ensureBranch'],'github.commit.create':['atomicCommitService','applyAtomicCommit'],'github.push.execute':['atomicCommitService','applyAtomicCommit'],
  'github.ci.verify':['ciService','inspectExactHead'],'github.workflow.inspect':['ciService','inspectExactHead'],'github.workflow.rerun':['ciService','rerunFailed'],
  'github.release.create':['collaborationService','createTagAndRelease']
});
function fail(code,message){const error=new Error(message);error.name='GitHubPlatformOperationsError';error.code=code;throw error}
function req(value,field){if(typeof value!=='string'||!value.trim())fail('gde6-input-invalid',`${field} is required`);return value.trim()}
function freeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;for(const child of Object.values(value))freeze(child);return Object.freeze(value)}
function key(input){return input.idempotencyKey??`gde6-${createHash('sha256').update([input.traceContext?.traceId,input.traceContext?.requestId,input.canonicalAction,input.repository?.fullName??'',input.branch??''].join('|')).digest('hex').slice(0,24)}`}
function fullSha(value,field){const normalized=req(value,field).toLowerCase();if(!SHA.test(normalized))fail('gde6-exact-head-required',`${field} must be a full SHA`);return normalized}

export function createGitHubPlatformOperationsService({repositoryReadService,discoveryService,atomicCommitService,collaborationService,ciService,developmentBridge=null,taskStore=null,securityControlPlane,auditSink,clock=()=>new Date()}={}){
  if(!repositoryReadService?.readSnapshot||!discoveryService?.search||!atomicCommitService||!collaborationService||!ciService||!securityControlPlane?.authorize||!auditSink?.record)throw new TypeError('GDE6 existing GH3 services are required');
  async function continuity(input){if(!taskStore?.get)fail('gde6-continuity-unavailable','durable development task store is unavailable');const taskId=req(input.context?.taskId,'context.taskId');const task=await taskStore.get(taskId);if(!task)fail('gde6-context-not-found','durable development context was not found');if(task.globalUserId!==input.actor?.globalUserId||task.projectId!==input.projectScope)fail('gde6-context-scope-denied','durable development context scope mismatch');return task}
  async function execute(input={}){
    const action=req(input.canonicalAction,'canonicalAction');let task=null;
    if(action==='github.development.continue'||input.context?.taskId)task=await continuity(input);
    const repository=createGitHubRepositoryIdentity(input.repository??task?.repository);const branch=req(input.branch??task?.targetRef?.name,'branch');
    if(branch==='main'||branch==='master')fail('gde6-protected-branch-denied','protected default branch cannot be selected silently');
    const oldHead=fullSha(input.expectedHeadSha??task?.checkpoint?.live?.headSha??task?.baseline?.sha,'expectedHeadSha');const idempotencyKey=key({...input,repository,branch});
    const capabilityAssessment=await securityControlPlane.authorize({capability:req(input.capability,'capability'),actor:input.actor,projectScope:input.projectScope,repositoryResourceId:req(input.repositoryResourceId,'repositoryResourceId'),branch,paths:input.paths??[],connectionId:req(input.connectionId,'connectionId'),credentialId:req(input.credentialId,'credentialId'),actionRequest:input.actionRequest});
    let result,operationClass=READ_ACTIONS.has(action)?'read':'mutation';
    if(action==='github.development.execute'||action==='github.development.continue'){
      if(!developmentBridge?.execute)fail('gde6-development-bridge-unavailable','existing GH3 development bridge is unavailable');
      result=await developmentBridge.execute({...input,canonicalModel:input.canonicalModel??{resolutionStatus:'resolved',action:{name:'github.development.execute'},parameters:{instruction:task?.intent}},resolvedTarget:input.resolvedTarget??{repository,branch,baselineHead:oldHead,connectionId:input.connectionId},capabilityAssessment:input.capabilityAssessment});
    }
    else if(action==='github.discovery.public'||action==='github.discovery.private')result=await discoveryService.search({...input.operation,repository,connectionId:input.connectionId,visibility:action.endsWith('.public')?'public':'authorized-private'});
    else if(action==='github.code.search')result=await discoveryService.search({...input.operation,kind:'code',repository,connectionId:input.connectionId,visibility:'authorized-private'});
    else if(['github.repository.inspect','github.file.read','github.branch.inspect','github.branch.compare','github.pr.inspect','github.issue.inspect'].includes(action))result=await repositoryReadService.readSnapshot({repository,ref:{kind:'branch',name:branch},visibility:'authorized-private',connectionId:input.connectionId,...input.operation});
    else {const route=METHODS[action];if(!route)fail('gde6-action-unsupported',`unsupported canonical GitHub action: ${action}`);const service={atomicCommitService,collaborationService,ciService}[route[0]];result=await service[route[1]]({repository,connectionId:input.connectionId,idempotencyKey,expectedHeadSha:oldHead,...input.operation});}
    const observedHead=result?.commitSha??result?.headSha??result?.revision??oldHead;const operationIdentity=result?.commitSha??result?.pullNumber??result?.issueNumber??result?.commentId??result?.releaseId??result?.runId??result?.task?.taskId??null;if(operationClass==='mutation'&&result?.reused!==true&&result?.headSha===oldHead&&!operationIdentity&&!result?.status)fail('gde6-post-condition-unverified','mutation did not produce verifiable operation evidence');
    const audit=freeze({actor:input.actor,canonicalAction:action,repository:repository.fullName,branch,oldHead,newHead:SHA.test(String(observedHead))?observedHead:null,changedPaths:result?.changedPaths??input.paths??[],operationClass,identity:{commit:result?.commitSha??null,pullRequest:result?.pullNumber??null,issue:result?.issueNumber??null,workflowRun:result?.runId??null},securityResult:capabilityAssessment,postCondition:result?.exactHeadVerified===true?'exact-head-verified':result?.pushVerified===true?'push-verified':result?.status??null,traceId:input.traceContext?.traceId??null,idempotencyKey,timestamp:clock().toISOString()});
    await auditSink.record(audit);return freeze({canonicalAction:action,repository,branch,oldHead,newHead:audit.newHead,result,audit,continuityTaskId:task?.taskId??null});
  }
  return freeze({execute});
}