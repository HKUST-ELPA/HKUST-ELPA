'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');

test('Source builds once and publishes only generated output to Published with a scoped App token',()=>{
  assert.match(workflow,/node scripts\/validate-site\.cjs/);
  assert.match(workflow,/node --test/);
  assert.match(workflow,/python -m unittest discover/);
  assert.match(workflow,/python preview\.py --build-only/);
  assert.match(workflow,/actions\/create-github-app-token@v2/);
  assert.match(workflow,/repositories: HKUST-ELPA\.github\.io/);
  assert.match(workflow,/permission-contents: write/);
  assert.match(workflow,/repository: HKUST-ELPA\/HKUST-ELPA\.github\.io/);
  assert.match(workflow,/rsync -a --delete --exclude='\.git\/' _site\/ published\//);
  assert.match(workflow,/Path\('_site\/build-info\.json'\)/);
});

test('reviewed Issue imports and direct Source pushes both trigger a trusted-main build',()=>{
  assert.match(workflow,/push:\n    branches: \[main\]/);
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/workflow_run:\n    workflows: \["Publish completed ELPA submissions"\]/);
  assert.match(workflow,/workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/workflow_run\.event == 'issues'/);
  assert.match(workflow,/github\.sha != github\.event\.workflow_run\.head_sha/);
  assert.match(workflow,/ref: main/);
  assert.doesNotMatch(workflow,/ref:\s*\$\{\{.*head_sha/);
});

test('full browser regression remains on PRs',()=>{
  const checks=fs.readFileSync(path.join(root,'.github/workflows/site-checks.yml'),'utf8');
  assert.ok(checks.includes('pull_request:'));
  assert.ok(!checks.includes('  push:'));
  assert.ok(checks.includes('python tests/browser_smoke.py'));
});
