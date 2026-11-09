'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/publish-completed-submission.yml'),'utf8');
const routing=fs.readFileSync(path.join(root,'scripts/review-routing.cjs'),'utf8');
test('new and closed Issues route to matching Team using canonical structured payload',()=>{
 assert.match(workflow,/types: \[opened, closed, reopened\]/);
 assert.match(workflow,/node scripts\/review-routing\.cjs/);
 for(const group of ['campus:gz','campus:hk','track:regular','track:fast-track'])
  assert.ok(workflow.includes(group));
 assert.match(workflow,/node scripts\/render-review-notification\.cjs/);
 assert.match(routing,/verify-submission\.cjs/);
 assert.match(fs.readFileSync(path.join(root,'scripts/verify-submission.cjs'),'utf8'),/elpa-submission-v3/);
 assert.doesNotMatch(routing,/issue\.labels/);
});
test('only live Team membership or organization owner can approve',()=>{
 assert.match(workflow,/permission-members: read/);
 assert.match(workflow,/Confirm issue was created by the submission App/);
 assert.match(workflow,/ISSUE_AUTHOR/);
 assert.match(workflow,/\/orgs\/HKUST-ELPA\/memberships/);
 assert.match(workflow,/\/orgs\/HKUST-ELPA\/teams/);
 assert.match(workflow,/\.role/);
 assert.match(workflow,/\.state/);
 assert.match(workflow,/steps\.authorization\.outputs\.authorized == 'true'/);
 assert.match(workflow,/gh issue reopen/);
 assert.doesNotMatch(workflow,/github\.event\.sender\.login == 'FuTseYi'/);
});
test('serialized App-token importer validates and pushes Source data without force',()=>{
 assert.match(workflow,/group: elpa-question-bank-publication\n  queue: max/);
 assert.match(workflow,/permission-contents: write/);
 assert.match(workflow,/permission-issues: write/);
 assert.match(workflow,/node scripts\/import-completed-submission\.cjs/);
 assert.match(workflow,/node scripts\/check-submission-diff\.cjs/);
 assert.match(workflow,/python preview\.py --build-only/);
 assert.match(workflow,/git push origin HEAD:main/);
 assert.doesNotMatch(workflow,/git push[^\n]*--force/);
});
test('Published remains separate and GitHub App preserves build automation',()=>{
 const deploy=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');
 assert.match(deploy,/Publish completed ELPA submissions/);
 assert.match(deploy,/actions\/create-github-app-token@v2/);
 assert.match(deploy,/HKUST-ELPA.github.io/);
 assert.match(deploy,/git push origin HEAD:main/);
});
test('structured notifications use verified v3 domain, include reviewer instructions and avoid duplicate emails',()=>{
 const {render}=require('../scripts/render-review-notification.cjs');
 const payload={version:3,kind:'question',campus:'gz',track:'regular',term:'2026 Fall',examStage:'start',source:'firsthand',main:{en:'What is your research?',cn:'你的研究是什么？'},subs:[{en:'Follow-up',cn:'追问'}],advice:{title:'Preparation tips',body:'Practice daily'}};
 const msg=render(payload,{team:'gz-regular-reviewers',issueUrl:'https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/issues/93'});
 for(const part of ['@HKUST-ELPA/gz-regular-reviewers','广州校区','常规 ELPA','2026 Fall','What is your research?','你的研究是什么？','Follow-up','Preparation tips','Practice daily','Close as completed','Close as not planned','elpa-review-notification-v1'])
   assert.ok(msg.includes(part),part);
 assert.match(workflow,/gh issue comment "\\$ISSUE_NUMBER" --body-file/);
 assert.match(workflow,/grep -Fq '<!-- elpa-review-notification-v1 -->'/);
 assert.match(workflow,/ELPA_APP_PRIVATE_KEY/);
 assert.doesNotMatch(msg,/Review queue:/);
 const malicious=render({...payload,main:{en:'@all <script> bad | table',cn:'ok'}},{team:'gz-regular-reviewers',issueUrl:'https://github.com/example/test/issues/1'});
 assert.ok(malicious.includes('＠all &lt;script&gt;'));
 assert.ok(!malicious.includes('@all <script>'));
});
