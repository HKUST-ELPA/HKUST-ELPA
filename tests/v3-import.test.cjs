'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const importer=path.join(root,'scripts/import-completed-submission.cjs');
function fixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'elpa-v3-'));
 fs.mkdirSync(path.join(dir,'question-bank'));
 for(const name of ['questions.json','appearances.json','advice.json','taxonomy.json'])
   fs.copyFileSync(path.join(root,'question-bank',name),path.join(dir,'question-bank',name));
 for(const name of ['community-submissions.md','community-advice.md'])
   fs.writeFileSync(path.join(dir,'question-bank',name),'# Reviewed\n');
 const read=name=>JSON.parse(fs.readFileSync(path.join(dir,'question-bank',name),'utf8'));
 const run=(data,number=301,title='[ELPA 投稿] [GZ/R] Reviewed')=>{
   const marker=Buffer.from(JSON.stringify(data)).toString('base64url');
   const issue={number,title,body:'<!-- elpa-submission-v3:'+marker+' -->'};
   const file=path.join(dir,'event.json'),output=path.join(dir,'output.txt');
   fs.writeFileSync(file,JSON.stringify({issue}));fs.writeFileSync(output,'');
   const result=spawnSync(process.execPath,[importer],{cwd:dir,encoding:'utf8',
     env:{...process.env,GITHUB_EVENT_PATH:file,GITHUB_OUTPUT:output}});
   return {...result,outputs:fs.readFileSync(output,'utf8')};
 };
 return {read,run,close:()=>fs.rmSync(dir,{recursive:true,force:true}),
   text:name=>fs.readFileSync(path.join(dir,'question-bank',name),'utf8')};
}
const question=(campus='gz',track='regular',en='How would you organize a research project effectively?')=>({
 version:3,kind:'question',campus,track,term:'2027 Fall',examStage:'start',
 main:{en,cn:'如何有效组织一个研究项目？'},subs:[],source:'firsthand'
});
const advice=()=>({phase:'before',tags:['exam-process'],title:'考前准备',
 body:'我会提前准备自己的研究项目简介，按照考试形式反复练习表达。'});
test('new domain question has sequential domain ID independent of Issue number',()=>{
 const f=fixture();try{
  const before=f.read('questions.json').banks['GZ-R'].items.length;
  const r=f.run(question(),301);
  assert.equal(r.status,0,r.stderr);
  assert.match(r.outputs,/recorded=true/);
  const bank=f.read('questions.json').banks['GZ-R'].items;
  assert.equal(bank.length,before+1);
  const id='GZ-R-'+String(bank.at(-1).num).padStart(4,'0');
  assert.notEqual(id,'GZ-R-0301');
  assert.equal(f.read('appearances.json')[id][0].issueNumber,301);
  assert.match(f.text('community-submissions.md'),/广州校区/);
 }finally{f.close();}
});
test('Hong Kong Fast Track question and its preparation advice stay in one domain',()=>{
 const f=fixture();try{
  const r=f.run({...question('hk','fast-track'),advice:advice()},302);
  assert.equal(r.status,0,r.stderr);
  assert.equal(f.read('questions.json').banks['HK-F'].items[0].num,1);
  const a=f.read('advice.json').find(a=>a.issueNumber===302);
  assert.equal(a.id,'HK-F-E-0001');
  assert.equal(a.campus,'hk');assert.equal(a.track,'fast-track');
  assert.equal(a.questionId,'HK-F-0001');
  assert.match(f.text('community-advice.md'),/香港校区/);
 }finally{f.close();}
});
test('same issue is idempotent and exact question shares canonical ID',()=>{
 const f=fixture();try{
  assert.equal(f.run(question(),303).status,0);
  const first=f.read('questions.json').banks['GZ-R'].items.length;
  const original=f.text('appearances.json');
  assert.equal(f.run(question(),303).status,0);
  assert.equal(f.text('appearances.json'),original);
  assert.equal(f.run(question(),304).status,0);
  assert.equal(f.read('questions.json').banks['GZ-R'].items.length,first);
  const matching=Object.entries(f.read('appearances.json')).find(([k,v])=>v.some(x=>x.issueNumber===303));
  assert.deepEqual(matching[1].map(x=>x.issueNumber),[303,304]);
 }finally{f.close();}
});
test('cross-domain linked IDs, wrong wording, and malformed data do not write records',()=>{
 const f=fixture();try{
  const before=f.text('questions.json');
  for(const data of [
   {...question('gz','regular'),linkedQuestionId:'HK-R-0001',intent:'encounter'},
   {...question(),linkedQuestionId:'GZ-R-0001',intent:'encounter'},
   {...question(),campus:'nansha'},
   {...question(),campus:undefined},
   {...question(),version:2},
   {...question(),main:{en:'a',cn:'b'}},
   {...question(),intent:'supplement'}
  ])assert.notEqual(f.run(data,305).status,0);
  assert.equal(f.text('questions.json'),before);
 }finally{f.close();}
});
test('synthetic marked submissions never enter question or advice data',()=>{
 const f=fixture();try{
  const before=f.text('questions.json');
  assert.notEqual(f.run({...question(),advice:advice()},306,'[ELPA 投稿] TEST ONLY').status,0);
  assert.equal(f.text('questions.json'),before);
 }finally{f.close();}
});
test('all four domains exist in canonical corpus',()=>{
 const content=JSON.parse(fs.readFileSync(path.join(root,'question-bank/questions.json'),'utf8'));
 assert.deepEqual(Object.keys(content.banks),['GZ-R','GZ-F','HK-R','HK-F']);
 assert.equal(content.banks['GZ-R'].items.length,37);
 assert.equal(content.banks['GZ-F'].items.length,12);
});
