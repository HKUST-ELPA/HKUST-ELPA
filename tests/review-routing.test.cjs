'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {generateKeyPairSync,sign}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'});
function run(record,options={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-routing-'));
 try{
  const encoded=Buffer.from(JSON.stringify(record)).toString('base64url');
  const signature=sign('sha256',Buffer.from('HKUST-ELPA:submission:v3:'+encoded),key).toString('base64url');
  const marker='<!-- elpa-submission-v3:'+encoded+':'+(options.signature||signature)+' -->';
  const eventFile=path.join(dir,'event.json'),outputFile=path.join(dir,'output');
  const body=options.body??marker;
  fs.writeFileSync(eventFile,JSON.stringify({issue:{number:99,title:'[ELPA 投稿]',body}}));
  const result=spawnSync(process.execPath,[path.join(root,'scripts/review-routing.cjs')],{
    env:{...process.env,GITHUB_EVENT_PATH:eventFile,GITHUB_OUTPUT:outputFile,ELPA_APP_PRIVATE_KEY:key},encoding:'utf8'});
  return {...result,output:fs.existsSync(outputFile)?fs.readFileSync(outputFile,'utf8'):''};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const question=(campus,track)=>({version:3,kind:'question',campus,track,term:'2027 Fall',examStage:'start',
 main:{en:'How would you organize research?',cn:'如何组织研究？'},subs:[],source:'firsthand'});
test('signed v3 payload routes exactly to one of four teams',()=>{
 for(const campus of ['gz','hk'])for(const track of ['regular','fast-track']){
  const result=run(question(campus,track));
  assert.equal(result.status,0,result.stderr);
  assert.match(result.output,new RegExp('team='+campus+'-'+track+'-reviewers'));
  assert.match(result.output,new RegExp('campus='+campus));
  assert.match(result.output,new RegExp('track='+track));
 }
});
test('cross-team reassignment cannot be achieved by editing encoded payload',()=>{
 const signed=run(question('gz','regular'));
 assert.equal(signed.status,0,signed.stderr);
 const foreign=Buffer.from(JSON.stringify(question('hk','fast-track'))).toString('base64url');
 const forged='<!-- elpa-submission-v3:'+foreign+':'+Buffer.alloc(256).toString('base64url')+' -->';
 const outcome=run(question('gz','regular'),{body:forged});
 assert.notEqual(outcome.status,0);
 assert.doesNotMatch(outcome.output,/team=/);
});
test('edited or duplicated signed records fail validation before routing',()=>{
 for(const body of [
  '<!-- elpa-submission-v3:garbage:garbage -->',
  '<!-- elpa-submission-v2:garbage -->',
  '<!-- elpa-submission-v3:tampered:signature -->',
  ''
 ]){
  const result=run(question('gz','regular'),{body});
  assert.notEqual(result.status,0);
 }
});
test('campus is mandatory; old campus labels are not accepted',()=>{
 for(const campus of ['nansha','clear-water-bay',null]){
  const result=run(question(campus,'regular'));assert.notEqual(result.status,0);
 }
});
