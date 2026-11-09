/* Derive an ELPA review domain from the structured Issue record, never labels or title. */
'use strict';
const fs=require('node:fs');
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||process.argv[2],'utf8'));
const issue=event.issue||{};
const payload=require('./verify-submission.cjs').decode(issue);
if(payload.version!==3||payload.kind!=='question'||!['gz','hk'].includes(payload.campus)||
   !['regular','fast-track'].includes(payload.track))
  throw Error('Invalid routing domain');
const team=payload.campus+'-'+payload.track+'-reviewers';
const result={campus:payload.campus,track:payload.track,team};
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,
  Object.entries(result).map(([k,v])=>k+'='+v).join('\n')+'\n');
console.log('Review domain:',payload.campus,payload.track,'Team:',team);
