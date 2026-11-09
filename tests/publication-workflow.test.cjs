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
 assert.match(workflow,/@HKUST-ELPA\/\$\{REVIEW_TEAM\}/);
 assert.match(routing,/verify-submission\.cjs/);
 assert.match(fs.readFileSync(path.join(root,'scripts/verify-submission.cjs'),'utf8'),/elpa-submission-v3/);
 assert.doesNotMatch(routing,/issue\.labels/);
});
test('only live Team membership or organization owner can approve',()=>{
 assert.match(workflow,/permission-members: read/);
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