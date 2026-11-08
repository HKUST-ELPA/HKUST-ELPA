'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Vercel deploys the Published output without rebuilding source',()=>{
  const root=path.resolve(__dirname,'..');
  assert.equal(fs.existsSync(path.join(root,'vercel.json')),false);
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/deploy-pages.yml'),'utf8');
  assert.match(workflow,/python preview\.py --build-only/);
  assert.match(workflow,/Path\('_site\/vercel\.json'\)/);
  assert.match(workflow,/repositories: HKUST-ELPA\.github\.io/);
  assert.match(workflow,/rsync -a --delete --exclude='\.git\/' _site\/ published\//);
});
