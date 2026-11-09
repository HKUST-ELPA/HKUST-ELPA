/* Import a reviewed v3 ELPA issue. No historic submission protocol is supported. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(process.cwd(),'question-bank');
const loc=name=>path.join(root,name);
const read=name=>JSON.parse(fs.readFileSync(loc(name),'utf8'));
const write=(name,data)=>fs.writeFileSync(loc(name),JSON.stringify(data,null,2)+'\n');
const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||process.argv[2],'utf8'));
const issue=event.issue||{};
const number=issue.number;
const valid=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu,'');
const quote=s=>String(s).split(/\r?\n/).map(l=>'> '+l.replace(/</g,'&lt;')).join('\n');
const output=(status,recorded)=>{console.log('Import status:',status);if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'result='+status+'\nrecorded='+recorded+'\n')};
if(!Number.isSafeInteger(number)||number<1||!/^\[ELPA 投稿\]/.test(issue.title||''))throw Error('Not an ELPA submission');
if(/\bTEST ONLY\b/i.test(issue.title))throw Error('Synthetic Issue may never enter reviewed data');
const matches=[...(issue.body||'').matchAll(/^<!-- elpa-submission-v3:([A-Za-z0-9_-]+) -->\s*$/gm)];
if(matches.length!==1)throw Error('Exactly one v3 payload marker is required');
const data=JSON.parse(Buffer.from(matches[0][1],'base64url').toString('utf8'));
const taxonomy=read('taxonomy.json');
const allowed=(group,key)=>typeof key==='string'&&Object.hasOwn(taxonomy[group],key);
const vAdvice=a=>!a||(allowed('advicePhases',a.phase)&&Array.isArray(a.tags)&&a.tags.length>=1&&a.tags.length<=4&&new Set(a.tags).size===a.tags.length&&a.tags.every(t=>allowed('adviceTags',t))&&valid(a.title,4,120)&&valid(a.body,20,6000));
if(!data||data.version!==3||data.kind!=='question'||!allowed('campuses',data.campus)||!allowed('tracks',data.track)||
  !/^20\d{2} (Spring|Fall)$/.test(data.term||'')||!allowed('examStages',data.examStage)||
  !data.main||!valid(data.main.en,8,1000)||!valid(data.main.cn,2,1000)||
  !Array.isArray(data.subs)||data.subs.length>20||
  !data.subs.every(s=>s&&valid(s.en,1,400)&&valid(s.cn,0,400))||
  !allowed('sourceTypes',data.source)||!vAdvice(data.advice)||
  (data.alternatives!==undefined&&(!Array.isArray(data.alternatives)||data.alternatives.length>1||
    !data.alternatives.every(s=>s&&valid(s.en,8,1000)&&valid(s.cn,0,1000))))||
  (data.linkedQuestionId!==undefined&&!/^(GZ|HK)-(R|F)-\d{4}$/.test(data.linkedQuestionId))||
  (data.intent!==undefined&&(!data.linkedQuestionId||!allowed('contributionIntents',data.intent)))||
  (data.intent==='supplement'&&!data.subs.length&&!(data.alternatives||[]).length))
  throw Error('Invalid v3 submission');
const group=data.campus.toUpperCase()+'-'+(data.track==='regular'?'R':'F');
const questions=read('questions.json'), appearances=read('appearances.json'),advice=read('advice.json');
const bank=questions.banks[group];
if(!bank||!Array.isArray(bank.items)||!Array.isArray(advice))throw Error('Corrupt question or advice dataset');
const idFor=item=>group+'-'+String(item.num).padStart(4,'0');
const candidates=bank.items.filter(item=>norm(item.en)===norm(data.main.en));
let matched=candidates[0]||null;
if(data.linkedQuestionId){
 matched=candidates.find(item=>idFor(item)===data.linkedQuestionId)||null;
 if(!matched)throw Error('Linked ID must match the exact question within its domain');
}
if(data.intent==='supplement'&&!matched)throw Error('Supplement needs a linked question');
const previously=Object.values(appearances).some(entries=>Array.isArray(entries)&&entries.some(a=>a.issueNumber===number))||
  advice.some(a=>a.issueNumber===number);
if(previously){output('duplicate',true);process.exit(0);}
if(!matched){
 const next=Math.max(0,...bank.items.map(item=>item.num))+1;
 if(next>9999)throw Error('Domain question ID capacity exceeded');
 matched={num:next,en:data.main.en.trim(),cn:data.main.cn.trim(),
   subs:data.subs.map(x=>({en:x.en.trim(),cn:x.cn.trim()})),origin:'community'};
 bank.items.push(matched);
}
const id=idFor(matched);
const occurrence={issueNumber:number,term:data.term,examStage:data.examStage,
 source:data.source,campus:data.campus,track:data.track,intent:data.intent||'encounter',
 ...(data.subs.length?{subs:data.subs.map(x=>({en:x.en.trim(),cn:x.cn.trim()}))}:{}),
 ...((data.alternatives||[]).length?{alternatives:data.alternatives.map(x=>({en:x.en.trim(),cn:x.cn.trim()}))}:{})};
appearances[id]=[...(appearances[id]||[]),occurrence];
const cn=taxonomy.campuses[data.campus].zh,track=data.track==='regular'?'常规 ELPA':'ELPA Fast Track';
const issueUrl='https://github.com/HKUST-ELPA/HKUST-ELPA-Site-Source/issues/'+number;
const doc='community-submissions.md';
fs.appendFileSync(loc(doc),'\n## '+data.term+' · '+cn+' · '+track+' · Issue #'+number+
 '\n\n来源：'+(data.source==='firsthand'?'本人亲历':'同学转述')+' ｜ 题目：'+id+
 ' ｜ [投稿记录]('+issueUrl+')\n\n**English**\n\n'+quote(data.main.en)+
 '\n\n**中文**\n\n'+quote(data.main.cn)+'\n');
if(data.advice){
 const local=advice.filter(a=>a.campus===data.campus&&a.track===data.track);
 const next=Math.max(0,...local.map(a=>Number((a.id||'').match(/-E-(\d+)$/)?.[1])||0))+1;
 if(next>9999)throw Error('Domain advice ID capacity exceeded');
 const adviceId=group+'-E-'+String(next).padStart(4,'0');
 advice.push({id:adviceId,issueNumber:number,questionId:id,campus:data.campus,track:data.track,
 phase:data.advice.phase,tags:data.advice.tags,title:data.advice.title.trim(),body:data.advice.body.trim()});
 fs.appendFileSync(loc('community-advice.md'),'\n## '+adviceId+' · '+quote(data.advice.title)+
 '\n\n校区：'+cn+' ｜ 考试类型：'+track+' ｜ [原始投稿]('+issueUrl+')\n\n'+quote(data.advice.body)+'\n');
}
write('questions.json',questions);write('appearances.json',appearances);write('advice.json',advice);
output(matched.origin==='community'?'added':'linked',true);
