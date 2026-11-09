/* One domain selector for advice: campus and ELPA track. */
const guideText=(zh,en)=>document.documentElement.dataset.lang==='en'?en:zh;
const flowRegular=document.getElementById('regularGuide');
const flowFast=document.getElementById('fastGuide');
const regularButton=document.getElementById('guideRegularTab');
const fastButton=document.getElementById('guideFastTab');
const campusButtons={gz:document.getElementById('guideCampusGz'),hk:document.getElementById('guideCampusHk')};
const adviceList=document.getElementById('guideAdviceList');
const adviceCards=[...adviceList.querySelectorAll('.elpa-advice-card')];
const advicePhaseFilter=document.getElementById('advicePhaseFilter');
const adviceTagFilter=document.getElementById('adviceTagFilter');
const params=new URLSearchParams(location.search);
let adviceCampus=params.get('campus')==='hk'?'hk':'gz';
let adviceTrack=params.get('track')==='fast-track'||location.hash==='#fast-track'?'fast-track':'regular';
function selectGuideTrack(track){
  adviceTrack=track;
  const fast=track==='fast-track';
  flowRegular.hidden=fast;flowFast.hidden=!fast;
  regularButton.classList.toggle('active',!fast);
  fastButton.classList.toggle('active',fast);
  regularButton.setAttribute('aria-pressed',String(!fast));
  fastButton.setAttribute('aria-pressed',String(fast));
  updateAdvice();
}
function selectGuideCampus(campus){
  adviceCampus=campus;
  for(const [key,button] of Object.entries(campusButtons)){
    button.classList.toggle('active',key===campus);
    button.setAttribute('aria-pressed',String(key===campus));
  }
  updateAdvice();
}
function updateAdvice(){
  advicePhaseFilter.options[0].textContent=guideText('全部阶段','All Stages');
  adviceTagFilter.options[0].textContent=guideText('全部主题','All Topics');
  const entries=adviceCards.filter(card=>card.dataset.campus===adviceCampus&&card.dataset.track===adviceTrack);
  for(const [select,tags,labels] of [
    [advicePhaseFilter,new Set(entries.map(card=>card.dataset.phase)),ELPA_TAXONOMY.advicePhases],
    [adviceTagFilter,new Set(entries.flatMap(card=>card.dataset.tags.split(',').filter(Boolean))),ELPA_TAXONOMY.adviceTags]
  ]){
    select.replaceChildren(select.options[0]);
    for(const [key,label] of Object.entries(labels)){
      if(!tags.has(key))continue;
      const option=document.createElement('option');
      option.value=key;option.textContent=guideText(label.zh,label.en);select.append(option);
    }
    select.value='';
  }
  document.getElementById('guideAdviceFilters').hidden=entries.length===0;
  document.getElementById('guideAdviceShare').href='./submit.html?campus='+adviceCampus+'&track='+adviceTrack+'&experience=1';
  const url=new URL(location.href);
  url.searchParams.set('campus',adviceCampus);url.searchParams.set('track',adviceTrack);
  history.replaceState(null,'',url.pathname+url.search+url.hash);
  renderCommunityAdvice();
}
function renderCommunityAdvice(){
  const entries=adviceCards.filter(card=>card.dataset.campus===adviceCampus&&card.dataset.track===adviceTrack);
  const visible=entries.filter(card=>
    (!advicePhaseFilter.value||card.dataset.phase===advicePhaseFilter.value)&&
    (!adviceTagFilter.value||card.dataset.tags.split(',').includes(adviceTagFilter.value)));
  adviceList.replaceChildren(...visible);
  const empty=document.getElementById('guideAdviceEmpty');
  empty.hidden=visible.length!==0;
  empty.textContent=entries.length
    ?guideText('此分类暂无经验分享。','No tips in this category yet.')
    :guideText('此校区及考试类型暂无经验分享。','No tips for this campus and assessment yet.');
}
regularButton.addEventListener('click',()=>selectGuideTrack('regular'));
fastButton.addEventListener('click',()=>selectGuideTrack('fast-track'));
for(const [campus,button] of Object.entries(campusButtons))
  button.addEventListener('click',()=>selectGuideCampus(campus));
advicePhaseFilter.addEventListener('change',renderCommunityAdvice);
adviceTagFilter.addEventListener('change',renderCommunityAdvice);
selectGuideCampus(adviceCampus);
selectGuideTrack(adviceTrack);
window.addEventListener('elpa:language',updateAdvice);
