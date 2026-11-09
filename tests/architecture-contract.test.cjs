'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('all questions have canonical four-domain stable IDs',()=>{
 const data=JSON.parse(read('question-bank/questions.json'));
 assert.deepEqual(Object.keys(data.banks),['GZ-R','GZ-F','HK-R','HK-F']);
 const ids=new Set();
 for(const [group,bank] of Object.entries(data.banks))for(const question of bank.items){
  const id=group+'-'+String(question.num).padStart(4,'0');
  assert.match(id,/^(GZ|HK)-(R|F)-\d{4}$/);
  assert.ok(!ids.has(id));ids.add(id);
 }
 assert.ok(data.historicalQuestionIds.every(id=>ids.has(id)));
 assert.equal(Object.hasOwn(data,'legacyQuestionAliases'),false);
});
test('submission and local practice records share new IDs without legacy protocols',()=>{
 const storage=read('assets/js/practice-storage.js');
 const submit=read('assets/js/submit.js');
 const worker=read('worker/src/index.js');
 assert.match(storage,/elpa-data-snapshot-v3/);
 assert.match(submit,/elpa-submission-draft-v3/);
 assert.match(submit,/version:3/);
 assert.match(worker,/elpa-submission-v3:/);
 assert.doesNotMatch(worker,/elpa-submission-v1:|elpa-submission-v2:|GITHUB_TOKEN/);
});
test('Team authorization, App publication and separate practice module remain intact',()=>{
 for(const page of ['index','guide','practice','submit','sources','community'])
  assert.ok(fs.existsSync(path.join(root,'_site',page+'.html')));
 const workflow=read('.github/workflows/publish-completed-submission.yml');
 assert.match(workflow,/permission-members: read/);
 assert.match(workflow,/steps\.authorization\.outputs\.authorized == 'true'/);
 assert.match(workflow,/scripts\/review-routing\.cjs/);
 const html=read('practice.html');
 assert.ok(html.indexOf('practice.js')<html.indexOf('practice-session.js'));
 assert.match(read('assets/js/practice-session.js'),/function tickTimer\(/);
});
test('synthetic test-only questions are absent from canonical public data',()=>{
 assert.doesNotMatch(read('question-bank/questions.json'),/TEST ONLY - HKUST-ELPA/);
});