/* SQLD NOTE v3 — static problem bank and supplemental learning. No framework or service key. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL={unseen:'새 문제',wrong:'오답',unknown:'모름',mastered:'정복'};
const K_GUEST='sqld_v3_guest_v1', K_USER=id=>'sqld_v3_cache_'+id, K_PENDING=id=>'sqld_v3_pending_'+id;
const sourceUrl='/questions/bank.json';
let questions=[], questionMap=new Map(), supplements=[], states={}, profile=null, client=null;
let selected=null, revealed=false, lastOutcome=null, currentQuestion=null, currentMode='mixed', currentTopic='all';
let sessionSeen=new Set(), sessionStep=0, busy=false, lastAsked=new Map(), pending=[], flushing=false, bankFetchError='';
let supplementId='';
const read=(key,def)=>{try{let v=JSON.parse(localStorage.getItem(key));return v??def;}catch{return def}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(e){console.warn('Local save failed',e);}};
const stateKey=()=>profile?.id?K_USER(profile.id):K_GUEST;
const loadLocal=()=>read(stateKey(),{});
const setNotice=(label,error=false)=>{for(const el of $$('[data-bank-status]')){el.textContent=label;el.classList.toggle('is-error',error);}};
const currentRoute=()=>location.hash.replace('#','');
const inBank=()=>['practice','review'].includes(currentRoute());
const inSupplement=()=>currentRoute().startsWith('supplement');
const cell = v => v===null?'<span class="v3-null">NULL</span>':escapeHtml(v);
function renderTable(table){if(!table)return '';
 const cols=table.columns||[];const rows=table.rows||[];
 return `<div class="v3-data-card"><div class="v3-data-title">${escapeHtml(table.name||'결과 테이블')} <small>${rows.length}행</small></div><div class="v3-table-wrap" tabindex="0" aria-label="데이터 표 가로 스크롤"><table><thead><tr>${cols.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${cell(v)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">결과 행 없음</td></tr>`}</tbody></table></div></div>`;
}
function lessonDone(){return window.sqldStateBridge?.getState()?.done?.length||0;}
const status=(id)=>states[id]?.status||'unseen';
function counts(){const result={unseen:0,wrong:0,unknown:0,mastered:0};questions.forEach(q=>result[status(q.id)]++);return result;}
function refreshDashboard(){let c=counts();const entries={'v3-stat-total':questions.length,'v3-stat-mastered':c.mastered,'v3-stat-wrong':c.wrong,'v3-stat-unknown':c.unknown,'v3-stat-unseen':c.unseen,'v3-stat-done':lessonDone()};
 for(const [id,v] of Object.entries(entries)){const el=document.getElementById(id);if(el)el.textContent=String(v);}
 for(const el of $$('[data-v3-bank-count]'))el.textContent=`${c.mastered} / ${questions.length} 정복`;
 const fill=$('#v3-mastered-bar');if(fill)fill.style.width=(questions.length?c.mastered/questions.length*100:0)+'%';
 const entryGrid=$('.v3-entry-grid');if(entryGrid)entryGrid.classList.toggle('is-concepts-done',lessonDone()===15);
 const resume=$('[data-go-practice]');if(resume)resume.textContent=lessonDone()===15?'계속 문제 풀기 →':'문제 풀이 시작하기 →';
}
function saveState(){write(stateKey(),states);refreshDashboard();}
function resetSession(){sessionSeen=new Set();lastAsked=new Map();sessionStep=0;currentQuestion=null;revealed=false;lastOutcome=null;selected=null;}
function chooseQuestion(){
 const pool=questions.filter(q=>status(q.id)!=='mastered'&&(currentTopic==='all'||q.topic===currentTopic)&&
 (currentMode!=='new'||status(q.id)==='unseen')&&(currentMode!=='review'||['wrong','unknown'].includes(status(q.id))));
 if(!pool.length)return {type:'empty'};
 let available=pool.filter(q=>!sessionSeen.has(q.id));
 if(!available.length)return {type:'session-end'};
 let eligible=available.filter(q=>sessionStep-(lastAsked.get(q.id)??-999)>=4);
 if(eligible.length)available=eligible;
 const unseen=available.filter(q=>status(q.id)==='unseen');const review=available.filter(q=>status(q.id)!=='unseen');
 let selectedPool=available;
 if(currentMode==='mixed'&&unseen.length&&review.length)selectedPool=(sessionStep%4===3)?review:unseen;
 const q=selectedPool[Math.floor(Math.random()*selectedPool.length)];
 sessionSeen.add(q.id);lastAsked.set(q.id,sessionStep++);return {type:'question',question:q};
}
function navQuestion(){if(!questions.length){renderLoadError();return;}
 const next=chooseQuestion();currentQuestion=next.type==='question'?next.question:null;selected=null;revealed=false;lastOutcome=null;renderQuestion(next);
}
function renderLoadError(){const root=$('#practice-app');if(!root)return;
 root.innerHTML=`<div class="v3-page-heading"><span class="v3-eyebrow">QUESTION BANK</span><h1>문제은행을 불러올 수 없어요.</h1><p>${escapeHtml(bankFetchError||'네트워크 연결을 확인해 주세요.')}</p><button type="button" class="v3-btn-primary" data-bank-reload>다시 불러오기</button></div>`;}
function renderQuestion(obj){const root=$('#practice-app');if(!root)return;
 const c=counts();const heading=`<div class="v3-bank-head"><div><span class="v3-eyebrow">PRACTICE / 문제은행</span><h1>계속 문제 풀기<span class="v3-period">.</span></h1><p>정복한 문제는 다시 나오지 않고, 오답과 모름은 복습 큐에 남아요.</p></div><div class="v3-sync"><span class="v3-dot"></span><span data-bank-status>${profile?'클라우드 기록 확인 중':'이 기기에 저장'}</span></div></div>
 <div class="v3-stat-line"><span>남은 새 문제 <b>${c.unseen}</b></span><span>오답 <b>${c.wrong}</b></span><span>모름 <b>${c.unknown}</b></span><span>정복 <b>${c.mastered}</b></span></div>
 <div class="v3-bank-filters"><div class="v3-segment" role="group" aria-label="문제 풀이 모드"><button data-bank-mode="mixed" class="${currentMode==='mixed'?'active':''}">계속 풀기</button><button data-bank-mode="new" class="${currentMode==='new'?'active':''}">새 문제만</button><button data-bank-mode="review" class="${currentMode==='review'?'active':''}">오답·모름</button></div><label class="v3-topic-filter">유형 <select id="v3-topic-select"><option value="all">전체 유형</option>${[...new Set(questions.map(q=>q.topic))].map(t=>`<option value="${escapeHtml(t)}" ${currentTopic===t?'selected':''}>${escapeHtml(questions.find(q=>q.topic===t).topic_label)}</option>`).join('')}</select></label></div>`;
 if(obj.type==='empty'){
 let total=questions.filter(q=>currentTopic==='all'||q.topic===currentTopic).length;
 let message=currentMode==='review'?'복습할 오답·모름 문제가 없어요.':'현재 모드에서 풀 문제가 남지 않았어요.';
 if(currentMode!=='review'&&c.mastered===questions.length)message='모든 문제를 정복했어요. 새 데이터팩이 추가되면 여기서 다시 시작할 수 있어요.';
 root.innerHTML=heading+`<div class="v3-empty-state"><div class="v3-empty-icon">✓</div><h2>${message}</h2><p>전체 ${questions.length}문항 · 이 유형 ${total}문항</p><button class="v3-btn-secondary" data-bank-mode="mixed">전체 유형으로 돌아가기</button></div>`;return;
 }
 if(obj.type==='session-end'){
 root.innerHTML=heading+`<div class="v3-empty-state"><div class="v3-empty-icon">↻</div><h2>이번 세션에서 볼 문제를 모두 풀었어요.</h2><p>정복한 문제를 제외하고 새 세션을 시작하면 남은 오답·모름을 다시 볼 수 있어요.</p><button class="v3-btn-primary" data-bank-next-session>다음 세션 시작</button></div>`;return;
 }
 const q=obj.question;
 const tables=q.input_tables?.length?`<section class="v3-context"><div class="v3-mini-heading">INPUT · 입력 데이터</div><div class="v3-input-grid">${q.input_tables.map(renderTable).join('')}</div></section>`:'';
 const sql=q.sql?`<section class="v3-context"><div class="v3-mini-heading">QUERY · 실행할 SQL</div><pre class="v3-sql" tabindex="0"><code>${escapeHtml(q.sql)}</code></pre></section>`:'';
 root.innerHTML=heading+`<article class="v3-question-card"><div class="v3-question-meta"><span>${escapeHtml(q.subject)} / ${escapeHtml(q.topic_label)}</span><span>${escapeHtml(q.difficulty)} · 자체 제작 · ${escapeHtml(q.dbms)}</span></div><div class="v3-question-number">이번 세션 ${sessionStep}번 문제</div><h2>${escapeHtml(q.stem)}</h2>${tables}${sql}<fieldset class="v3-answers" id="v3-answer-set"><legend>하나의 정답을 선택하세요</legend>${q.choices.map((c,i)=>`<label class="v3-choice" data-choice="${i}"><input type="radio" name="v3-choice" value="${i}"><span class="v3-choice-index">${'ABCD'[i]}</span><span>${escapeHtml(c)}</span></label>`).join('')}</fieldset><div class="v3-question-actions"><button type="button" class="v3-btn-unknown" data-bank-unknown>모르겠어요</button><button type="button" class="v3-btn-primary" data-bank-submit disabled>정답 제출 <span aria-hidden="true">→</span></button></div><div class="v3-feedback" id="v3-feedback" hidden></div></article><p class="v3-source-note">본 문제은행은 복원 기출 원문이 아닌 자체 제작·검증 문제입니다. 일부 SQL은 표준 SQL 또는 Oracle 기준의 개념 문제이며 DBMS에 따라 문법이 다를 수 있어요.</p>`;
 updateStatusDisplays();
}
function updateStatusDisplays(){let label=profile?(pending.length?'동기화 대기 중':'Google 계정 연결됨'):'이 기기에 저장';setNotice(label);}
function renderFeedback(q,assessment){const fb=$('#v3-feedback');if(!fb)return;
 const label=assessment==='mastered'?'정답 · 정복 완료':assessment==='unknown'?'모름으로 저장됨':'오답 · 복습 대상으로 저장됨';
 const cls=assessment==='mastered'?'success':assessment==='unknown'?'neutral':'error';
 fb.innerHTML=`<div class="v3-feedback-header ${cls}"><strong>${label}</strong><span>${assessment==='mastered'?'이 문제는 다시 출제하지 않아요.':'나중에 다시 출제돼요.'}</span></div><div class="v3-answer-key">정답 · <strong>${'ABCD'[q.answer]}</strong> ${escapeHtml(q.choices[q.answer])}</div><div class="v3-explanation"><span class="v3-mini-heading">WHY · 왜 이 답일까요?</span><p>${escapeHtml(q.explanation)}</p>${q.steps?.length?`<ol class="v3-explain-steps">${q.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>`:''}${q.result_table?`<div class="v3-mini-heading">RESULT · 최종 결과</div>${renderTable({...q.result_table,name:'실행 결과'})}`:''}</div><div class="v3-feedback-actions"><button class="v3-btn-secondary" type="button" data-bank-related="${escapeHtml(q.topic)}">관련 개념 찾기</button><button type="button" class="v3-btn-primary" data-bank-next>다음 문제 →</button></div>`;
 fb.hidden=false;
 $$('.v3-choice').forEach((el,i)=>{el.classList.toggle('correct',i===q.answer);el.classList.toggle('incorrect',i===selected&&i!==q.answer);el.querySelector('input').disabled=true;});
 const actions=$('.v3-question-actions');if(actions)actions.hidden=true;
 fb.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function saveAnswer(outcome){if(busy||revealed||!currentQuestion)return;
 const q=currentQuestion;if(outcome!=='unknown'&&selected===null)return;
 busy=true;revealed=true;lastOutcome=outcome;
 const existing=states[q.id]||{status:'unseen',attempt_count:0,wrong_count:0,unknown_count:0};
 const finalStatus=existing.status==='mastered'?'mastered':outcome;
 states[q.id]={...existing,status:finalStatus,attempt_count:(existing.attempt_count||0)+1,wrong_count:(existing.wrong_count||0)+(outcome==='wrong'?1:0),unknown_count:(existing.unknown_count||0)+(outcome==='unknown'?1:0),last_selected:outcome==='unknown'?null:selected,updated_at:new Date().toISOString(),...(finalStatus==='mastered'?{mastered_at:new Date().toISOString()}:{})};
 saveState();renderFeedback(q,outcome);
 if(profile){pending.push({id:q.id,result:outcome,selected:outcome==='unknown'?null:selected});write(K_PENDING(profile.id),pending);flushPending();}
 else setNotice('이 기기에 저장됨');busy=false;
}
async function flushPending(){if(!profile||!client||flushing||!navigator.onLine||!pending.length)return;
 const uid=profile.id;flushing=true;setNotice('클라우드 저장 중…');
 try{
  while(pending.length&&profile?.id===uid){let event=pending[0];
    const {data,error}=await client.rpc('sqld_record_answer',{p_question_id:event.id,p_status:event.result,p_selected:event.selected});
    if(error)throw error;
    if(profile?.id!==uid)break;
    pending.shift();write(K_PENDING(uid),pending);
    if(data&&typeof data==='object'&&data.question_id){let prev=states[data.question_id]||{};
      states[data.question_id]={...prev,...data};saveState();
    }
  }
  if(profile?.id===uid)setNotice('클라우드에 저장됨');
 }catch(e){console.warn('SQLD practice cloud sync',e);setNotice('동기화 실패 · 다시 시도',true)}
 finally{flushing=false;}
}
function mergeRemote(remote,local){const combined={...remote};
 for(const [id,value] of Object.entries(local||{})){
    if(!questionMap.has(id))continue;
    if(!combined[id])combined[id]=value;
    else if(combined[id].status!=='mastered'&&value.status==='mastered')combined[id]=value;
 }
 return combined;
}
async function onAuth(event){const user=event?.detail?.user||null;
 client=event?.detail?.client||window.sqldCloudClient||client;
 if((profile?.id||null)===(user?.id||null))return;
 profile=user;
 if(!user){pending=[];states=read(K_GUEST,{});refreshDashboard();updateStatusDisplays();if(inBank())navQuestion();return;}
 const uid=user.id;setNotice('기록 불러오는 중…');pending=read(K_PENDING(uid),[]);let cache=read(K_USER(uid),{});
 if(!client){states=cache;saveState();setNotice('계정 인증 모듈 연결 오류',true);return;}
 const {data,error}=await client.from('sqld_question_states').select('question_id,status,attempt_count,wrong_count,unknown_count,last_selected,mastered_at,updated_at').limit(3000);
 if(profile?.id!==uid)return;
 if(error){states=cache;saveState();setNotice('클라우드 불러오기 실패 · 다시 시도',true);return;}
 const remote=Object.fromEntries((data||[]).filter(x=>questionMap.has(x.question_id)).map(x=>[x.question_id,x]));
 // If the account already has progress, never silently transfer another account's local work.
 const guest=read(K_GUEST,{});let importGuest=false;
 if(Object.keys(guest).length)importGuest=window.confirm('이 기기에서 로그인 없이 푼 문제 기록을 현재 Google 계정으로 가져올까요?');
 if(importGuest){for(const [id,v] of Object.entries(guest)){
  if(questionMap.has(id)&&remote[id]?.status!=='mastered')pending.push({id,result:v.status,selected:v.last_selected??null});
 }write(K_PENDING(uid),pending);write(K_GUEST,{});}
 states=mergeRemote(remote,cache);
 // An unsynced cached attempt may have mastered a question: keep it until pending flush.
 for(const e of pending){let v=cache[e.id]||guest[e.id];if(v&&questionMap.has(e.id)&&remote[e.id]?.status!=='mastered')states[e.id]=v;}
 write(K_USER(uid),states);refreshDashboard();updateStatusDisplays();if(inBank())navQuestion();await flushPending();
}
function navigateBank(mode='mixed',topic='all'){currentMode=mode;currentTopic=topic;resetSession();const target=mode==='review'?'#review':'#practice';if(location.hash!==target)location.hash=target;else navQuestion();}
function route(){const hash=currentRoute();const root=$('#practice-app'),sup=$('#supplement-app');if(!root||!sup)return;
 const bank=inBank(),extras=inSupplement();root.hidden=!bank;sup.hidden=!extras;
 if(bank){const mode=hash==='review'?'review':currentMode;if(mode!==currentMode){currentMode=mode;resetSession();} if(!currentQuestion)navQuestion();else {renderQuestion({type:'question',question:currentQuestion});if(revealed&&lastOutcome)renderFeedback(currentQuestion,lastOutcome);}document.title='SQLD 문제은행 | SQLD NOTE';}
 if(extras){renderSupplements();document.title='보충 개념 | SQLD NOTE';}
 $$('.v3-bottom-nav a,.v3-side-top a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')==='#practice'&&bank)||(a.getAttribute('href')==='#supplement'&&extras)||(a.getAttribute('href')==='#home'&&hash==='home')||(a.getAttribute('href')==='#c01'&&/^c\d+/.test(hash))));
 $$('.v3-side-top a').forEach(a=>a.classList.toggle('v3-active',a.classList.contains('active')));
}
function renderSupplements(){const root=$('#supplement-app');if(!root)return;const hash=currentRoute(),id=hash.includes('/')?hash.split('/')[1]:null;
 let z=supplements.find(x=>x.id===id);if(!z){root.innerHTML=`<div class="v3-bank-head"><div><span class="v3-eyebrow">LEARNING LIBRARY</span><h1>보충 개념<span class="v3-period">.</span></h1><p>기존 핵심 15개 단원 밖의 자주 쓰는 문법을 실제 데이터로 이해해요.</p></div></div><div class="v3-supp-grid">${supplements.map(x=>`<a class="v3-supp-card" href="#supplement/${escapeHtml(x.id)}"><span>${escapeHtml(x.chapter)}</span><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.intro)}</p><span class="v3-supp-more">테이블과 예제로 배우기 →</span></a>`).join('')}</div>`;return;}
 root.innerHTML=`<div class="v3-bank-head"><div><button type="button" class="v3-back" data-supp-back>← 보충 개념 목록</button><span class="v3-eyebrow">${escapeHtml(z.chapter)}</span><h1>${escapeHtml(z.title)}</h1><p>${escapeHtml(z.intro)}</p></div></div><div class="v3-supp-detail"><div class="v3-mini-heading">01 · 먼저 이해할 순서</div><ol class="v3-explain-steps">${z.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol><div class="v3-mini-heading">02 · 실제 입력 테이블</div><div class="v3-input-grid">${z.tables.map(renderTable).join('')}</div><div class="v3-mini-heading">03 · SQL 실행</div><pre class="v3-sql" tabindex="0"><code>${escapeHtml(z.sql)}</code></pre><div class="v3-mini-heading">04 · 결과 테이블</div>${renderTable({...z.output,name:'실행 결과'})}<div class="v3-supp-trap"><strong>시험 함정</strong><p>${escapeHtml(z.trap)}</p></div><button class="v3-btn-primary" data-bank-topic="${escapeHtml(relatedTopic(z.id))}">관련 문제 풀기 →</button></div>`;
}
function relatedTopic(id){return ({case:'sql_function',set:'sql_set',pivot:'sql_pivot',regex:'sql_pivot',string:'sql_function',datetime:'sql_function',ddl:'sql_dml',groupings:'sql_rollup'})[id]||'all';}
function addDeepdives(data){for(const x of data){const lesson=$(`#c${String(x.chapter).padStart(2,'0')}`);if(!lesson)continue;
 const stage=lesson.querySelector('[data-stage="0"]');if(stage){const div=document.createElement('aside');div.className='v3-deepnote';div.innerHTML=`<div class="v3-deep-kicker">WHY IT WORKS · 원리 해설</div><p>${escapeHtml(x.why)}</p><details><summary>문제 푸는 순서와 실수 방지 팁 <span>펼치기 ↓</span></summary><div class="v3-deep-extra"><strong>판별 순서</strong><p>${escapeHtml(x.reading_order)}</p><strong>주의할 함정</strong><p>${escapeHtml(x.pitfall)}</p></div></details>`;const list=stage.querySelector('.principle-list');if(list)list.after(div);else stage.appendChild(div);}
 const trace=lesson.querySelector('.trace-list');if(trace&&trace.children.length>1){let items=[...trace.querySelectorAll('li')];items.forEach((it,i)=>it.classList.toggle('v3-current-trace',i===0));let step=0;
 const bar=document.createElement('div');bar.className='v3-trace-tools';bar.innerHTML=`<span class="v3-mini-heading">EXECUTION · 단계별 추적</span><div><button type="button" data-trace-prev aria-label="이전 실행 단계">←</button><b data-trace-current>1 / ${items.length}</b><button type="button" data-trace-next aria-label="다음 실행 단계">→</button></div>`;
 trace.before(bar);bar.addEventListener('click',e=>{if(!e.target.closest('[data-trace-prev],[data-trace-next]'))return;step=Math.max(0,Math.min(items.length-1,step+(e.target.closest('[data-trace-next]')?1:-1)));items.forEach((item,i)=>item.classList.toggle('v3-current-trace',i===step));bar.querySelector('[data-trace-current]').textContent=`${step+1} / ${items.length}`;items[step]?.scrollIntoView({block:'nearest',behavior:'smooth'});});
 }}
}
async function init(){
 try{
  const [bankRes,suppRes,deepRes]=await Promise.all([fetch(sourceUrl),fetch('/content/supplements.json'),fetch('/content/deepdives.json')]);
  if(!bankRes.ok)throw Error('문제 파일 HTTP '+bankRes.status);
  questions=await bankRes.json();questionMap=new Map(questions.map(q=>[q.id,q]));
  if(questionMap.size!==questions.length||questions.some(q=>!q.verified||q.choices?.length!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3))throw Error('문제 데이터 검증 오류');
  supplements=suppRes.ok?await suppRes.json():[];if(deepRes.ok)addDeepdives(await deepRes.json());
  states=loadLocal();refreshDashboard();setNotice('이 기기에 저장');
  if(inBank())navQuestion();if(inSupplement())renderSupplements();
 }catch(e){bankFetchError=e.message;console.warn('Question bank fetch',e);renderLoadError();}
 window.addEventListener('hashchange',route);
 document.addEventListener('sqld:localchange',refreshDashboard);
 document.addEventListener('click',onClick);
 document.addEventListener('change',e=>{
  if(e.target?.name==='v3-choice'){selected=Number(e.target.value);$$('.v3-choice').forEach(el=>el.classList.toggle('selected',Number(el.dataset.choice)===selected));const submit=$('[data-bank-submit]');if(submit)submit.disabled=false;}
  else if(e.target?.id==='v3-topic-select'){currentTopic=e.target.value;resetSession();navQuestion();}
 });
 window.addEventListener('sqld:authchange',onAuth);
 if(window.sqldCloudClient||window.sqldCloudUser)onAuth({detail:{user:window.sqldCloudUser||null,client:window.sqldCloudClient||null}});
 window.addEventListener('online',()=>{if(profile){setNotice('네트워크 연결됨 · 동기화 중');flushPending();}});
 route();
}
function onClick(e){const t=e.target.closest('button,a');if(!t)return;
 if(t.hasAttribute('data-go-practice')){e.preventDefault();navigateBank('mixed');}
 else if(t.hasAttribute('data-go-review')){e.preventDefault();navigateBank('review');}
 else if(t.hasAttribute('data-bank-mode')){currentTopic='all';navigateBank(t.dataset.bankMode);}
 else if(t.hasAttribute('data-bank-next-session')){resetSession();navQuestion();}
 else if(t.hasAttribute('data-bank-next'))navQuestion();
 else if(t.hasAttribute('data-bank-submit'))saveAnswer(selected===currentQuestion?.answer?'mastered':'wrong');
 else if(t.hasAttribute('data-bank-unknown'))saveAnswer('unknown');
 else if(t.hasAttribute('data-bank-reload')){location.reload();}
 else if(t.hasAttribute('data-bank-related')){location.hash='#home';document.querySelector('#search')?.focus();let q=questions.find(x=>x.topic===t.dataset.bankRelated);if(q){document.querySelector('#search').value=q.topic_label;document.querySelector('#search').dispatchEvent(new Event('input',{bubbles:true}));}}
 else if(t.hasAttribute('data-bank-topic'))navigateBank('mixed',t.dataset.bankTopic);
 else if(t.hasAttribute('data-supp-back'))location.hash='#supplement';
 else if(t.hasAttribute('data-bank-sync-retry')){if(profile)flushPending();else setNotice('Google 로그인 후 동기화 가능');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();