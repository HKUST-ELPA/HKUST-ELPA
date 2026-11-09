'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,generateKeyPairSync,createPublicKey,verify}=require('node:crypto');
const pem=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({format:'pem',type:'pkcs8'});
const source=fs.readFileSync(path.resolve(__dirname,'../worker/src/index.js'),'utf8');
const question=(campus='gz',track='regular')=>({
 version:3,kind:'question',campus,track,term:'2027 Fall',examStage:'mid',
 main:{en:'How can students prepare a research presentation efficiently?',cn:'学生如何高效准备研究报告？'},
 subs:[],source:'firsthand',turnstileToken:'valid-mock-token'
});
function harness({verify={success:true,hostname:'hkust-elpa.github.io',action:'elpa_submit'},limit={success:true},tokenOK=true,issueOK=true}={}){
 const calls=[];
 const sandbox={module:{exports:{}},Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,Uint8Array,
  AbortSignal,console,crypto:webcrypto,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),
  atob:s=>Buffer.from(s,'base64').toString('binary'),
  fetch:async(url,init)=>{
   calls.push({url:String(url),init});
   if(String(url).includes('/siteverify'))return Response.json(verify);
   if(String(url).includes('/app/installations/98765/access_tokens'))
     return tokenOK?Response.json({token:'APP-INSTALLATION-TOKEN'}):Response.json({message:'Forbidden'},{status:403});
   if(String(url).endsWith('/repos/HKUST-ELPA/HKUST-ELPA-Site-Source/issues'))
     return issueOK?Response.json({html_url:'https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/issues/123'},{status:201}):Response.json({message:'Forbidden'},{status:403});
   throw Error('Unexpected request '+url);
  }};
 vm.runInNewContext(source.replace('export default {','module.exports = {'),sandbox);
 const env={SUBMISSION_MODE:'public',SUBMISSIONS_DISABLED:'false',
  SUBMISSION_LIMITER:{limit:async()=>limit},TURNSTILE_SECRET:'mock-secret',
  GITHUB_APP_ID:'12345',GITHUB_APP_INSTALLATION_ID:'98765',GITHUB_APP_PRIVATE_KEY:pem};
 const request=(data=question(),origin='https://hkust-elpa.github.io')=>new Request('https://example.workers.dev/submit',{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(data)});
 return {calls,env,request,handler:sandbox.module.exports};
}
test('v3 question with advice uses scoped App token and one issue',async()=>{
 const h=harness(),body={...question('hk','fast-track'),advice:{phase:'before',tags:['exam-process'],
  title:'考前准备',body:'我会准备几个研究项目的例子，并按照考试流程进行模拟练习。'}};
 const r=await h.handler.fetch(h.request(body),h.env);
 assert.equal(r.status,201,await r.text());assert.equal(h.calls.length,3);
 const exchange=h.calls[1];
 assert.deepEqual(JSON.parse(exchange.init.body),{repositories:['HKUST-ELPA-Site-Source'],permissions:{issues:'write'}});
 assert.match(exchange.init.headers.Authorization,/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
 const issue=JSON.parse(h.calls[2].init.body);
 assert.equal(h.calls[2].init.headers.Authorization,'Bearer APP-INSTALLATION-TOKEN');
 assert.match(issue.body,/考试校区：\*\* 香港校区/);
 assert.match(issue.body,/备考经验/);
 const embedded=JSON.parse(Buffer.from(issue.body.match(/elpa-submission-v3:([\w-]+)/)[1],'base64url'));
 assert.equal(embedded.campus,'hk');assert.equal(embedded.track,'fast-track');
 assert.equal(embedded.version,3);assert.equal(Object.hasOwn(embedded,'turnstileToken'),false);
 const envelope=issue.body.match(/elpa-submission-v3:([\\w-]+):([\\w-]+)/);
 assert.ok(envelope,'Signed payload is present');
 assert.equal(verify('sha256',Buffer.from('HKUST-ELPA:submission:v3:'+envelope[1]),
   createPublicKey(pem),Buffer.from(envelope[2],'base64url')),true);
});
test('four campus domains produce canonical v3 markers',async()=>{
 for(const campus of ['gz','hk'])for(const track of ['regular','fast-track']){
  const h=harness({verify:{success:true,hostname:'hkust-elpa.github.io',action:'elpa_submit'}});
  const r=await h.handler.fetch(h.request(question(campus,track)),h.env);
  assert.equal(r.status,201,await r.text());
  const issue=JSON.parse(h.calls[2].init.body);
  assert.match(issue.title,new RegExp('\\['+campus.toUpperCase()+'\\/'+(track==='regular'?'R':'F')+'\\]'));
 }
});
test('missing campus, obsolete protocol, and foreign ID are rejected before external calls',async()=>{
 for(const bad of [{...question(),campus:undefined},{...question(),campus:'nansha'},
   {...question(),version:2},{...question(),linkedQuestionId:'HK-R-0001',intent:'encounter'},
   {...question(),main:{en:'Short',cn:'短'}}]){
  const h=harness();const r=await h.handler.fetch(h.request(bad),h.env);
  assert.equal(r.status,400);assert.equal(h.calls.length,0);
 }
});
test('Turnstile verification and exact calling origin remain mandatory',async()=>{
 const h=harness({verify:{success:true,hostname:'bad.example',action:'elpa_submit'}});
 const r=await h.handler.fetch(h.request(),h.env);
 assert.equal(r.status,403);assert.equal(h.calls.length,1);
 const wrong=harness();const bad=await wrong.handler.fetch(wrong.request(question(),'https://bad.example'),wrong.env);
 assert.equal(bad.status,403);assert.equal(wrong.calls.length,0);
});
test('rate limit and disabled mode reject before token issuance',async()=>{
 const h=harness({limit:{success:false}});
 assert.equal((await h.handler.fetch(h.request(),h.env)).status,429);
 assert.equal(h.calls.length,0);
 const d=harness();d.env.SUBMISSIONS_DISABLED='true';
 assert.equal((await d.handler.fetch(d.request(),d.env)).status,503);
 assert.equal(d.calls.length,0);
});
test('missing App credential fails closed without personal token fallback',async()=>{
 const h=harness();delete h.env.GITHUB_APP_PRIVATE_KEY;h.env.GITHUB_TOKEN='OLD-PAT';
 assert.equal((await h.handler.fetch(h.request(),h.env)).status,503);
 assert.equal(h.calls.length,0);
});
test('GitHub App exchange failure or Issue creation failure never reports success',async()=>{
 for(const options of [{tokenOK:false},{issueOK:false}]){
  const h=harness(options);const r=await h.handler.fetch(h.request(),h.env);
  assert.equal(r.status,503);
 }
});
test('CORS preflight permits only exact production origins',async()=>{
 const h=harness();
 for(const origin of ['https://hkust-elpa.github.io','https://hkust-elpa.vercel.app']){
  const r=await h.handler.fetch(new Request('https://example.workers.dev/submit',{method:'OPTIONS',headers:{Origin:origin}}),h.env);
  assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
 }
 const r=await h.handler.fetch(new Request('https://example.workers.dev/submit',{method:'OPTIONS',headers:{Origin:'https://preview.vercel.app'}}),h.env);
 assert.equal(r.status,403);
});
