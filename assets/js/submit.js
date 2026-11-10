(function(){
'use strict';
const config=window.ELPA_SUBMISSION_CONFIG||{};
const localeText=(zh,en)=>document.documentElement.dataset.lang==='en'?en:zh;
const taxonomy=typeof ELPA_TAXONOMY!=='undefined'?ELPA_TAXONOMY:null;
const form=document.getElementById('submissionForm');
const btn=document.getElementById('submissionButton');
const message=document.getElementById('submissionMessage');
const qFields=document.getElementById('questionFields'),aFields=document.getElementById('adviceFields');
const campusGz=getCampusButton('campusGz'),campusHk=getCampusButton('campusHk');
function getCampusButton(id){return document.getElementById(id);}
const followups=document.getElementById('followupList');
const list=document.getElementById('adviceTags');
let widgetId=null,submitting=false;
const ready=Boolean(taxonomy&&config.apiEndpoint&&config.turnstileSiteKey&&
  /^https:\/\//.test(config.apiEndpoint));
const get=id=>document.getElementById(id);
const trimmed=id=>get(id).value.trim();
function say(text,state='info'){message.textContent=text;message.dataset.state=state;}
function invalidatePreview(){
  const preview=get('previewPanel');
  if(preview.hidden)return;
  preview.hidden=true;
  say(localeText('内容已修改，请重新预览。','Content changed. Please preview again.'));
}
form.addEventListener('input',invalidatePreview);
form.addEventListener('change',invalidatePreview);
function addText(parent,tag,text,cls){
  const el=document.createElement(tag);el.textContent=text;
  if(cls)el.className=cls;parent.append(el);return el;
}
const year=get('submissionYear');
year.value='';
year.addEventListener('input',()=>{year.value=year.value.replace(/[^0-9]/g,'').slice(0,4);});
function syncCampus(){const gz=trimmed('submissionCampus')==='gz';campusGz.setAttribute('aria-pressed',String(gz));campusHk.setAttribute('aria-pressed',String(!gz));}
function setCampus(value){get('submissionCampus').value=value;get('submissionCampus').dispatchEvent(new Event('change',{bubbles:true}));syncCampus();}
campusGz.addEventListener('click',()=>setCampus('gz'));
campusHk.addEventListener('click',()=>setCampus('hk'));
for(const radio of form.querySelectorAll('input[name="trackPicker"]'))radio.addEventListener('change',()=>{get('submissionTrack').value=radio.value;get('submissionTrack').dispatchEvent(new Event('change',{bubbles:true}));});
for(const radio of form.querySelectorAll('input[name="sourcePicker"]'))radio.addEventListener('change',()=>{get('submissionSource').value=radio.value;get('submissionSource').dispatchEvent(new Event('change',{bubbles:true}));});
function syncChoices(){syncCampus();for(const n of ['trackPicker','sourcePicker']){const id=n==='trackPicker'?'submissionTrack':'submissionSource';for(const radio of form.querySelectorAll('input[name="'+n+'"]'))radio.checked=radio.value===get(id).value;}}
function updateExperience(){const active=get('includeAdvice').checked;get('adviceTitle').required=active;get('adviceBody').required=active;get('advicePhase').required=active;get('adviceFields').classList.toggle('contrib-experience-active',active);for(const mark of get('adviceFields').querySelectorAll('.contrib-advice-required'))mark.hidden=!active;invalidatePreview();}
get('includeAdvice').addEventListener('change',updateExperience);
const ph=taxonomy?.placeholders||{};
for(const [id,value] of Object.entries({
  mainEn:ph.mainEn,mainCn:ph.mainCn,
  adviceTitle:ph.adviceTitle,adviceBody:ph.adviceBody
})){if(value)get(id).placeholder=value;}
for(const [code,labels] of Object.entries(taxonomy?.adviceTags||{})){
  const label=document.createElement('label');label.className='contrib-tag';
  const input=document.createElement('input');
  input.type='checkbox';input.value=code;input.name='adviceTag';
  label.append(input);
  const caption=addText(label,'span',localeText(labels.zh,labels.en));
  caption.dataset.i18nEn=labels.en;
  caption.dataset.i18nZh=labels.zh;
  list.append(label);
}
function refreshFollowups(){
  [...followups.children].forEach((el,i)=>{
    el.querySelector('.follow-title').textContent='小问 '+(i+1);
    el.querySelector('.move-up').disabled=i===0;
    el.querySelector('.move-down').disabled=i===followups.children.length-1;
  });
  get('followupCount').textContent=followups.children.length+' / 20';
  get('addFollowup').disabled=followups.children.length>=20;
}
function addFollowup(en='',cn=''){
  if(followups.children.length>=20)return;
  invalidatePreview();
  const wrapper=document.createElement('div');wrapper.className='contrib-follow';
  const header=document.createElement('div');header.className='contrib-follow-header';
  const title=addText(header,'strong','小问','follow-title');
  const actions=document.createElement('div');actions.className='contrib-follow-controls';
  for(const [cls,symbol,label] of [['move-up','↑',localeText('上移','Move up')],['move-down','↓',localeText('下移','Move down')],['remove','×',localeText('删除','Remove')]]){
    const b=document.createElement('button');b.type='button';b.className='contrib-mini '+cls;
    b.textContent=symbol;b.setAttribute('aria-label',label);
    b.addEventListener('click',()=>{
      if(cls==='remove'){wrapper.remove();}
      else if(cls==='move-up'&&wrapper.previousElementSibling)followups.insertBefore(wrapper,wrapper.previousElementSibling);
      else if(cls==='move-down'&&wrapper.nextElementSibling)followups.insertBefore(wrapper.nextElementSibling,wrapper);
      refreshFollowups();invalidatePreview();
    });actions.append(b);
  }
  header.append(actions);wrapper.append(header);
  for(const [role,labelText,placeholder,val] of [
    ['en',localeText('英文小问 *','English follow-up *'),ph.subEn,en],['cn',localeText('中文补充（选填）','Chinese (optional)'),ph.subCn,cn]]){
    const field=document.createElement('div');field.className='contrib-field';
    const id='follow-'+String(Date.now())+'-'+Math.random().toString(36).slice(2)+'-'+role;
    const label=document.createElement('label');label.textContent=labelText;label.htmlFor=id;
    const ta=document.createElement('textarea');ta.id=id;ta.dataset.lang=role;
    ta.rows=2;ta.required=role==='en';ta.maxLength=400;ta.minLength=role==='en'?1:0;ta.placeholder=placeholder||'';
    ta.value=val;field.append(label,ta);wrapper.append(field);
  }
  followups.append(wrapper);refreshFollowups();
}
get('addFollowup').addEventListener('click',()=>addFollowup());

/* Local-first bilingual match suggestions; only exact linked canonical text is submitted. */
let linkedId=null;
const normMatch=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const chinese=s=>(String(s||'').match(/[\u3400-\u9fff]/g)||[]).join('');
function words(s){return normMatch(s).split(/\s+/).filter(w=>w.length>2&&!['how','what','why','the','and','can','would','could','from','with','you','your','for','are','this','that'].includes(w));}
function matchScore(entry,query){
  const q=normMatch(query);
  if(q.length<3)return 0;
  const corpus=normMatch(entry.en+' '+entry.cn);
  if(corpus.includes(q))return 2;
  const queryWords=words(query),targetWords=words(entry.en+' '+entry.cn);
  const wordHits=queryWords.filter(w=>targetWords.some(t=>t===w||(w.length>=5&&t.startsWith(w)))).length;
  const wordScore=queryWords.length?wordHits/queryWords.length:0;
  const h=chinese(query),targetH=chinese(entry.cn);
  const pairs=h.length>1?Array.from({length:h.length-1},(_,i)=>h.slice(i,i+2)):[];
  const zhScore=pairs.length?pairs.filter(p=>targetH.includes(p)).length/pairs.length:0;
  return Math.max(wordScore,zhScore);
}
function selectedDomain(){
  const campus=trimmed('submissionCampus'),track=trimmed('submissionTrack');
  return campus.toUpperCase()+'-'+(track==='fast-track'?'F':'R');
}
function availableQuestions(){
  const key=selectedDomain();
  return (BANKS[key]?.items||[]).map(item=>({
    id:key+'-'+String(item.num).padStart(4,'0'),en:item.en,cn:item.cn||''
  }));
}
function findQuestion(id){
  return availableQuestions().find(item=>item.id===id)||null;
}
function clearLink(){
  invalidatePreview();
  linkedId=null;
  get('mainEn').readOnly=false;get('mainCn').readOnly=false;
  get('mainEnField').classList.remove('linked-hidden');
  get('mainCnField').classList.remove('linked-hidden');
  get('linkedQuestion').hidden=true;
  get('mainEn').value='';get('mainCn').value='';
  get('supplementEn').value='';get('supplementCn').value='';
  syncContributionIntent();
  renderSuggestions();
}
function linkQuestion(entry){
  invalidatePreview();
  linkedId=entry.id;
  get('mainEn').value=entry.en;
  get('mainCn').value=entry.cn||'';
  get('mainEn').readOnly=true;
  get('mainCn').readOnly=Boolean(entry.cn&&entry.cn.trim().length>=2);
  get('mainEnField').classList.add('linked-hidden');
  get('mainCnField').classList.toggle('linked-hidden',get('mainCn').readOnly);
  get('linkedQuestionTitle').textContent=entry.en+' · '+entry.id;
  get('linkedQuestion').hidden=false;
  get('matchingResults').replaceChildren();
  get('matchingPanel').hidden=false;
  const selected=get('contributionIntent').querySelector('input[value="encounter"]');
  selected.checked=true;
  syncContributionIntent();
}
function syncContributionIntent(){
  const supplement=linkedId&&form.querySelector('input[name="contributionIntent"]:checked')?.value==='supplement';
  get('supplementQuestionFields').hidden=!supplement;
  get('supplementEn').disabled=!supplement;
  get('supplementCn').disabled=!supplement;
}
for(const radio of form.querySelectorAll('input[name="contributionIntent"]'))
  radio.addEventListener('change',syncContributionIntent);
function renderSuggestions(){
  if(linkedId){get('matchingPanel').hidden=false;return;}
  const raw=[trimmed('mainEn'),trimmed('mainCn')].filter(Boolean);
  const matches=availableQuestions().map(entry=>({
    ...entry,rank:Math.max(...raw.map(q=>matchScore(entry,q)),0)
  })).filter(e=>e.rank>=0.28).sort((a,b)=>b.rank-a.rank).slice(0,3);
  const out=get('matchingResults');out.replaceChildren();
  get('linkedQuestion').hidden=true;
  get('matchingPanel').hidden=matches.length===0;
  for(const entry of matches){
    const button=document.createElement('button');button.type='button';button.className='contrib-match';
    const block=document.createElement('span');block.textContent=entry.en;
    const detail=document.createElement('small');detail.textContent=entry.cn;block.append(detail);
    const action=document.createElement('em');action.textContent=localeText('关联','Select');
    button.append(block,action);button.addEventListener('click',()=>linkQuestion(entry));out.append(button);
  }
}
get('unlinkQuestion').addEventListener('click',clearLink);
for(const id of ['mainEn','mainCn'])get(id).addEventListener('input',()=>{if(!linkedId)renderSuggestions();});
// A deep link may start with no campus selected; once selected, never keep a
// canonical question from another campus or assessment in the draft.
for(const id of ['submissionCampus','submissionTrack'])get(id).addEventListener('change',()=>{
  if(linkedId&&!findQuestion(linkedId))clearLink();
  else renderSuggestions();
});
function loadQuestionLink(){
  const params=new URLSearchParams(location.search);
  const campus=params.get('campus'),track=params.get('track'),id=params.get('question');
  if(['gz','hk'].includes(campus))get('submissionCampus').value=campus;
  if(['regular','fast-track'].includes(track))get('submissionTrack').value=track;
  if(params.get('experience')==='1'||params.get('kind')==='advice')get('includeAdvice').checked=true;
  const q=id&&findQuestion(id);
  if(q){
    linkQuestion(q);
    const intent=params.get('intent');
    if(intent==='supplement')
      get('contributionIntent').querySelector('input[value="supplement"]').checked=true;
    syncContributionIntent();
    if(intent==='encounter')requestAnimationFrame(()=>{
      get('exam-context').scrollIntoView({block:'start',behavior:'instant'});
      get('submissionCampus').focus({preventScroll:true});
    });
  }else renderSuggestions();
  syncChoices();
}

loadQuestionLink();
updateExperience();
function buildData(){
  const withAdvice=get('includeAdvice').checked;
  const tags=[...list.querySelectorAll('input:checked')].map(x=>x.value);
  if(withAdvice&&(tags.length<1||tags.length>4))throw new Error('请选择 1–4 个主题标签。 / Please select 1–4 topics.');
  if(!/^20[0-9]{2}$/.test(trimmed('submissionYear')))throw new Error('考试年份必须为四位数字（2000–2099）。');
  if(trimmed('mainCn').length<2)throw new Error('请填写中文理解（至少 2 个字符）。');
  const slot=trimmed('submissionSlot');
  if(!slot)throw new Error('请选择学期及场次。 / Please select a semester and session.');
  const [semester,examStage]=slot.split(':');
  const subs=[...followups.children].map(el=>({
    en:el.querySelector('[data-lang="en"]').value.trim(),
    cn:el.querySelector('[data-lang="cn"]').value.trim()
  }));
  if(!trimmed('mainEn')||subs.some(x=>!x.en))
    throw new Error('请填写英文主问题；小问只需填写记得的英文内容，中文可留空。');
  const intent=linkedId?form.querySelector('input[name="contributionIntent"]:checked').value:'encounter';
  const alternative=intent==='supplement'?{en:trimmed('supplementEn'),cn:trimmed('supplementCn')}:null;
  if(alternative&&alternative.cn&&!alternative.en)
    throw new Error('填写中文理解时，也请填写补充的英文题目。');
  if(intent==='supplement'&&!alternative.en&&!subs.length)
    throw new Error('仅补充题目内容时，请填写相似问法或至少添加一条新的提示小问。');
  return {version:3,kind:'question',campus:trimmed('submissionCampus'),track:trimmed('submissionTrack'),
    term:trimmed('submissionYear')+' '+semester,
    examStage,main:{en:trimmed('mainEn'),cn:trimmed('mainCn')},
    subs,source:trimmed('submissionSource'),
    ...(alternative&&alternative.en?{alternatives:[alternative]}:{}),
    ...(linkedId?{linkedQuestionId:linkedId,intent}:{} ),
    ...(withAdvice?{advice:{phase:trimmed('advicePhase'),tags,title:trimmed('adviceTitle'),body:trimmed('adviceBody')}}:{})};
}
function validateForm(){
  if(!form.reportValidity())return null;
  try{
    const data=buildData();
    const bytes=new TextEncoder().encode(JSON.stringify({...data,turnstileToken:'x'.repeat(2048)})).byteLength;
    if(bytes>24576)throw new Error('内容过长，请精简。 / Content is too long. Please shorten it.');
    return data;
  }catch(e){say(e.message,'error');return null;}
}
function showPreview(){
  const data=validateForm();if(!data)return;
  const preview=get('previewPanel');preview.replaceChildren();
  addText(preview,'h2',localeText('投稿预览','Submission Preview'));
  addText(preview,'small',(data.linkedQuestionId?'已关联 '+data.linkedQuestionId+' · ':'')+
    (data.campus==='gz'?'GZ':'HK')+' · '+
    (data.track==='regular'?'常规 ELPA · Regular':'ELPA Fast Track')+' · '+data.term+' · '+taxonomy.examStages[data.examStage].zh+
    ' · '+taxonomy.sourceTypes[data.source].zh);
  addText(preview,'strong',data.main.en);
  addText(preview,'p',data.main.cn);
  for(const alternative of data.alternatives||[]){
    addText(preview,'small','相似问法','contrib-preview-line');
    addText(preview,'p',alternative.en);addText(preview,'p',alternative.cn);
  }
  for(const [i,sub] of data.subs.entries()){
    addText(preview,'small','小问 '+(i+1),'contrib-preview-line');
    addText(preview,'p',sub.en);addText(preview,'p',sub.cn);
  }
  if(data.advice){
    addText(preview,'small',localeText('备考经验','Preparation advice')+' · '+taxonomy.advicePhases[data.advice.phase].zh,'contrib-preview-line');
    addText(preview,'strong',data.advice.title);addText(preview,'p',data.advice.body);
  }
  addText(preview,'small',localeText('内容将公开保存。','This submission will be public.'));
  preview.hidden=false;preview.scrollIntoView({block:'nearest',behavior:'smooth'});
}
get('previewButton').addEventListener('click',showPreview);
if(!ready){
  say('投稿暂不可用。 / Submissions are unavailable. Please try later.','error');
}else{
  say('填写后完成人机验证。 / Complete the form and verification to submit.');
  const started=Date.now();
  const initialize=()=>{
    if(window.turnstile&&typeof window.turnstile.render==='function'){
      try{
        widgetId=window.turnstile.render('#submissionTurnstile',{
          sitekey:config.turnstileSiteKey,
          action:'elpa_submit',
          callback:()=>{if(!submitting){btn.disabled=false;say('验证完成，可以提交。 / Verified. You can submit now.');}},
          'expired-callback':()=>{btn.disabled=true;say('验证已过期。 / Verification expired. Please verify again.','error');},
          'error-callback':()=>{btn.disabled=true;say('验证失败。 / Verification failed. Please refresh and retry.','error');}
        });
      }catch{say('验证初始化失败。 / Verification could not start. Please refresh.','error');}
    }else if(Date.now()-started<12000)setTimeout(initialize,200);
    else say('验证加载失败。 / Verification could not load. Please refresh.','error');
  };
  initialize();
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!ready||widgetId===null||btn.disabled||submitting)return;
  const data=validateForm();if(!data)return;
  const token=window.turnstile.getResponse(widgetId);
  if(!token){say('请完成人机验证。 / Please complete verification.','error');btn.disabled=true;return;}
  submitting=true;btn.disabled=true;say(localeText('正在提交…','Submitting…'));
  try{
    const response=await fetch(config.apiEndpoint,{
      method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...data,turnstileToken:token})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.ok)throw new Error(result.message||'提交失败，请稍后重试。 / Submission failed. Please try again.');
    form.reset();followups.replaceChildren();refreshFollowups();
    get('mainEn').readOnly=false;get('mainCn').readOnly=false;linkedId=null;
    get('supplementEn').value='';get('supplementCn').value='';syncContributionIntent();
    get('mainEnField').classList.remove('linked-hidden');
    get('mainCnField').classList.remove('linked-hidden');
    year.value='';
    get('submissionSlot').value='';
    get('previewPanel').hidden=true;
    get('includeAdvice').checked=false;updateExperience();syncChoices();
    try{sessionStorage.removeItem(draftKey);}catch{}
    draftNotice('投稿成功，本页暂存草稿已清除。 / Submitted. This draft has been cleared.');
    say('分享已提交，待核对与整理。 / Submitted! Contributions are reviewed before inclusion.','success');
    if(/^https:\/\/github\.com\/HKUST-ELPA\/HKUST-ELPA\/issues\/\d+$/.test(result.issueUrl||'')){
      const a=document.createElement('a');a.href=result.issueUrl;a.target='_blank';
      a.rel='noopener noreferrer';a.textContent=localeText('查看投稿记录','View Submission');message.append(' ',a);
    }
  }catch(e){say(e.message||'网络异常，请重试。 / Network error. Please try again.','error');}
  finally{
    submitting=false;btn.disabled=true;
    if(widgetId!==null&&window.turnstile)window.turnstile.reset(widgetId);
  }
});
updateExperience();syncChoices();
/* Keep unfinished work in this tab, separately for each contribution entry. */
const draftKey='elpa-submission-draft-v3:'+location.search;
const draftFields=['submissionCampus','submissionTrack','submissionYear','submissionSlot','submissionSource',
  'mainEn','mainCn','supplementEn','supplementCn','advicePhase','adviceTitle','adviceBody'];
