'use strict';
/* One canonical signed payload powers both routing and reviewer-facing summaries. */
const fs=require('node:fs');
const {decode}=require('./verify-submission.cjs');
const campusNames={gz:'广州校区',hk:'香港校区'};
const trackNames={regular:'常规 ELPA','fast-track':'Fast Track'};
const stageNames={start:'Start',middle:'Middle',end:'End'};
const sourceNames={firsthand:'本人亲历',secondhand:'他人转述',compiled:'资料整理'};
function safe(value,max=500){
  const text=String(value??'').replace(/\r/g,' ').replace(/\n/g,' ').replace(/@/g,'＠').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\|/g,'\\|').trim();
  return text.length>max?text.slice(0,max)+'…':text||'未填写';
}
function quote(value,max=900){return safe(value,max).split('\n').map(x=>'> '+x).join('\n');}
function render(payload,{team,issueUrl}){
  if(!campusNames[payload.campus]||!trackNames[payload.track])throw Error('Invalid review domain');
  const lines=[
    '## 📥 ELPA 新投稿 · 待审核',
    '',
    '@HKUST-ELPA/'+team,
    '',
    '| 审核字段 | 投稿信息 |',
    '| --- | --- |',
    '| 考试校区 | '+campusNames[payload.campus]+' |',
    '| 考试类型 | '+trackNames[payload.track]+' |',
    '| 考试学期 | '+safe(payload.term,80)+' |',
    '| 考试阶段 | '+safe(stageNames[payload.examStage]||payload.examStage,60)+' |',
    '| 内容来源 | '+safe(sourceNames[payload.source]||payload.source,80)+' |',
    '',
    '### 主问题 · English',
    quote(payload.main?.en),
    '',
    '### 主问题 · 中文理解',
    quote(payload.main?.cn),
    '',
    '### 提示小问（'+(Array.isArray(payload.subs)?payload.subs.length:0)+'）'
  ];
  if(Array.isArray(payload.subs)&&payload.subs.length){
    payload.subs.slice(0,12).forEach((sub,i)=>lines.push((i+1)+'. '+safe(sub.en||sub,350)+(sub.cn?' / '+safe(sub.cn,350):'')));
    if(payload.subs.length>12)lines.push('其余小问请打开 Issue 查看。');
  }else lines.push('无');
  lines.push('','### 备考经验');
  if(payload.advice){
    lines.push('**'+safe(payload.advice.title,160)+'**',quote(payload.advice.body,1100));
    if(payload.advice.phase)lines.push('阶段：'+safe(payload.advice.phase,60));
  }else lines.push('未附加');
  if(payload.linkedQuestionId)lines.push('','**关联题目：** `'+safe(payload.linkedQuestionId,50)+'`');
  lines.push('','---','','**审核操作**：核对准确性、重复题目、隐私及经验内容。','- **通过**：在 GitHub 中选择 **Close as completed**，触发自动入库与发布。','- **不收录**：选择 **Close as not planned**。','- 只有当前审核 Team 成员或组织 Owner 的通过操作才会被接受。','','[打开完整投稿与审核记录]('+issueUrl+')','','<!-- elpa-review-notification-v1 -->');
  return lines.join('\n');
}
if(require.main===module){
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH||process.argv[2],'utf8'));
  const payload=decode(event.issue);
  const team=payload.campus+'-'+payload.track+'-reviewers';
  const issueUrl=event.issue.html_url||'https://github.com/'+process.env.GITHUB_REPOSITORY+'/issues/'+event.issue.number;
  fs.writeFileSync(process.argv[3]||'/tmp/elpa-review-notification.md',render(payload,{team,issueUrl})+'\n');
}
module.exports={render,safe};
