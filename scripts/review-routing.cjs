/* Derive an ELPA review domain from the structured Issue record, never labels or title. */
'use strict';
const fs=require('node:fs');
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||process.argv[2],'utf8'));
const issue=event.issue||{};
const matches=[...(issue.body||'').matchAll(/^<!-- elpa-submission-v3:([A-Za-z0-9_-]+) -->\s*$/gm)];
if(matches.length!==1)throw Error('Expected exactly one v3 submission marker');
const payload=JSON.parse(Buffer.from(matches[0][1],'base64url').toString('utf8'));
if(payload.version!==3||payload.kind!=='question'||!['gz','hk'].includes(payload.campus)||
   !['regular','fast-track'].includes(payload.track))
  throw Error('Invalid routing domain');
const team=payload.campus+'-'+payload.track+'-reviewers';
const result={campus:payload.campus,track:payload.track,team};
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,
  Object.entries(result).map(([k,v])=>k+'='+v).join('\n')+'\n');
console.log('Review domain:',payload.campus,payload.track,'Team:',team);
