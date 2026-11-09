/* Anonymous ELPA submissions: minimal, fail-closed Cloudflare Worker.
 * Deploy separately from GitHub Pages. Secrets must never enter this repository.
 */
// Only production origins, never preview domains or wildcard subdomains.
const ORIGINS = new Set(['https://hkust-elpa.github.io', 'https://hkust-elpa.vercel.app']);
const OWNER = 'HKUST-ELPA';
const REPO = 'HKUST-ELPA-Site-Source';
const MAX_BODY_BYTES = 24576;

function json(payload, status = 200, origin = false) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(origin ? {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } : {})
    }
  });
}
function invalid(message, status = 400, origin = false) {
  return json({ok:false,message}, status, origin);
}
async function readLimitedJSON(request) {
  if (!request.body) throw new Error('missing body');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error('payload too large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let i = 0;
  for (const chunk of chunks) {bytes.set(chunk,i);i+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
function validText(value, min, max) {
  return typeof value === 'string' &&
    value.trim().length >= min && value.trim().length <= max &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
}
function encodeBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let ascii = '';
  for (const byte of bytes) ascii += String.fromCharCode(byte);
  return btoa(ascii).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
/* Sign a short-lived GitHub App JWT in Workers WebCrypto, then exchange it for an
 * installation token restricted to the Source repository and Issues:write.
 * The private key never leaves this Worker. No personal-token fallback.
 */
function appBase64Url(bytes){
  let text='';
  for(const byte of bytes)text+=String.fromCharCode(byte);
  return btoa(text).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
}
async function appSigningKey(env){
  if(!env.GITHUB_APP_PRIVATE_KEY)throw new Error('GitHub App private key missing');
  const pem=env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g,'\n');
  const encoded=pem.match(/-----BEGIN (?:RSA )?PRIVATE KEY-----([\s\S]+?)-----END (?:RSA )?PRIVATE KEY-----/);
  if(!encoded)throw new Error('Invalid GitHub App private key');
  const raw=Uint8Array.from(atob(encoded[1].replace(/\s/g,'')),ch=>ch.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',raw,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  return key;
}
async function appInstallationToken(env){
  if(!/^\d+$/.test(env.GITHUB_APP_ID||'') ||
     !/^\d+$/.test(env.GITHUB_APP_INSTALLATION_ID||''))
    throw new Error('GitHub App is not configured');
  const key=await appSigningKey(env);
  const now=Math.floor(Date.now()/1000);
  const header=appBase64Url(new TextEncoder().encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=appBase64Url(new TextEncoder().encode(JSON.stringify({
    iat:now-60,exp:now+480,iss:env.GITHUB_APP_ID
  })));
  const signingInput=header+'.'+payload;
  const signature=appBase64Url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(signingInput))));
  const response=await fetch('https://api.github.com/app/installations/'+env.GITHUB_APP_INSTALLATION_ID+'/access_tokens',{
    method:'POST',headers:{
      'Authorization':'Bearer '+signingInput+'.'+signature,
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'HKUST-ELPA-Submission'
    },
    body:JSON.stringify({repositories:[REPO],permissions:{issues:'write'}}),
    signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)throw new Error('GitHub App token exchange failed: '+response.status);
  const result=await response.json();
  if(typeof result.token!=='string'||!result.token)throw new Error('GitHub App token missing');
  return result.token;
}

/* Canonical ELPA v3: exactly one campus, track, question and optional advice. */
const ADVICE_TAGS=new Set(['exam-process','speaking-strategy','time-management',
  'stress-management','english-expression','ai-learning','exam-experience']);
const CAMPUSES=new Set(['gz','hk']);
const TRACKS=new Set(['regular','fast-track']);
const STAGES=new Set(['start','mid','end']);
const ADVICE_PHASES=new Set(['before','during','after']);
const VALID_ID=/^(GZ|HK)-(R|F)-\d{4}$/;
function validAdvice(advice){
  return advice&&ADVICE_PHASES.has(advice.phase)&&
    Array.isArray(advice.tags)&&advice.tags.length>=1&&advice.tags.length<=4&&
    new Set(advice.tags).size===advice.tags.length&&advice.tags.every(t=>ADVICE_TAGS.has(t))&&
    validText(advice.title,4,120)&&validText(advice.body,20,6000);
}
function validSubmission(body){
  return body&&body.version===3&&body.kind==='question'&&
    CAMPUSES.has(body.campus)&&TRACKS.has(body.track)&&
    typeof body.term==='string'&&/^20\d{2} (Spring|Fall)$/.test(body.term)&&
    STAGES.has(body.examStage)&&body.main&&
    validText(body.main.en,8,1000)&&validText(body.main.cn,2,1000)&&
    Array.isArray(body.subs)&&body.subs.length<=20&&
    body.subs.every(s=>s&&validText(s.en,1,400)&&validText(s.cn,0,400))&&
    (body.alternatives===undefined||(Array.isArray(body.alternatives)&&body.alternatives.length<=1&&
      body.alternatives.every(s=>s&&validText(s.en,8,1000)&&validText(s.cn,0,1000))))&&
    ['firsthand','secondhand'].includes(body.source)&&
    (body.linkedQuestionId===undefined||(VALID_ID.test(body.linkedQuestionId)&&
      body.linkedQuestionId.startsWith(body.campus.toUpperCase()+'-'+(body.track==='regular'?'R':'F')+'-')&&
      ['encounter','supplement'].includes(body.intent)))&&
    (body.intent===undefined||body.linkedQuestionId!==undefined)&&
    (body.intent!=='supplement'||body.subs.length>0||(body.alternatives&&body.alternatives.length>0))&&
    (body.advice===undefined||validAdvice(body.advice));
}
function cleanSubmission(body){
  return {version:3,kind:'question',term:body.term,examStage:body.examStage,
    campus:body.campus,track:body.track,
    main:{en:body.main.en.trim(),cn:body.main.cn.trim()},
    subs:body.subs.map(s=>({en:s.en.trim(),cn:s.cn.trim()})),source:body.source,
    ...(body.alternatives?.length?{alternatives:body.alternatives.map(s=>({en:s.en.trim(),cn:s.cn.trim()}))}:{}),
    ...(body.linkedQuestionId?{linkedQuestionId:body.linkedQuestionId,intent:body.intent}:{}),
    ...(body.advice?{advice:{phase:body.advice.phase,tags:[...body.advice.tags],
      title:body.advice.title.trim(),body:body.advice.body.trim()}}:{})
  };
}
const mdQuote=t=>String(t).split('\n').map(s=>'> '+s.replace(/</g,'&lt;')).join('\n');
async function formatSubmission(record,env){
  const lines=[
    '**考试校区：** '+(record.campus==='gz'?'广州校区':'香港校区'),
    '**考试类型：** '+(record.track==='regular'?'常规 ELPA':'ELPA Fast Track'),
    '**考试学期：** '+record.term,
    '**考试阶段：** '+record.examStage,
    '**来源：** '+(record.source==='firsthand'?'本人亲历':'同学转述'),
    ...(record.linkedQuestionId?[
      '**已关联题目：** '+record.linkedQuestionId,
      '**反馈类型：** '+(record.intent==='supplement'?'补充题目内容（不计次数）':'新增考试经历')
    ]:[]),
    '', '### 主问题 / English',mdQuote(record.main.en),
    '', '### 主问题 / 中文',mdQuote(record.main.cn),'',
    '### 提示小问'
  ];
  if(record.alternatives?.length){
    lines.splice(lines.length-1,0,'### 相似问法');
    for(const alternative of record.alternatives)lines.splice(lines.length-1,0,'',mdQuote(alternative.en),mdQuote(alternative.cn));
  }
  for(const [i,sub] of record.subs.entries())lines.push('','**小问 '+(i+1)+' / English**',mdQuote(sub.en),
    '**小问 '+(i+1)+' / 中文**',mdQuote(sub.cn));
  if(!record.subs.length)lines.push('','未分享');
  if(record.advice)lines.push('','### 备考经验 / Preparation Advice',
    '**阶段：** '+record.advice.phase,'**主题标签：** '+record.advice.tags.join(', '),
    '**标题：** '+record.advice.title,'',mdQuote(record.advice.body));
  if(!record.advice)lines.push('','### 备考经验 / Preparation Advice','','未分享');
  lines.push('','---','','**已分配至：** @HKUST-ELPA/'+record.campus+'-'+record.track+'-reviewers');
  const encoded=encodeBase64Url(JSON.stringify(record));
  const key=await appSigningKey(env);
  const signature=appBase64Url(new Uint8Array(await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',key,new TextEncoder().encode('HKUST-ELPA:submission:v3:'+encoded))));
  lines.push('','<!-- elpa-submission-v3:'+encoded+':'+signature+' -->');
  return {title:'[ELPA 投稿] ['+record.campus.toUpperCase()+'/'+(record.track==='regular'?'R':'F')+'] ['+record.term+'/'+record.examStage+'] '+
    record.main.en.replace(/\s+/g,' ').slice(0,65),body:lines.join('\n')};
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const originOK = ORIGINS.has(origin);
    if (request.method === 'GET' && url.pathname === '/health')
      return json({ok:true,service:'elpa-submission'});
    if (url.pathname !== '/submit') return json({ok:false,message:'Not found'},404);
    if (!originOK) return json({ok:false,message:'Forbidden'},403);
    if (request.method === 'OPTIONS')
      return new Response(null,{status:204,headers:{
        'Access-Control-Allow-Origin':origin,'Vary':'Origin',
        'Access-Control-Allow-Methods':'POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'
      }});
    // All subsequent errors inherit the verified request origin, not a wildcard.
    const reject=(message,status=400)=>invalid(message,status,origin);
    if (request.method !== 'POST') return reject('Method not allowed',405);
    if (env.SUBMISSIONS_DISABLED !== 'false') return reject('投稿暂时关闭，请稍后再试。',503);
    if(env.SUBMISSION_MODE!=='public')
      return reject('投稿服务尚未开放。',503);
    if (!env.GITHUB_APP_ID || !env.GITHUB_APP_INSTALLATION_ID || !env.GITHUB_APP_PRIVATE_KEY || !env.TURNSTILE_SECRET || !env.SUBMISSION_LIMITER)
      return reject('投稿服务尚未配置完成。',503);
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || ''))
      return reject('仅支持 JSON 格式。',415);
    const length = Number(request.headers.get('Content-Length')||0);
    if (length > MAX_BODY_BYTES) return reject('内容过长。',413);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      const limited = await env.SUBMISSION_LIMITER.limit({key:ip});
      if (!limited.success) return reject('提交过于频繁，请稍后再试。',429);
    } catch {
      return reject('投稿服务暂时繁忙。',503); // fail closed
    }
    let body;
    try {body = await readLimitedJSON(request);}
    catch {return reject('投稿数据无效或内容过长。',400);}
    if(!validSubmission(body))return reject('请检查校区、考试类型、题目和内容长度。',400);
    const turnstileToken=body.turnstileToken;
    if(!validText(turnstileToken,1,2048))return reject('人机验证无效。',400);
    // Never send unverified submissions to GitHub.
    let verified;
    try {
      const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:turnstileToken,remoteip:ip}),
        signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('Turnstile unavailable');
      verified=await response.json();
    }catch{
      return reject('人机验证暂不可用，请稍后重试。',503);
    }
    if (!verified || verified.success!==true || verified.hostname!==new URL(origin).hostname || verified.action!=='elpa_submit')
      return reject('人机验证失败或已过期，请重试。',403);
    let github;
    try {
      const {title,body:issueBody}=await formatSubmission(cleanSubmission(body),env);
      const installationToken=await appInstallationToken(env);
      const response=await fetch('https://api.github.com/repos/'+OWNER+'/'+REPO+'/issues',{
        method:'POST',
        headers:{
          'Authorization':'Bearer '+installationToken,
          'Accept':'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':'HKUST-ELPA-Submission'
        },
        body:JSON.stringify({title,body:issueBody,labels:['submission:pending']}),
        signal:AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('GitHub issue create failed: '+response.status);
      github=await response.json();
    }catch(e){
      console.error('Submission delivery failed',String(e));
      return reject('投稿暂时未能保存，请稍后重试。',503);
    }
    return json({ok:true,issueUrl:github.html_url},201,origin);
  }
};
