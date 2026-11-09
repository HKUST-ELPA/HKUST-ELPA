'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {read:readArtifact,readPageSource:readSource}=require('./site-support.cjs');
const read=file=>readArtifact(file).replace(/\?v=[a-f0-9]{12}(?=")/g,'');
const readPageSource=file=>readSource(file).replace(/\?v=[a-f0-9]{12}(?=")/g,'');
const practice=readPageSource('practice.html');
const submit=readPageSource('submit.html');
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'missing section '+start);return source.slice(a,b);
}
test('GZ/HK are canonical campus route values',()=>{
 assert.match(practice,/data-campus="gz"[^>]*>GZ<\/button>/);
 assert.match(practice,/data-campus="hk"[^>]*>HK<\/button>/);
 assert.match(submit,/<option value="gz">GZ<\/option>/);
 assert.match(submit,/<option value="hk">HK<\/option>/);
});
test('all current IDs survive JSON backup normalization and recovery',()=>{
 const code=section(practice,'function normalizePayload(data) {','function snapshot()');
 const clean=new Function('validRecord',code+';return normalizePayload')(
   v=>v!==null&&typeof v==='object'&&!Array.isArray(v));
 for(const id of ['GZ-R-0001','GZ-R-0043','GZ-F-0001','HK-R-0001','HK-F-0001']){
   const got=clean({statuses:{[id]:'done'},notes:{['qn-'+id]:'kept',[id+'-1']:'follow-up'}});
   assert.equal(got.statuses[id],'done',id);
   assert.equal(got.notes['qn-'+id],'kept',id);
   assert.equal(got.notes[id+'-1'],'follow-up',id);
 }
 assert.deepEqual(Object.keys(clean({statuses:{'../bad':'done'},notes:{'qn-<script>':'injection'}}).statuses),[]);
});
test('feedback count includes reviewed submissions and ties retain original order',()=>{
 const code=section(practice,'function feedbackCount(id){','function toggleTranslation(id,button){');
 const fixtures={
   'GZ-F-0001':{num:1,records:1},'GZ-F-0002':{num:2,records:2},
   'GZ-R-0040':{num:1,term:'2026 Fall'},'GZ-R-0001':{num:1},
   'GZ-R-0052':{num:52,origin:'community',term:'2027 Fall'}
 };
 const arrivals={'GZ-F-0001':[{issueNumber:9},{issueNumber:9},{issueNumber:10}],
   'GZ-F-0002':[], 'GZ-R-0040':[{issueNumber:11},{issueNumber:12,intent:'supplement'}],
   'GZ-R-0052':[
     {issueNumber:301,intent:'encounter',subs:[{en:'What matters?',cn:''}]},
     {issueNumber:302,intent:'supplement',alternatives:[{en:'Could you explain this project?',cn:'你能解释这个项目吗？'}],subs:[{en:'What changed?',cn:''}]}
   ]};
 const funcs=new Function('questionById','appearancesFor',code+
   ';return {feedbackCount,feedbackRanked,questionFollowups,questionAlternatives}')(
   id=>fixtures[id],id=>arrivals[id]||[]);
 assert.equal(funcs.feedbackCount('GZ-F-0001'),3);
 assert.equal(funcs.feedbackCount('GZ-R-0040'),2);
 assert.equal(funcs.feedbackCount('GZ-R-0001'),1);
 assert.equal(funcs.feedbackCount('GZ-R-0052'),1,'imported issue counted exactly once');
 assert.deepEqual(funcs.questionFollowups('GZ-R-0052',{subs:[{en:'Original prompt?',cn:''}]}),[
   {en:'Original prompt?',cn:''},{en:'What matters?',cn:''},{en:'What changed?',cn:''}
 ]);
 assert.deepEqual(funcs.questionAlternatives('GZ-R-0052',{en:'Original question'}),[
   {en:'Could you explain this project?',cn:'你能解释这个项目吗？'}
 ]);
 assert.deepEqual(funcs.feedbackRanked(['GZ-F-0002','GZ-R-0001','GZ-F-0001','GZ-R-0040']),['GZ-F-0001','GZ-F-0002','GZ-R-0040','GZ-R-0001']);
});
test('practice cards expose reviewed encounter action and uniform alignment',()=>{
 assert.match(practice,/过往考过 \$\{feedback\} 次/);
 assert.match(practice,/我也考过 \/ Seen this<\/a>/);
 assert.match(practice,/submit\.html\?question=\$\{encodeURIComponent\(id\)\}/);
 assert.doesNotMatch(practice,/submit\.html\?question=\$\{encodeURIComponent\(id\)\}[^"`]*campus=/);
 assert.match(practice,/margin:0!important/);
 assert.match(submit,/id="contributionIntent"/);
 assert.match(submit,/linkedQuestionId:linkedId/);
 assert.match(submit,/id="supplementQuestionFields"[^>]*hidden/);
 assert.match(submit,/id="supplementEn"/);
 assert.match(submit,/填写相似问法或至少添加一条新的提示小问/);
 assert.match(practice,/相似问法 \/ Variants \(\$\{alternatives\.length\}\)/);
 assert.match(practice,/function questionAlternatives\(id,item\)/);
 assert.match(submit,/id="campusGz"[^>]*aria-pressed="true"/);
 assert.match(submit,/id="campusHk"[^>]*aria-pressed="false"/);
 assert.match(submit,/id="exam-context">02 · 考试类型/);
 assert.match(submit,/name="trackPicker" value="regular" checked/);
 assert.match(submit,/name="trackPicker" value="fast-track"/);
 assert.match(submit,/id="submissionYear" type="text" inputmode="numeric" pattern="20\[0-9\]\{2\}"/);
 assert.match(submit,/name="sourcePicker" value="firsthand"/);
 assert.match(submit,/id="includeAdvice" type="checkbox"/);
 assert.match(submit,/if\(linkedId&&!findQuestion\(linkedId\)\)clearLink\(\)/);
 assert.match(submit,/id="mainCn"[^>]*required/);

});
test('Chinese and English matching runs locally, does not require network',()=>{
 const code=section(submit,'const normMatch=s=>','function selectedDomain(){');
 const score=new Function(code+';return matchScore')();
 const item={en:'How would you guide undergraduate students to use AI ethically?',
   cn:'作为助教，如何指导本科生合乎伦理地使用 AI？'};
 assert.ok(score(item,'如何指导本科生使用AI')>=0.28);
 assert.ok(score(item,'undergraduate students AI ethically')>=0.28);
 assert.equal(score(item,'interdisciplinary robotics curriculum'),0);
 assert.match(submit,/slice\(0,3\)/);
});
test('one exercise entry and predictable compact question card',()=>{
 assert.match(practice,/id="practiceLauncher"/);
 assert.match(practice,/id="timerPanel"[^>]*aria-hidden="true"/);
 assert.match(practice,/id="tabMock"/);
 assert.match(practice,/id="timerDrill"/);
 assert.doesNotMatch(practice,/id="mockExamBtn"|id="quickDrawBtn"|id="practiceTimerBtn"/);
 assert.doesNotMatch(practice,/class="question-contribute"/);
 assert.match(practice,/class="q-actions \$\{translation \? "has-translation"/);
 assert.match(practice,/\.q-actions\.no-translation/);
 assert.match(practice,/\.note-wrap:not\(\.open\) \.md-tab/);
 assert.match(practice,/env\(safe-area-inset-bottom,0px\)/);
});
function newTimerFixture(){
 const code=fs.readFileSync(path.join(__dirname,'../assets/js/practice-session.js'),'utf8');
 const elements=new Map(),listeners=new Map();
 const cls=()=>{const store=new Set();return {
   add:(...names)=>names.forEach(name=>store.add(name)),
   remove:(...names)=>names.forEach(name=>store.delete(name)),
   contains:name=>store.has(name),
   toggle:(name,force)=>{const target=force===undefined?!store.has(name):force;
     target?store.add(name):store.delete(name);return target;}
 }};
 const card={dataset:{filterMatch:'1'},classList:cls(),scrolled:0,
   scrollIntoView(){this.scrolled++;}};
 const el=id=>{
   if(id==='q-GZ-R-0001')return card;
   if(!elements.has(id))elements.set(id,{
     classList:cls(),textContent:'',value:id==='timerMin'?'2':'0',hidden:false,
     disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},
     addEventListener(name,fn){listeners.set(id+':'+name,fn);},
     focus(){this.focused=true;},contains(){return true;}
   });
   return elements.get(id);
 };
 const document={getElementById:el,querySelectorAll:()=>[],addEventListener:(name,fn)=>listeners.set('document:'+name,fn),hidden:false};
 const window={confirm:()=>true,matchMedia:()=>({matches:true}),addEventListener:(name,fn)=>listeners.set('window:'+name,fn)};
 let clock=100000,notice='';
 const fakeDate={now:()=>clock};
 const timerFactory=new Function('document','window','Date','setInterval',
    'clearInterval','setTimeout','allPracticeIds','bankPages','matchingCards',
    'applyFilters','setTip','PAGE_SIZE',code+
    ';return {tickTimer,drawPractice,read:()=>({timerRunning,timerMode,timerRemain,timerPhase,timerElapsed}),openTimerPanel};');
 const api=timerFactory(document,window,fakeDate,()=>7,()=>{},()=>{},
    ()=>['GZ-R-0001'],{fall:1,past:1},()=>[card],()=>{},txt=>{notice=txt;},8);
 const click=id=>{const fn=listeners.get(id+':click');assert.ok(fn,'missing click '+id);fn();};
 return {api,el,click,card,advance:ms=>{clock+=ms;},notice:()=>notice,
   leave:()=>listeners.get('window:elpa:practice-leave')?.()};
}
test('leaving practice ends the current timer and closes the dock',()=>{
  const fixture=newTimerFixture();
  fixture.click('practiceLauncher');
  fixture.click('timerStartPause');
  assert.equal(fixture.api.read().timerRunning,true);
  fixture.leave();
  assert.equal(fixture.api.read().timerRunning,false);
  assert.equal(fixture.el('timerPanel').classList.contains('show'),false);
});
test('opening exercise panel does not draw or start timer; random drawing is independent',()=>{
 const f=newTimerFixture();
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 f.click('practiceLauncher');
 assert.equal(f.el('timerPanel').classList.contains('show'),true);
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(f.card.scrolled,0);
 f.click('timerDrill');
 assert.equal(f.card.scrolled,1);
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 assert.equal(f.api.read().timerRunning,false);
 assert.match(f.notice(),/已抽到/);
});
test('mock timer keeps time after panel closes and transitions at original deadlines',()=>{
 const f=newTimerFixture();
 f.click('practiceLauncher');
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,true);
 assert.equal(f.api.read().timerPhase,'prep');
 assert.equal(f.el('timerPanel').classList.contains('show'),false);
 f.advance(60000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'speak');
 assert.equal(Math.round(f.api.read().timerRemain),120);
 f.advance(120000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'done');
 assert.equal(f.api.read().timerRunning,false);
 f.click('timerReset');
 assert.equal(f.api.read().timerPhase,'idle');
 assert.equal(f.api.read().timerRemain,60);
});
test('pause and resume preserve seconds, custom countdown and stopwatch work',()=>{
 const f=newTimerFixture();
 f.click('timerStartPause');
 f.advance(10000);
 f.api.tickTimer();
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,false);
 assert.equal(Math.round(f.api.read().timerRemain),50);
 f.advance(25000);
 f.click('timerStartPause');
 assert.equal(f.api.read().timerRunning,true);
 f.advance(50000);
 f.api.tickTimer();
 assert.equal(f.api.read().timerPhase,'speak');
 f.click('timerReset');
 f.click('tabCountdown');
 assert.equal(f.api.read().timerMode,'countdown');
 assert.equal(f.el('timerSet').hidden,false);
 f.el('timerMin').value='0';f.el('timerSec').value='12';
 const onInput=f.el('timerSec'); // timer set is read only through the existing input handler.
 f.click('tabStopwatch');
 assert.equal(f.api.read().timerMode,'stopwatch');
 f.click('timerStartPause');
 f.advance(4500);
 f.api.tickTimer();
 assert.equal(Math.floor(f.api.read().timerElapsed),4500);
 assert.equal(f.el('timerDisplay').textContent,'00:04');
});

test('footer is concise, community-oriented and identical across six pages',()=>{
 const pages=['index.html','guide.html','practice.html','sources.html','submit.html','community.html'];
 const footers=pages.map(p=>{
   const html=read(p),matches=html.match(/<footer class="elpa-footer"[\s\S]*?<\/footer>/g);
   assert.equal(matches?.length,1,p+' should have one footer');
   return matches[0];
 });
 for(const f of footers){
   assert.equal(f,footers[0],'Footer must match across all pages');
   for(const label of ['Founded by','FuTseYi (Shine)'])
     assert.ok(f.includes(label),'Footer missing '+label);
   assert.match(f,/class="footer-bottom-credit" href="\.\/community\.html"/);
   assert.match(f,/class="footer-github"[^>]*>[\s\S]*?<svg viewBox="0 0 16 16"/);
   assert.doesNotMatch(f,/Infrastructure provided and maintained by the founder\./);
   assert.match(f,/href="\.\/submit\.html">投稿分享<\/a>/);
   assert.match(f,/class="footer-github"/);
   assert.doesNotMatch(f,/Not affiliated with or endorsed by HKUST|资料来源与声明|Created &amp; Maintained by/);
 }
 assert.match(read('sources.html'),/本站为学生整理的备考资源，并非学校官方题库/);
 assert.match(read('assets/css/shell.css'),/\.footer-grid\{/);
 assert.match(read('assets/css/shell.css'),/-webkit-tap-highlight-color:transparent/);
 assert.match(read('assets/css/site.css'),/\.question-feedback a::after/);
 assert.equal((read('practice.html').match(/id="exportBtn"/g)||[]).length,1);
});

test('all pages share one compact banner and the practice brand uses the site palette',()=>{
 const pages=['index.html','guide.html','practice.html','sources.html','submit.html','community.html'];
 for(const page of pages){
   const html=read(page);
   assert.match(html,/class="[^"]*elpa-subhero/);
   assert.equal((html.match(/<main(?:\s|>)/g)||[]).length,1,page+' should have one main landmark');
 }
 assert.match(practice,/<body class="elpa-body page-practice">/);
});

test('sources page keeps external references without duplicate question-bank documents',()=>{
 const sources=read('sources.html');
  assert.match(sources,/id="official-sources">学校官方说明\s*<\/h2>/);
  assert.match(sources,/id="community-sources">补充链接\s*<\/h2>/);
 assert.match(sources,/docs\.qq\.com\/doc\/DT3BxSkJzSGdUamJE/);
 assert.match(sources,/docs\.qq\.com\/doc\/DSHJydEVYSHBtdkZO/);
 assert.doesNotMatch(sources,/站内题库文档|question-bank\/(?:2026-fall|previous-years|fast-track)\.md/);
 assert.doesNotMatch(practice,/tree\/main\/question-bank|question-provenance|sourceNote/);
 assert.match(practice,/href="\.\/sources\.html">查看参考资料<\/a>/);
});

test('seed advice uses the same track, phase and topic schema without invented provenance',()=>{
 const advice=JSON.parse(fs.readFileSync(path.join(__dirname,'../question-bank/advice.json'),'utf8'));
 assert.equal(advice.filter(item=>item.id.startsWith('GZ-R-E-')).length,3);
 assert.equal(advice.filter(item=>item.campus==='gz'&&item.track==='regular'&&item.phase==='during').length,3);
 for(const item of advice)assert.ok(!/HIST-|provenance|历史考情整理/.test(JSON.stringify(item)));
 assert.match(submit,/id="includeAdvice" type="checkbox"/);
});

test('guide separates the official Regular and Fast Track paths with one obvious switch',()=>{
 const guide=readPageSource('guide.html');
 assert.match(guide,/id="guideRegularTab"[^>]*aria-pressed="true"/);
 assert.match(guide,/id="guideFastTab"[^>]*aria-pressed="false"/);
 assert.match(guide,/id="fastGuide"[^>]*hidden/);
 for(const step of ['入场与身份核验','抽题与准备','个人陈述','提问与回答','结束离场']) assert.match(guide,new RegExp(step));
 assert.match(guide,/学生证或校园卡/);
 assert.match(guide,/主问题和提示小问/);
 assert.match(guide,/草稿纸和笔/);
 assert.match(guide,/考官的计时提示/);
 assert.match(guide,/个人英语陈述/);
 assert.match(guide,/按照系统指定的话题准备英语回答/);
 assert.doesNotMatch(guide,/约 30 分钟|最多 4 名|IELTS 口语|TOEFL 口语|Automatic Exemption/);
 assert.match(guide,/track=regular#sec-bankD/);
 assert.match(guide,/track=fast-track#sec-bankD/);
 assert.doesNotMatch(read('guide.html'),/报名截止日期|2026 Fall 场次反馈|你可能想知道|class="elpa-guide-faq"/);
 assert.match(guide,/id="advicePhaseFilter"/);
 assert.match(guide,/id="adviceTagFilter"/);
 assert.equal((guide.match(/class="elpa-guide-switch"/g)||[]).length,2);
 assert.match(guide,/id="guideCampusGz"/);
 assert.match(guide,/id="guideCampusHk"/);
});
test('homepage explains the full learning workflow without a repeated oversized practice CTA',()=>{
 const home=readPageSource('index.html');
 const practice=readPageSource('practice.html');
 assert.match(home,/id="home-overview-title">初次使用\s*<\/h2>/);
 assert.match(home,/id="home-features-title">使用指南\s*<\/h2>/);
 assert.equal((home.match(/class="elpa-home-journey"/g)||[]).length,1);
 assert.equal((home.match(/class="elpa-home-feature"/g)||[]).length,4);
 for(const id of ['home-guide-title','home-bank-title','home-practice-title','home-record-title','home-more-title'])
   assert.ok(home.includes('id="'+id+'"'),'Missing '+id);
 for(const topic of ['常规 ELPA / Fast Track','考试场次','相似问法','提示小问','随机抽题','正向计时','记笔记','未练','练习中','已掌握','备份','恢复','换浏览器'])
   assert.ok(home.includes(topic),'Not explained: '+topic);
 assert.match(home,/从当前筛选结果中抽题，配合计时自己开口练习/);
 assert.match(home,/先有 1 分钟准备，接着进入 2 分钟陈述/);
 assert.match(home,/不同校区和考试类型的收录情况可能不同/);
 assert.match(home,/不会自动评价回答/);
 assert.match(home,/点击页面右下角的「练习」，再选「随机抽题」/);
 assert.match(home,/换手机或电脑，怎么接着练？/);
 assert.match(home,/「恢复」会替换当前设备已有的记录/);
 assert.doesNotMatch(read('index.html'),/模拟口语|Markdown|JSON|elpa_data\.json/);
 assert.equal((home.match(/class="elpa-home-instructions"/g)||[]).length,2);
 assert.equal((home.match(/class="elpa-home-instructions-num"/g)||[]).length,6);
 assert.equal((home.match(/class="elpa-home-backup-guide"/g)||[]).length,1);
 assert.match(home,/class="elpa-home-demo"/);
 assert.match(home,/class="elpa-home-demo elpa-home-demo-timer"/);
 assert.equal((home.match(/class="elpa-demo-top"/g)||[]).length,4);
 assert.ok(home.includes('href="./guide.html"')&&home.includes('href="./practice.html"'));
 assert.ok(home.includes('href="./sources.html"')&&home.includes('href="./submit.html"'));
 assert.match(home,/无需注册账号/);
 assert.match(home,/公开记录保存/);
 assert.doesNotMatch(home,/elpa-next-primary|elpa-home-next|elpa-start-actions|elpa-capability|提交 → 后端校验 → 审核 → 入库/);
 assert.match(home,/class="elpa-cta elpa-cta-primary" href="\.\/practice\.html"/);
 const css=fs.readFileSync(path.join(__dirname,'../assets/css/site.css'),'utf8');
 assert.match(css,/\.elpa-home-feature\{display:grid/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.doesNotMatch(css,/\.elpa-next-primary|\.elpa-quickstart|\.elpa-capability/);
 const toolbar=section(practice,'<div class="toolbar">','<!-- 存储状态提示 -->');
 const progress=section(practice,'<!-- Progress -->','<!-- TOC -->');
 assert.doesNotMatch(toolbar,/id="doneCount"|id="recordsMenuBtn"/);
 assert.match(progress,/id="doneCount"/);
 assert.match(progress,/id="recordsMenuBtn"/);
 assert.doesNotMatch(practice,/id="currentBankDescription"|往届经典题与其他学期的考生反馈统一归档|该分类暂无已收录题目/);
 assert.doesNotMatch(practice,/current\.length\+' 题 · '|past\.length\+' 题 · '/);
 assert.match(practice,/feedbackBankCount'\)\.textContent=current\.length\+' 题'/);
 assert.match(practice,/pastBankCount'\)\.textContent=past\.length\+' 题'/);
 assert.match(practice,/id="sessionFilter"[\s\S]*?<option value="" data-i18n-en="All Sessions">全部场次<\/option>/);
 assert.match(practice,/#sessionFilter\{field-sizing:content\}/);
 assert.match(practice,/\.filter-select \{[^}]*width:auto; max-width:100%/);
 assert.match(practice,/appearance:none; -webkit-appearance:none; padding:7px 28px 7px 12px/);
 assert.match(practice,/id="statusFilter"[^>]*>[\s\S]*?<option value="all" data-i18n-en="Study Status">备考状态<\/option>/);
 assert.match(practice,/\.progress-head-actions \.stat-pill,#recordsMenuBtn\{[^}]*height:36px;[^}]*white-space:nowrap/);
 assert.match(practice,/#recordsMenuBtn\{[^}]*width:auto;[^}]*padding:0 10px;[^}]*border-radius:999px/);
 assert.match(practice,/entry\.term\+' · '\+stage\.zh/);
 assert.doesNotMatch(practice,/id="termFilter"|id="examStageFilter"|session-badges|session-chip/);
 const appearances=JSON.parse(fs.readFileSync(path.join(__dirname,'../question-bank/appearances.json'),'utf8'));
 const questions=JSON.parse(fs.readFileSync(path.join(__dirname,'../question-bank/questions.json'),'utf8'));
 const sessionData={ids:questions.historicalQuestionIds,data:appearances};
 assert.equal(sessionData.ids.length,25);
 // Legacy questions must not acquire invented year/stage evidence.
 // Future issue-linked reports may still add reviewed appearances to these IDs.
 for(const id of [...sessionData.ids,...Array.from({length:12},(_,i)=>'GZ-R-'+String(i+40).padStart(4,'0'))])
   for(const entry of sessionData.data[id]||[])
     assert.ok(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0,id);
 const fastSessionData={ids:questions.banks['GZ-F'].items.map(x=>'GZ-F-'+String(x.num).padStart(4,'0')),data:appearances};
 assert.equal(fastSessionData.ids.length,12);
 for(const id of fastSessionData.ids)
   for(const entry of fastSessionData.data[id]||[])
     assert.ok(Number.isSafeInteger(entry.issueNumber)&&entry.issueNumber>0,id);
 assert.ok(questions.banks['GZ-F'].items.some(item=>item.num===1&&item.subs.length===0));
 assert.equal(fastSessionData.ids.length,12);
 assert.ok(!fastSessionData.ids.includes('GZ-F-0013'));
 assert.doesNotMatch(practice,/fastIntroSection|fastIntroDetails|ELPA_FAST_TRACK_INTRO|补充准备 · 完整自我介绍任务/);
 assert.match(practice,/titleStatus\.textContent=total\?'第 '\+page\+' \/ '\+pages\+' 页 · 总 '\+total\+' 题':'0 题'/);
 assert.match(practice,/function activeLatestSessionLabel\(\)[\s\S]*?session\.term\+' · '\+ELPA_TAXONOMY\.examStages\[session\.stage\]\.zh/);
 assert.match(practice,/currentBankTitle'\)\.textContent=selectedIsCurrent\?selectedLabel:sessionLabel/);
 assert.doesNotMatch(practice,/currentBankTitle'\)\.textContent=.*最新学期题库/);
 assert.match(practice,/id="pastBankTitle">过往题库<\/h2>/);
 assert.match(practice,/pastBankTitle'\)\.textContent=selectedValue&&!selectedIsCurrent\?selectedLabel:'过往题库'/);
 assert.match(practice,/sec-bankD'\)\.hidden=!count\|\|\(!!selectedValue&&!selectedIsCurrent\)/);
 assert.match(practice,/sec-bankA'\)\.hidden=!count\|\|\(!!selectedValue&&selectedIsCurrent\)/);
 assert.match(practice,/const items=selectedValue\?/);
 assert.match(practice,/\.page-practice \.to-top\{[\s\S]*?display:inline-grid!important/);
 assert.match(practice,/\.page-practice \.practice-launcher\{[\s\S]*?bottom:calc\(66px/);
 assert.doesNotMatch(practice,/筛选后|每页最多|pagination-caption/);
 assert.match(practice,/\.page-practice \.sec-head \.tag \{[\s\S]*?white-space:nowrap/);
});
test('latest bank advances by complete term and stage while older sessions remain filterable',()=>{
 const code=section(practice,'function activeLatestTerm(){','function renderTOC() {');
 const ids=['Q-start','Q-mid','Q-old'];
 const records={
   'Q-start':[{term:'2026 Fall',examStage:'start'}],
   'Q-mid':[{term:'2026 Fall',examStage:'mid'}],
   'Q-old':[{term:'2025 Fall',examStage:'start'}]
 };
 const funcs=new Function('activePracticeIds','appearancesFor','elpaLatestTermForIds','elpaReportedTerms','ELPA_TAXONOMY',
   code+';return {activeLatestSession,activeCurrentIds,activeArchivedIds};')(
     ()=>ids,id=>records[id]||[],()=> '2026 Fall',id=>(records[id]||[]).map(x=>x.term),
     {examStages:{start:{zh:'开学阶段'},mid:{zh:'学期中'},end:{zh:'学期末'}}});
 assert.deepEqual(funcs.activeLatestSession(),{term:'2026 Fall',stage:'mid'});
 assert.deepEqual(funcs.activeCurrentIds(),['Q-mid']);
 assert.deepEqual(funcs.activeArchivedIds(),['Q-start','Q-old']);
 // Undated Fast Track recollections must remain immediately practiceable.
 const undated=new Function('activePracticeIds','appearancesFor','elpaLatestTermForIds','elpaReportedTerms','ELPA_TAXONOMY',
   code+';return {activeLatestSessionLabel,activeCurrentIds,activeArchivedIds};')(
     ()=>['GZ-F-0001','GZ-F-0002'],()=>[],()=>'',()=>[],{examStages:{}});
 assert.equal(undated.activeLatestSessionLabel(),'场次待核实');
 assert.deepEqual(undated.activeCurrentIds(),['GZ-F-0001','GZ-F-0002']);
 assert.deepEqual(undated.activeArchivedIds(),[]);
 assert.match(practice,/sessions\.set\(entry\.term\+'\|'\+entry\.examStage/);
 assert.match(practice,/sessionFilter\.append\(new Option\(session\.label,value\)\)/);
});
test('guide filters experiences by both campus and track',()=>{
 const html=read('guide.html');
 const js=fs.readFileSync(path.join(__dirname,'../assets/js/guide.js'),'utf8');
 assert.match(html,/id="guideCampusGz"/);
 assert.match(html,/id="guideCampusHk"/);
 assert.match(html,/data-campus="gz"/);
 assert.match(js,/card\.dataset\.campus===adviceCampus&&card\.dataset\.track===adviceTrack/);
 assert.match(js,/guideAdviceShare/);
 assert.match(js,/campus='\+adviceCampus/);
 assert.match(js,/selectGuideCampus/);
});
test('Fast Track documentation links to the selectable practice route',()=>{
 const fastDoc=fs.readFileSync(path.join(__dirname,'../question-bank/fast-track.md'),'utf8');
 const indexDoc=fs.readFileSync(path.join(__dirname,'../question-bank/README.md'),'utf8');
 assert.ok(fastDoc.includes('../practice.html?campus=gz&track=fast-track'));
 assert.ok(!fastDoc.includes('../practice.html#fast-track'));
 assert.ok(indexDoc.includes('| [Fast Track · 广州校区](./fast-track.md) |'));
});

test('official source links remain separate from community references',()=>{
 const sources=read('sources.html');
 assert.match(sources,/id="official-sources"/);
 assert.match(sources,/id="community-sources"/);
 for(const target of ['https://elpa.hkust-gz.edu.cn/','https://fytgs.hkust-gz.edu.cn/handbooks/handbook-for-research-postgraduate-studies','https://cle.hkust.edu.hk/elpa','https://cle.hkust.edu.hk/sites/default/files/2026-08/ELPA-Speaking-Scale-Student-Version.pdf'])assert.ok(sources.includes(target),target);
 assert.ok(sources.indexOf('id="official-sources"')<sources.indexOf('id="community-sources"'));
 assert.equal((sources.match(/class="elpa-resource-tag"/g)||[]).length,4);
});
