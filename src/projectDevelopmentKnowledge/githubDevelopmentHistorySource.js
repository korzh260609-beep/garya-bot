function required(value,name){if(typeof value!=='string'||value.trim()==='')throw new TypeError(`${name} is required`);return value.trim();}
function repository(value){const repo=required(value,'repository').toLowerCase();if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo))throw new TypeError('repository must be owner/name');return repo;}
function positive(value,name,max=100){const n=Number(value);if(!Number.isInteger(n)||n<1||n>max)throw new TypeError(`${name} must be between 1 and ${max}`);return n;}
function sha(value,name='sha'){const text=required(value,name).toLowerCase();if(!/^[a-f0-9]{40}$/.test(text))throw new TypeError(`${name} must be a full immutable git SHA`);return text;}
function fail(code,message,status=null){const error=new Error(message);error.code=code;error.status=status;throw error;}
function parseLastPage(link){const text=String(link??'');for(const part of text.split(',')){if(!/rel="last"/.test(part))continue;const match=part.match(/[?&]page=(\d+)/);if(match)return Number(match[1]);}return 1;}
function commit(record,position=null){return Object.freeze({sha:sha(record?.sha,'commit.sha'),committedAt:required(record?.commit?.committer?.date??record?.commit?.author?.date,'commit.committedAt'),author:record?.commit?.author?.name??record?.author?.login??null,message:record?.commit?.message??null,parentShas:Object.freeze(Array.isArray(record?.parents)?record.parents.map(parent=>String(parent.sha)):[]),position});}
function encodeCursor(value){return Buffer.from(JSON.stringify(value),'utf8').toString('base64url');}
function decodeCursor(value){if(value==null)return null;try{return JSON.parse(Buffer.from(required(value,'cursorToken'),'base64url').toString('utf8'));}catch{fail('pdk4-github-history-cursor-invalid','invalid GitHub history cursor token');}}

export const PDK4_GITHUB_HISTORY_SOURCE_CONTRACT_VERSION=1;

export function createGitHubDevelopmentHistorySource({fetchImpl=globalThis.fetch,allowedRepositories=[],branch='dev/sg2.1-semantic',apiBaseUrl='https://api.github.com',headersProvider=async()=>({})}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('fetchImpl is required');if(typeof headersProvider!=='function')throw new TypeError('headersProvider is required');
  const allowed=new Set(allowedRepositories.map(repository));if(allowed.size===0)fail('pdk4-github-history-policy-missing','at least one approved GitHub repository is required');const branchName=required(branch,'branch'),base=required(apiBaseUrl,'apiBaseUrl').replace(/\/+$/,'');
  async function request(path){let headers;try{headers=await headersProvider();}catch{fail('pdk4-github-history-connector-unavailable','GitHub headers unavailable');}let response;try{response=await fetchImpl(`${base}${path}`,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'sg-pdk4-history-source',...(headers??{})}});}catch{fail('pdk4-github-history-connector-unavailable','GitHub history request failed');}if(!response?.ok)fail('pdk4-github-history-request-failed',`GitHub history request failed with status ${response?.status??'unknown'}`,response?.status??null);let body;try{body=await response.json();}catch{fail('pdk4-github-history-response-invalid','GitHub history returned invalid JSON');}return{body,headers:response.headers};}
  function allow(repo){if(!allowed.has(repo))fail('pdk4-github-history-repository-denied',`repository is not approved for PDK4: ${repo}`);}
  async function resolveAnchor(repo){const {body}=await request(`/repos/${repo}/commits/${encodeURIComponent(branchName)}`);return sha(body?.sha,'bootstrap anchor SHA');}
  async function listCommits({repository:repoInput,cursorToken=null,limit=50,order='asc'}={}){
    const repo=repository(repoInput);allow(repo);if(order!=='asc')throw new TypeError('PDK4 historical bootstrap requires asc order');let pageSize=positive(limit,'limit',100);let cursor=decodeCursor(cursorToken),anchorSha,page;
    if(cursor){
      if(cursor.repository!==repo||cursor.branch!==branchName)fail('pdk4-github-history-cursor-mismatch','GitHub history cursor scope mismatch');
      const cursorLimit=positive(cursor.limit,'cursor limit',100);
      if(cursorLimit>pageSize)fail('pdk4-github-history-cursor-mismatch','GitHub history cursor page size exceeds configured batch limit');
      pageSize=cursorLimit;
      anchorSha=sha(cursor.anchorSha,'cursor anchor SHA');page=positive(cursor.page,'cursor page',1000000);
    }else{
      anchorSha=await resolveAnchor(repo);const discovery=await request(`/repos/${repo}/commits?sha=${anchorSha}&per_page=${pageSize}&page=1`);page=parseLastPage(discovery.headers?.get?.('link'));if(page===1){const records=Array.isArray(discovery.body)?discovery.body:[];return Object.freeze({commits:Object.freeze(records.slice().reverse().map((row,index)=>commit(row,`1:${records.length-index}`))),nextCursorToken:null,complete:true,anchorSha});}
    }
    const {body}=await request(`/repos/${repo}/commits?sha=${anchorSha}&per_page=${pageSize}&page=${page}`);if(!Array.isArray(body))fail('pdk4-github-history-response-invalid','GitHub commits response must be an array');const records=body.slice().reverse().map((row,index)=>commit(row,`${page}:${body.length-index}`));const nextPage=page-1;return Object.freeze({commits:Object.freeze(records),nextCursorToken:nextPage>=1?encodeCursor({repository:repo,branch:branchName,limit:pageSize,anchorSha,page:nextPage}):null,complete:nextPage<1,anchorSha});
  }
  async function listCommitsAfter({repository:repoInput,afterSha,limit=25,order='asc'}={}){
    const repo=repository(repoInput);allow(repo);if(order!=='asc')throw new TypeError('PDK4 continuous ingestion requires asc order');const bounded=positive(limit,'limit',100),baseSha=sha(afterSha,'afterSha'),headSha=await resolveAnchor(repo);if(baseSha===headSha)return Object.freeze({commits:Object.freeze([]),hasMore:false,headSha});const {body}=await request(`/repos/${repo}/compare/${baseSha}...${headSha}?per_page=${bounded}&page=1`);if(String(body?.status??'').toLowerCase()==='diverged')fail('pdk4-github-history-diverged','incremental anchor diverged from configured branch');const rows=Array.isArray(body?.commits)?body.commits:[];const commits=rows.slice(0,bounded).map((row,index)=>commit(row,`compare:${index+1}`));const total=Number(body?.total_commits??rows.length);return Object.freeze({commits:Object.freeze(commits),hasMore:total>commits.length,headSha});
  }
  return Object.freeze({resolveAnchor,listCommits,listCommitsAfter});
}