function draftNotice(text){
  const status=get('submissionDraftStatus');
  if(status.textContent!==text)status.textContent=text;
}
function saveDraft(){
  const fields=Object.fromEntries(draftFields.map(id=>[id,get(id).value]));
  const subs=[...followups.children].map(el=>({
    en:el.querySelector('[data-lang="en"]').value,cn:el.querySelector('[data-lang="cn"]').value
  }));
  const data={fields,subs,includeAdvice:get('includeAdvice').checked,linkedId,tags:[...list.querySelectorAll('input:checked')].map(el=>el.value),
    intent:form.querySelector('input[name="contributionIntent"]:checked').value};
  try{
    sessionStorage.setItem(draftKey,JSON.stringify(data));
    draftNotice('草稿已暂存于当前标签页，尚未提交。 / Draft saved in this tab. Not submitted.');
  }catch{
    draftNotice('当前浏览器无法暂存草稿，离开前请自行保存内容。 / Draft storage is unavailable. Copy your work before leaving.');
  }
}
function restoreDraft(){
  try{
    const saved=sessionStorage.getItem(draftKey);
    if(!saved)return;
    const data=JSON.parse(saved);
    for(const id of draftFields)if(typeof data.fields?.[id]==='string')get(id).value=data.fields[id];
    for(const sub of data.subs||[])addFollowup(sub.en,sub.cn);
    for(const tag of list.querySelectorAll('input'))tag.checked=(data.tags||[]).includes(tag.value);
    if(data.linkedId){const entry=findQuestion(data.linkedId);if(entry)linkQuestion(entry);}
    const intent=form.querySelector('input[name="contributionIntent"][value="'+(data.intent==='supplement'?'supplement':'encounter')+'"]');
    intent.checked=true;
    get('includeAdvice').checked=Boolean(data.includeAdvice);updateExperience();syncChoices();
    syncContributionIntent();
    draftNotice('已恢复当前标签页的草稿，请核对后预览并提交。 / Draft restored. Review and preview it before submitting.');
  }catch{
    draftNotice('草稿无法恢复，请重新填写。 / The draft could not be restored. Please fill in the form again.');
  }
}
restoreDraft();
form.addEventListener('input',saveDraft);
form.addEventListener('change',saveDraft);
form.addEventListener('click',event=>{
  if(event.target.closest('.contrib-tab,#addFollowup,.contrib-follow-controls button,.contrib-match,#unlinkQuestion'))saveDraft();
});
})();
