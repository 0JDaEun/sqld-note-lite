/* SQLD NOTE v3.1 — static problem bank and supplemental learning. No framework or service key. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LABEL={unseen:'새 문제',wrong:'오답',unknown:'모름',mastered:'정복'};
const K_GUEST='sqld_v3_guest_v1', K_USER=id=>'sqld_v3_cache_'+id, K_PENDING=id=>'sqld_v3_pending_'+id;
const sourceUrl='/questions/bank.json';
const PAGE_VERSION='3.5';
let questions=[], questionMap=new Map(), supplements=[], states={}, profile=null, client=null;
let selected=null, revealed=false, lastOutcome=null, currentQuestion=null, currentMode='mixed', currentTopic='all', currentDifficulty='all';
let sessionSeen=new Set(), sessionStep=0, busy=false, lastAsked=new Map(), pending=[], flushing=false, bankFetchError='';
let supplementId='';
let executionTraces=[];
let syllabusItems=[], quickCards=[], quickMap=new Map(), quickRefError='';
let requestedQuestion=null;
let authVersion=0,cloudReadFailed=false;
const LESSON_NAMES={1:'JOIN과 결과 행 수',2:'NULL과 3값 논리',3:'GROUP BY와 HAVING',4:'윈도우 함수',5:'서브쿼리와 EXISTS',6:'SQL 논리적 처리 순서',7:'DML·TCL·트랜잭션',8:'ERD·관계·차수',9:'식별자·PK/FK',10:'정규화와 함수 종속',11:'ROLLUP·CUBE·GROUPING',12:'계층형 질의',13:'NULL 처리·일반 함수',14:'TOP-N과 정렬',15:'3단계 스키마·데이터 독립성'};
function topicMatches(q,filter=currentTopic){if(filter.startsWith('ref:')){const item=syllabusItems.find(x=>x.id===filter.slice(4));return !!item&&item.practice_topics.includes(q.topic);}return filter==='all'||(filter.startsWith('lesson:')?(q.linked_chapters||[]).includes(Number(filter.split(':')[1])):q.topic===filter);}
function difficultyMatches(q){return currentDifficulty==='all'||q.difficulty?.startsWith(currentDifficulty+' ·');}
function linkedLesson(q){return (q.linked_chapters||[])[0]||null;}

const read=(key,def)=>{try{let v=JSON.parse(localStorage.getItem(key));return v??def;}catch{return def}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch(e){console.warn('Local save failed',e);}};
const stateKey=()=>profile?.id?K_USER(profile.id):K_GUEST;
const loadLocal=()=>read(stateKey(),{});
const setNotice=(label,error=false)=>{
 for(const el of $$('[data-bank-status]')){el.textContent=label;el.classList.toggle('is-error',error);}
 for(const btn of $$('[data-bank-sync-retry]'))btn.hidden=!(error&&profile);
};
const currentRoute=()=>location.hash.replace('#','');
const inBank=()=>['practice','review'].includes(currentRoute());
const inSupplement=()=>currentRoute().startsWith('supplement');
const inQuickReference=()=>currentRoute()==='quick-reference';
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
 renderWeaknessPanel();
 if(inQuickReference()&&syllabusItems.length)renderQuickReference();
 for(const el of $$('[data-v3-bank-count]'))el.textContent=`${c.mastered} / ${questions.length} 정복`;
 const fill=$('#v3-mastered-bar');if(fill)fill.style.width=(questions.length?c.mastered/questions.length*100:0)+'%';
 const entryGrid=$('.v3-entry-grid');if(entryGrid)entryGrid.classList.toggle('is-concepts-done',lessonDone()===15);
 const resume=$('[data-go-practice]');if(resume)resume.textContent=lessonDone()===15?'계속 문제 풀기 →':'문제 풀이 시작하기 →';refreshBridgeCounters();
}
function saveState(){write(stateKey(),states);refreshDashboard();}
function resetSession(){sessionSeen=new Set();lastAsked=new Map();sessionStep=0;currentQuestion=null;revealed=false;lastOutcome=null;selected=null;}
function chooseQuestion(){
 const pool=questions.filter(q=>status(q.id)!=='mastered'&&topicMatches(q)&&difficultyMatches(q)&&
 (currentMode!=='new'||status(q.id)==='unseen')&&(currentMode!=='review'||['wrong','unknown'].includes(status(q.id))));
 if(!pool.length)return {type:'empty'};
 let available=pool.filter(q=>!sessionSeen.has(q.id));
 if(!available.length)return {type:'session-end'};
 if(requestedQuestion){const q=available.find(x=>x.id===requestedQuestion);requestedQuestion=null;if(q){sessionSeen.add(q.id);lastAsked.set(q.id,sessionStep++);return {type:'question',question:q};}}
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
 const c=counts();const heading=`<div class="v3-bank-head"><div><span class="v3-eyebrow">PRACTICE / 문제은행</span><h1>계속 문제 풀기<span class="v3-period">.</span></h1><p>정복한 문제는 다시 나오지 않고, 오답과 모름은 복습 큐에 남아요.</p></div><div class="v3-sync"><span class="v3-dot"></span><span data-bank-status>${profile?'클라우드 기록 확인 중':'이 기기에 저장'}</span><button type="button" class="v33-sync-retry" data-bank-sync-retry hidden>다시 연결</button></div></div>
 <div class="v3-stat-line"><span>남은 새 문제 <b>${c.unseen}</b></span><span>오답 <b>${c.wrong}</b></span><span>모름 <b>${c.unknown}</b></span><span>정복 <b>${c.mastered}</b></span></div>
 <div class="v3-bank-filters"><div class="v3-segment" role="group" aria-label="문제 풀이 모드"><button data-bank-mode="mixed" class="${currentMode==='mixed'?'active':''}">계속 풀기</button><button data-bank-mode="new" class="${currentMode==='new'?'active':''}">새 문제만</button><button data-bank-mode="review" class="${currentMode==='review'?'active':''}">오답·모름</button></div><label class="v3-topic-filter">유형 <select id="v3-topic-select"><option value="all">전체 유형</option>${currentTopic.startsWith('ref:')?`<option value="${escapeHtml(currentTopic)}" selected>한 페이지 요약 · ${escapeHtml(syllabusItems.find(z=>z.id===currentTopic.slice(4))?.title||'학습 영역')}</option>`:''}${Object.entries(LESSON_NAMES).map(([n,label])=>`<option value="lesson:${n}" ${currentTopic==='lesson:'+n?'selected':''}>개념 ${String(n).padStart(2,'0')} · ${escapeHtml(label)}</option>`).join('')}${[...new Set(questions.map(q=>q.topic))].map(t=>`<option value="${escapeHtml(t)}" ${currentTopic===t?'selected':''}>${escapeHtml(questions.find(q=>q.topic===t).topic_label)}</option>`).join('')}</select></label><label class="v3-topic-filter">난이도 <select id="v34-difficulty"><option value="all" ${currentDifficulty==='all'?'selected':''}>전체 난이도</option>${['상','중','하'].map(level=>`<option value="${level}" ${currentDifficulty===level?'selected':''}>${level} · 예상</option>`).join('')}</select></label></div>`;
 if(obj.type==='empty'){
 let total=questions.filter(q=>topicMatches(q)&&difficultyMatches(q)).length;
 let message=currentMode==='review'?'복습할 오답·모름 문제가 없어요.':'현재 모드에서 풀 문제가 남지 않았어요.';
 if(currentMode!=='review'&&c.mastered===questions.length)message='모든 문제를 정복했어요. 새 데이터팩이 추가되면 여기서 다시 시작할 수 있어요.';
 root.innerHTML=heading+`<div class="v3-empty-state"><div class="v3-empty-icon">✓</div><h2>${message}</h2><p>전체 ${questions.length}문항 · 이 유형 ${total}문항</p><button class="v3-btn-secondary" data-bank-all>전체 유형으로 돌아가기</button></div>`;return;
 }
 if(obj.type==='session-end'){
 root.innerHTML=heading+`<div class="v3-empty-state"><div class="v3-empty-icon">↻</div><h2>이번 세션에서 볼 문제를 모두 풀었어요.</h2><p>정복한 문제를 제외하고 새 세션을 시작하면 남은 오답·모름을 다시 볼 수 있어요.</p><button class="v3-btn-primary" data-bank-next-session>다음 세션 시작</button></div>`;return;
 }
 const q=obj.question;
 const tables=q.input_tables?.length?`<section class="v3-context"><div class="v3-mini-heading">INPUT · 입력 데이터</div><div class="v3-input-grid">${q.input_tables.map(renderTable).join('')}</div></section>`:'';
 const sql=q.sql?`<section class="v3-context"><div class="v3-mini-heading">QUERY · 실행할 SQL</div><pre class="v3-sql" tabindex="0"><code>${escapeHtml(q.sql)}</code></pre></section>`:'';
 root.innerHTML=heading+`<article class="v3-question-card"><div class="v3-question-meta"><span>${escapeHtml(q.subject)} / ${escapeHtml(q.topic_label)}</span><span>${escapeHtml(q.question_type||'학습 문제')} · ${escapeHtml(q.difficulty||'난이도 미분류')} · 빈출도 미집계 · 자체 제작 · ${escapeHtml(q.dbms)}</span></div><div class="v3-question-number">이번 세션 ${sessionStep}번 문제</div><h2>${escapeHtml(q.stem)}</h2>${tables}${sql}<fieldset class="v3-answers" id="v3-answer-set"><legend>하나의 정답을 선택하세요</legend>${q.choices.map((c,i)=>`<label class="v3-choice" data-choice="${i}"><input type="radio" name="v3-choice" value="${i}"><span class="v3-choice-index">${'ABCD'[i]}</span><span>${escapeHtml(c)}</span></label>`).join('')}</fieldset><div class="v3-question-actions"><button type="button" class="v3-btn-unknown" data-bank-unknown>모르겠어요</button><button type="button" class="v3-btn-primary" data-bank-submit disabled>정답 제출 <span aria-hidden="true">→</span></button></div><div class="v3-feedback" id="v3-feedback" hidden></div></article><p class="v3-source-note">모든 문제는 자체 제작이며 난이도는 예상 등급입니다. 빈출도는 회차별 근거가 확보되지 않아 미집계합니다. <a href="https://sqldyangpa.com/" target="_blank" rel="noopener noreferrer">별도 연습: SQLD양파</a> (문제·해설 원문 미수록).</p>`;
 updateStatusDisplays();
}
function updateStatusDisplays(){let label=profile?(pending.length?'동기화 대기 중':'Google 계정 연결됨'):'이 기기에 저장';setNotice(label);}
function renderFeedback(q,assessment){const fb=$('#v3-feedback');if(!fb)return;
 const label=assessment==='mastered'?'정답 · 정복 완료':assessment==='unknown'?'모름으로 저장됨':'오답 · 복습 대상으로 저장됨';
 const cls=assessment==='mastered'?'success':assessment==='unknown'?'neutral':'error';
 const optionReview=['individual_editorial_review','hand_authored'].includes(q.option_note_method)
  ?'보기별 해설: 개별 편집 검수':'보기별 해설: 규칙 기반 초안 · 개별 검수 진행 중';
 const evidence=q.verification_method==='sql_executed'
  ?'SQL 실행 데이터 검증':'개념·DBMS 기준 편집 검토 (해당 DBMS 실제 실행 미검증)';
 fb.innerHTML=`<div class="v3-feedback-header ${cls}"><strong>${label}</strong><span>${assessment==='mastered'?'이 문제는 다시 출제하지 않아요.':'나중에 다시 출제돼요.'}</span></div><div class="v3-answer-key">정답 · <strong>${'ABCD'[q.answer]}</strong> ${escapeHtml(q.choices[q.answer])}</div><div class="v3-explanation"><span class="v3-mini-heading">WHY · 왜 이 답일까요?</span><p>${escapeHtml(q.explanation)}</p>${q.steps?.length?`<ol class="v3-explain-steps">${q.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol>`:''}${q.execution_output?`<div class="v3-mini-heading">${q.verification_method==='sql_executed'?'SQL RESULT · 실행 검증 결과':'EXPECTED RESULT · 개념 기준 예상 결과'}</div>${renderTable({...q.execution_output,name:q.verification_method==='sql_executed'?'검증된 SQL 출력':'예상 출력 · 편집 검토'})}`:q.result_table?`<div class="v3-mini-heading">RESULT · 최종 결과</div>${renderTable({...q.result_table,name:'실행 결과'})}`:''}${q.execution_output&&q.result_table?.rows?.[0]?`<p class="v31-result-answer"><b>문제에서 요구한 계산값</b> ${escapeHtml(q.result_table.rows[0][0])}</p>`:''}${Array.isArray(q.option_explanations)&&q.option_explanations.some(Boolean)?`<div class="v31-option-notes"><strong>보기별 판단 근거</strong>${q.option_explanations.map((reason,i)=>reason?`<p><b>${'ABCD'[i]}.</b> ${escapeHtml(reason)}</p>`:'').join('')}</div>`:''}<p class="v33-audit-note">${escapeHtml(evidence)} · ${escapeHtml(optionReview)}</p></div><div class="v3-feedback-actions"><button class="v3-btn-secondary" type="button" data-bank-related="${escapeHtml(q.topic)}">${linkedLesson(q)?`개념 ${String(linkedLesson(q)).padStart(2,'0')} 복습하기`:'관련 보충 개념 보기'}</button><button type="button" class="v3-btn-primary" data-bank-next>다음 문제 →</button></div>`;
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
 finally{flushing=false;if(profile?.id!==uid&&profile&&pending.length)queueMicrotask(flushPending);}
}
function mergeRemote(remote,cache,queued,guest){
 // Server wins unless a local attempt is explicitly queued and has not yet reached the server.
 const combined={...remote};
 for(const event of queued){
  const id=event.id;if(!questionMap.has(id)||remote[id]?.status==='mastered')continue;
  const local=(cache||{})[id]||(guest||{})[id];
  if(local)combined[id]={...local};
 }
 return combined;
}
async function onAuth(event,force=false){
 const user=event?.detail?.user||null;
 client=event?.detail?.client||window.sqldCloudClient||client;
 if(!force&&(profile?.id||null)===(user?.id||null))return;
 const version=++authVersion;
 profile=user;
 if(!user){pending=[];cloudReadFailed=false;states=read(K_GUEST,{});refreshDashboard();updateStatusDisplays();if(inBank())navQuestion();return;}
 const uid=user.id;cloudReadFailed=false;setNotice('기록 불러오는 중…');
 pending=read(K_PENDING(uid),[]);
 let cache=read(K_USER(uid),{});
 // An existing account cache stays available while the read is pending.
 states=cache;refreshDashboard();
 if(!client){cloudReadFailed=true;setNotice('계정 인증 모듈 연결 오류',true);return;}
 let data,error;
 try{({data,error}=await client.from('sqld_question_states').select('question_id,status,attempt_count,wrong_count,unknown_count,last_selected,mastered_at,updated_at').limit(3000));}
 catch(e){error=e;}
 if(profile?.id!==uid||version!==authVersion)return;
 if(error){cloudReadFailed=true;setNotice('클라우드 불러오기 실패 · 다시 연결',true);return;}
 const remote=Object.fromEntries((data||[]).filter(x=>questionMap.has(x.question_id)).map(x=>[x.question_id,x]));
 const guest=read(K_GUEST,{});let importGuest=false;
 if(Object.keys(guest).length)importGuest=window.confirm('이 기기에서 로그인 없이 푼 문제 기록을 현재 Google 계정으로 가져올까요?');
 if(profile?.id!==uid||version!==authVersion)return;
 if(importGuest){for(const [id,v] of Object.entries(guest)){
  if(questionMap.has(id)&&remote[id]?.status!=='mastered')pending.push({id,result:v.status,selected:v.last_selected??null});
 }write(K_PENDING(uid),pending);write(K_GUEST,{});}
 // Read current cache *after* network awaits: responses cannot discard answers entered meanwhile.
 cache=read(K_USER(uid),{});
 const queuedIds=new Set(pending.map(e=>e.id));
 for(const [id,v] of Object.entries(cache)){
  if(!questionMap.has(id)||queuedIds.has(id)||remote[id]?.status==='mastered')continue;
  // Backward-compatible recovery for older local-only progress and locally mastered answers.
  if(!remote[id]||v.status==='mastered'&&remote[id]?.status!=='mastered'){
   pending.push({id,result:v.status,selected:v.last_selected??null});queuedIds.add(id);
  }
 }
 if(pending.length)write(K_PENDING(uid),pending);
 states=mergeRemote(remote,cache,pending,guest);
 write(K_USER(uid),states);refreshDashboard();updateStatusDisplays();if(inBank())navQuestion();
 await flushPending();
}
function navigateBank(mode='mixed',topic='all',questionId=null,difficulty='all'){currentMode=mode;currentTopic=topic;currentDifficulty=difficulty;resetSession();requestedQuestion=questionId;const target=mode==='review'?'#review':'#practice';if(location.hash!==target)location.hash=target;else navQuestion();}
function route(){const hash=currentRoute();const root=$('#practice-app'),sup=$('#supplement-app'),quickRoot=$('#quick-reference');if(!root||!sup||!quickRoot)return;
 const bank=inBank(),extras=inSupplement(),quick=inQuickReference();root.hidden=!bank;sup.hidden=!extras;quickRoot.hidden=!quick;document.body.classList.toggle('v35-quick-open',quick);
 if(quick){renderQuickReference();document.title='전체 개념 한 페이지 | SQLD NOTE v3.5';}
 if(bank){const mode=hash==='review'?'review':currentMode;if(mode!==currentMode){currentMode=mode;resetSession();} if(!currentQuestion)navQuestion();else {renderQuestion({type:'question',question:currentQuestion});if(revealed&&lastOutcome)renderFeedback(currentQuestion,lastOutcome);}document.title='SQLD 문제은행 | SQLD NOTE';}
 if(extras){renderSupplements();document.title='보충 개념 | SQLD NOTE';}
 $$('.v3-bottom-nav a,.v3-side-top a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')==='#practice'&&bank)||(a.getAttribute('href')==='#supplement'&&extras)||(a.getAttribute('href')==='#quick-reference'&&quick)||(a.getAttribute('href')==='#home'&&hash==='home')||(a.getAttribute('href')==='#c01'&&/^c\d+/.test(hash))));
 $$('.v3-side-top a').forEach(a=>a.classList.toggle('v3-active',a.classList.contains('active')));
}
function renderSupplements(){const root=$('#supplement-app');if(!root)return;const hash=currentRoute(),id=hash.includes('/')?hash.split('/')[1]:null;
 let z=supplements.find(x=>x.id===id);if(!z){root.innerHTML=`<div class="v3-bank-head"><div><span class="v3-eyebrow">LEARNING LIBRARY</span><h1>보충 개념<span class="v3-period">.</span></h1><p>기존 핵심 15개 단원 밖의 자주 쓰는 문법을 실제 데이터로 이해해요.</p></div></div><div class="v3-supp-grid">${supplements.map(x=>`<a class="v3-supp-card" href="#supplement/${escapeHtml(x.id)}"><span>${escapeHtml(x.chapter)}</span><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.intro)}</p><span class="v3-supp-more">테이블과 예제로 배우기 →</span></a>`).join('')}</div>`;return;}
 root.innerHTML=`<div class="v3-bank-head"><div><button type="button" class="v3-back" data-supp-back>← 보충 개념 목록</button><span class="v3-eyebrow">${escapeHtml(z.chapter)}</span><h1>${escapeHtml(z.title)}</h1><p>${escapeHtml(z.intro)}</p></div></div><div class="v3-supp-detail"><div class="v3-mini-heading">01 · 먼저 이해할 순서</div><ol class="v3-explain-steps">${z.steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ol><div class="v3-mini-heading">02 · 실제 입력 테이블</div><div class="v3-input-grid">${z.tables.map(renderTable).join('')}</div><div class="v3-mini-heading">03 · SQL 실행</div><pre class="v3-sql" tabindex="0"><code>${escapeHtml(z.sql)}</code></pre><div class="v3-mini-heading">04 · 결과 테이블</div>${renderTable({...z.output,name:'실행 결과'})}<div class="v3-supp-trap"><strong>시험 함정</strong><p>${escapeHtml(z.trap)}</p></div><button class="v3-btn-primary" data-bank-topic="${escapeHtml(relatedTopic(z.id))}">관련 문제 풀기 →</button></div>`;
 const linked=supplementQuestions(z.id); const b=root.querySelector('[data-bank-topic]');if(b){b.textContent=linked.length?`유형 문제 ${linked.length}개 계속 풀기 →`:'전용 문제 보강 예정';b.disabled=!linked.length;}
 if(linked.length){const preview=document.createElement('section');preview.className='v31-supp-practice';preview.innerHTML=`<div class="v3-mini-heading">05 · 학습 내용 적용하기</div><p>아래 실전 문제는 이 보충 단원과 직접 연결돼 있어요.</p><div class="v31-bank-preview">${linked.slice(0,3).map(q=>`<button type="button" class="v31-preview-item" data-bank-exact="${escapeHtml(q.id)}" data-bank-filter="${escapeHtml(q.topic)}" ${status(q.id)==='mastered'?'disabled':''}><span class="v31-preview-tag">${escapeHtml(LABEL[status(q.id)])}</span><strong>${escapeHtml(q.stem)}</strong><span class="v31-preview-end">${status(q.id)==='mastered'?'정복 완료':'풀어보기 →'}</span></button>`).join('')}</div>`;root.querySelector('.v3-supp-detail')?.append(preview);}
}
function supplementQuestions(id){return questions.filter(q=>{
 if(q.supplement_id===id)return true;
 const st=q.stem||'';switch(id){
  case 'case':return q.topic==='sql_function'&&(st.includes('CASE')||q.sql?.includes('CASE'));
  case 'string':return q.topic==='sql_function'&&/SUBSTR|문자/.test(st);
  case 'datetime':return q.topic==='sql_datetime'||q.topic==='sql_function'&&/날짜|일자|TO_DATE|SYSDATE/.test(st);
  case 'set':return q.topic==='sql_set';
  case 'pivot':return q.topic==='sql_pivot'&&/PIVOT|UNPIVOT/.test(st);
  case 'regex':return q.topic==='sql_regex';
  case 'ddl':return q.topic==='sql_dml';
  case 'groupings':return q.topic==='sql_rollup';
  case 'model-transaction':return q.topic==='model_transaction';
  case 'model-null-attribute':return q.topic==='model_null_attribute';
  case 'model-key-origin':return q.topic==='model_key_origin';
  case 'model-attribute':return q.topic==='model_attribute';
  case 'sql-standard-join':return q.topic==='sql_standard_join';
 }return false;});}
function relatedTopic(id){return ({case:'sql_function',set:'sql_set',pivot:'sql_pivot',regex:'sql_regex',string:'sql_function',datetime:'sql_datetime',ddl:'sql_dml',groupings:'sql_rollup','model-transaction':'model_transaction','model-null-attribute':'model_null_attribute','model-key-origin':'model_key_origin','model-attribute':'model_attribute','sql-standard-join':'sql_standard_join'})[id]||'all';}
function addDeepdives(data){for(const x of data){const lesson=$(`#c${String(x.chapter).padStart(2,'0')}`);if(!lesson)continue;
 const stage=lesson.querySelector('[data-stage="0"]');if(stage){const div=document.createElement('aside');div.className='v3-deepnote';div.innerHTML=`<div class="v3-deep-kicker">WHY IT WORKS · 원리 해설</div><p>${escapeHtml(x.why)}</p><details><summary>문제 푸는 순서와 실수 방지 팁 <span>펼치기 ↓</span></summary><div class="v3-deep-extra"><strong>판별 순서</strong><p>${escapeHtml(x.reading_order)}</p><strong>주의할 함정</strong><p>${escapeHtml(x.pitfall)}</p></div></details>`;const list=stage.querySelector('.principle-list');if(list)list.after(div);else stage.appendChild(div);}

 }
}

/* v3.2 · Intermediate query-state viewer. Each snapshot comes from human-readable
   trace data; conceptual snapshots are explicitly labeled, never claimed as raw SQL output. */
function addExecutionTraces(items){
 executionTraces=items;
 for(const item of items){
  const lesson=$(`#c${String(item.chapter).padStart(2,'0')}`), stage=lesson?.querySelector('[data-stage="1"]');
  const trace=stage?.querySelector('.trace-list');if(!trace||stage.querySelector('.v32-execution'))continue;
  const panel=document.createElement('section');panel.className='v32-execution';panel.setAttribute('aria-label','단계별 데이터 변화');
  let step=0;
  function render(){
   const active=item.steps[step];
   panel.innerHTML=`<div class="v32-exec-head"><div><span class="v3-mini-heading">STEP TRACE · 단계별 데이터 변화</span><h3>${escapeHtml(item.title)}</h3></div><span class="v32-step-counter">${step+1} / ${item.steps.length}</span></div>
   <div class="v32-step-tabs" role="group" aria-label="SQL 계산 단계 선택">${item.steps.map((st,i)=>`<button type="button" data-exec-step="${i}" class="${step===i?'active':''}" aria-pressed="${step===i}">${String(i+1).padStart(2,'0')} ${escapeHtml(st.title)}</button>`).join('')}</div>
   <div class="v32-step-body" aria-live="polite" aria-atomic="true"><strong>${escapeHtml(active.title)}</strong><p>${escapeHtml(active.note)}</p>${renderTable({name:active.table_label,columns:active.columns,rows:active.rows})}</div>
   <div class="v32-step-nav"><button type="button" data-exec-prev ${step===0?'disabled':''}>← 이전 단계</button><button type="button" data-exec-next ${step===item.steps.length-1?'disabled':''}>다음 단계 →</button></div>`;
   trace.querySelectorAll('li').forEach((li,i)=>li.classList.toggle('v3-current-trace',i===step));
  }
  panel.addEventListener('click',e=>{
   const t=e.target.closest('button');if(!t)return;
   const next=t.hasAttribute('data-exec-step')?Number(t.dataset.execStep):t.hasAttribute('data-exec-next')?step+1:t.hasAttribute('data-exec-prev')?step-1:step;
   if(next<0||next>=item.steps.length||next===step)return;step=next;render();
  });
  trace.after(panel);render();
 }
}
/* Topic weakness summary is calculated solely from saved answer states. */
function mountWeaknessPanel(){
 const host=$('.v3-entry-grid');if(!host||$('#v32-weak-topics'))return;
 const panel=document.createElement('section');panel.id='v32-weak-topics';panel.className='v32-weak-panel';
 panel.setAttribute('aria-label','취약 유형별 복습');host.after(panel);
}
function renderWeaknessPanel(){
 const panel=$('#v32-weak-topics');if(!panel)return;
 const grouped=new Map();for(const q of questions){
  const key=q.topic, item=grouped.get(key)||{topic:key,label:q.topic_label,total:0,wrong:0,unknown:0,mastered:0};
  item.total++;const state=status(q.id);if(state in item)item[state]++;grouped.set(key,item);
 }
 const weak=[...grouped.values()].filter(t=>t.wrong||t.unknown).sort((a,b)=>(b.wrong+b.unknown)-(a.wrong+a.unknown)||a.label.localeCompare(b.label,'ko')).slice(0,5);
 panel.innerHTML=`<div class="v32-weak-header"><div><span class="v3-mini-heading">TARGETED REVIEW</span><h2>취약 유형 집중 복습</h2></div><span>오답·모름을 우선 정리해요</span></div>`+
 (weak.length?`<div class="v32-weak-grid">${weak.map(t=>`<button type="button" data-bank-weak-topic="${escapeHtml(t.topic)}"><strong>${escapeHtml(t.label)}</strong><span>오답 ${t.wrong} · 모름 ${t.unknown} · 정복 ${t.mastered}/${t.total}</span><i>복습하기 →</i></button>`).join('')}</div>`:
 `<p class="v32-weak-empty">아직 취약 유형 기록이 없어요. 문제를 풀고 오답·모름이 생기면 여기서 바로 복습할 수 있어요.</p>`);
}

/* v3.1: concrete learning visuals, contextual question-bank step and linked practice. */
function renderVisual(v){
 let center='';
 if(v.kind==='equation')center=`<div class="v31-visual-equation">${(v.parts||[]).map((p,i)=>`<div class="v31-equation-part"><small>${escapeHtml(p.label)}</small><strong>${escapeHtml(p.value)}</strong><span>${escapeHtml(p.detail)}</span></div>${i<(v.parts.length-1)?`<b class="v31-math-sign">${i===0?'+':'='}</b>`:''}`).join('')}</div>`;
 else if(v.kind==='table')center=`<div class="v31-mini-scroll"><table class="v31-mini-table"><thead><tr>${v.columns.map(c=>`<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${v.rows.map(row=>`<tr>${row.map(x=>`<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 else if(v.kind==='flow')center=`<ol class="v31-visual-flow">${v.nodes.map(([a,b],i)=>`<li><span class="v31-flow-index">${i+1}</span><div><strong>${escapeHtml(a)}</strong><small>${escapeHtml(b)}</small></div></li>`).join('')}</ol>`;
 else if(v.kind==='split')center=`<div class="v31-visual-split"><div class="v31-visual-side">${v.left.map((x,i)=>`<${i===0?'strong':'span'}>${escapeHtml(x)}</${i===0?'strong':'span'}>`).join('')}</div><div class="v31-visual-connector">${escapeHtml(v.connector)}</div><div class="v31-visual-side">${v.right.map((x,i)=>`<${i===0?'strong':'span'}>${escapeHtml(x)}</${i===0?'strong':'span'}>`).join('')}</div></div>`;
 else if(v.kind==='tree')center=`<div class="v31-tree">${v.nodes.map(([label,level,indent])=>`<div class="v31-tree-node" style="--indent:${indent}"><span>LEVEL ${level}</span><strong>${escapeHtml(label)}</strong></div>`).join('')}</div>`;
 return `<section class="v31-concept-visual" aria-label="${escapeHtml(v.title)}"><div class="v31-viz-kicker">VISUAL MODEL · 한눈에 이해하기</div><h3>${escapeHtml(v.title)}</h3>${center}<p class="v31-viz-caption">${escapeHtml(v.caption)}</p></section>`;
}
function addLessonVisuals(visuals){for(const v of visuals){const lesson=$(`#c${String(v.chapter).padStart(2,'0')}`),stage=lesson?.querySelector('[data-stage="0"]');if(!stage)continue;
 const wrapper=document.createElement('div');wrapper.innerHTML=renderVisual(v);
 const visual=wrapper.firstElementChild;const key=stage.querySelector('.key-sentence');if(key)key.after(visual);else stage.append(visual);
}}
function chapterQuestions(n){return questions.filter(q=>(q.linked_chapters||[]).includes(n));}
function refreshBridgeCounters(){for(const lesson of $$('.lesson')){const n=Number(lesson.dataset.lesson);const bank=lesson.querySelector('.v31-linked-bank');if(!bank)continue;
 const a=chapterQuestions(n),c={unseen:0,wrong:0,unknown:0,mastered:0};a.forEach(q=>{if(status(q.id) in c)c[status(q.id)]++;});
 const b=bank.querySelector('[data-linked-counts]');if(b)b.textContent=`${a.length}문항 · 정복 ${c.mastered} · 오답 ${c.wrong} · 모름 ${c.unknown} · 새 문제 ${c.unseen}`;
 const preview=bank.querySelector('.v31-bank-preview');if(!preview)continue;
 const available=[...a].sort((x,y)=>Number(status(x.id)==='mastered')-Number(status(y.id)==='mastered'));
 const sample=[];const add=x=>{if(x&&!sample.includes(x))sample.push(x)};
 add(available.find(x=>!x.sql));add(available.find(x=>x.sql));
 for(const x of available){if(sample.length>=4)break;add(x);}
 
 preview.innerHTML=sample.map(q=>`<button type="button" class="v31-preview-item" data-bank-exact="${escapeHtml(q.id)}" data-chapter="${n}" ${status(q.id)==='mastered'?'disabled':''}><span class="v31-preview-tag">${escapeHtml(q.question_type||'확인 문제')} · ${escapeHtml(LABEL[status(q.id)])}</span><strong>${escapeHtml(q.stem)}</strong><span class="v31-preview-end">${status(q.id)==='mastered'?'정복 완료':'풀어보기 →'}</span></button>`).join('');
 }}
function addLessonBridges(){for(let n=1;n<=15;n++){const lesson=$(`#c${String(n).padStart(2,'0')}`);if(!lesson||lesson.querySelector('.v31-linked-bank'))continue;
 const count=chapterQuestions(n).length,nav=lesson.querySelector('.stage-tabs'),footer=lesson.querySelector('.step-footer');if(!nav||!footer)continue;
 const tab=document.createElement('button');tab.type='button';tab.className='stage-tab v31-bank-tab';tab.dataset.stageBtn='4';tab.innerHTML='<span>05</span> 실전';nav.append(tab);
 const stage=document.createElement('div');stage.className='stage v31-linked-bank';stage.dataset.stage='4';stage.hidden=true;
 stage.innerHTML=`<div class="section-kicker">05 / RELATED PRACTICE</div><h2>이 개념의 실전 문제를 풀어요.</h2><p class="section-desc">원리와 예제·함정·확인 문제를 이해했다면 실제 유형 문제로 적용해 보세요. 정답은 정복 처리되어 다시 나오지 않습니다.</p><div class="v31-linked-summary"><strong>${escapeHtml(LESSON_NAMES[n])}</strong><p data-linked-counts>${count}문항</p></div><div class="v31-bank-preview" aria-label="연관 문제 미리보기"></div><button type="button" data-bank-lesson="${n}" class="v3-btn-primary v31-bridge-cta">이 개념의 실전 문제 ${count}개 풀기 →</button><p class="v31-bridge-help">오답과 모르는 문제는 별도 복습 목록에 남아요. 관련 개념은 문제 해설에서도 다시 열 수 있어요.</p>`;
 footer.before(stage);const total=footer.querySelector('[data-total-stage]');if(total)total.textContent='5';
 }refreshBridgeCounters();}

/* v3.5: evidence-aware, single-scroll 30-topic reference; no separate user DB state. */
function renderQuickReference(){
 const host=$('#quick-reference');if(!host||host.hidden)return;
 if(!syllabusItems.length){host.innerHTML=`<div class="v35-ref-error"><h1>전체 개념 요약을 불러오지 못했어요.</h1><p>${escapeHtml(quickRefError||'콘텐츠 연결을 확인해 주세요.')}</p><button type="button" class="v3-btn-secondary" data-bank-reload>새로고침</button></div>`;return;}
 const partInfo=[['model','1과목 · 데이터 모델링','10개'],['basic','2과목 · SQL 기본','8개'],['usage','2과목 · SQL 활용','8개'],['manage','2과목 · 관리 구문','4개']];
 const questionStatus=part=>{
  const ids=new Set(part.practice_topics||[]);const selected=questions.filter(q=>ids.has(q.topic));const c={total:selected.length,mastered:0,wrong:0,unknown:0};selected.forEach(q=>{const t=status(q.id);if(t in c)c[t]++;});return c;
 };
 host.innerHTML=`<div class="v35-quick-lead"><div><span class="v3-eyebrow">QUICK REFERENCE · SQLD v3.5</span><h1>전체 개념, 한 페이지로.</h1><p>2024년 개편 범위를 30개 학습 항목으로 재구성했어요. 핵심 규칙을 읽고, 헷갈리는 조건은 미니 예제로 확인한 뒤 해당 문제를 풀어 보세요.</p></div><div class="v35-quick-stats"><strong>30<span>개</span></strong><small>1과목 10 · SQL 기본 8<br>SQL 활용 8 · 관리 4</small></div></div>
 <div class="v35-quick-method"><div><strong>범위 포함</strong><span>시험 범위에 속하는 개념</span></div><div><strong>우선 보강</strong><span>내부 감사에서 미흡했던 영역</span></div><div><strong>빈출 미집계</strong><span>실제 복원 회차별 근거 미확보</span></div><div><strong>나의 취약</strong><span>내 오답·모름 기록 기반</span></div></div>
 <div class="v35-quick-controls"><nav class="v35-part-tabs" aria-label="과목별 바로 이동">${partInfo.map(([id,label,n])=>`<button type="button" data-v35-scroll="${id}">${escapeHtml(label)}<small>${n}</small></button>`).join('')}</nav><label class="v35-search-wrap"><span class="v35-search-icon" aria-hidden="true">⌕</span><input type="search" id="v35-quick-search" autocomplete="off" placeholder="개념·문법·함정 검색" aria-label="개념·문법·함정 검색"><span id="v35-ref-count" aria-live="polite">30 / 30</span></label><button type="button" class="v35-expand-all" data-v35-expand-all="open">예제 모두 펼치기</button></div>
 <div class="v35-parts">${partInfo.map(([part,label,num])=>`<section class="v35-part" id="v35-part-${part}" data-v35-part="${part}"><header class="v35-part-head"><div><span class="v3-eyebrow">${part==='model'?'PART 01':part==='basic'?'PART 02':part==='usage'?'PART 03':'PART 04'}</span><h2>${escapeHtml(label)}</h2></div><small>${num} · 공식 범위 기반 학습 묶음</small></header><div class="v35-card-grid">${syllabusItems.filter(z=>z.part===part).map(z=>{
 const c=quickMap.get(z.id)||{},score=questionStatus(z),mini=c.mini_example||{},freq=z.frequency||{};
 const primary=z.supplement_ref?'#supplement/'+encodeURIComponent(z.supplement_ref):(z.lesson_ref?'#'+z.lesson_ref:'#supplement');
 const extra=z.supplement_ref&&z.lesson_ref?'#'+z.lesson_ref:null;
 const reviewCount=score.wrong+score.unknown;
 const details=mini.table?.rows?.length?renderTable({...mini.table,name:'미니 데이터·판별 표'}):'';
 const search=[z.title,...(z.keywords||[]),c.key_rule,c.trap,c.decision_check].join(' ').toLowerCase();
 return `<article class="v35-concept-card" data-v35-search="${escapeHtml(search)}"><div class="v35-card-top"><span class="v35-card-index">${String(z.order).padStart(2,'0')}</span><div class="v35-card-chips"><span class="v35-chip">범위 포함</span>${z.priority==='high'?'<span class="v35-chip v35-priority">우선 보강</span>':''}</div></div><h3>${escapeHtml(z.title)}</h3><div class="v35-card-main"><div><span class="v35-hint-label">핵심 규칙</span><p class="v35-card-rule">${escapeHtml(c.key_rule)}</p></div><div><span class="v35-hint-label">판별 질문</span><p>${escapeHtml(c.decision_check)}</p></div><div class="v35-trap"><span class="v35-hint-label">시험 함정</span><p>${escapeHtml(c.trap)}</p></div></div><details class="v35-example"><summary>미니 예제 · 실제 조건 비교 <span aria-hidden="true">⌄</span></summary><div class="v35-example-body"><div class="v35-mini-scenario">${escapeHtml(mini.context)}</div>${details}<div class="v35-mini-query">${escapeHtml(mini.expression)}</div><div class="v35-mini-result"><small>판별 결과</small><strong>${escapeHtml(mini.result)}</strong></div><p>${escapeHtml(mini.reason)}</p></div></details><div class="v35-card-evidence"><span>빈출도 <b>${freq.status==='unmeasured'?'미집계':'근거 확인 필요'}</b></span><span>연관 ${score.total}문제 · 정복 ${score.mastered}</span>${reviewCount?`<span class="v35-weak-count">오답·모름 ${reviewCount}</span>`:''}</div><div class="v35-card-actions"><a href="${primary}" class="v35-deep-link">${z.supplement_ref?'예제로 깊게 배우기':'핵심 개념 보기'} ↗</a>${extra?`<a class="v35-sub-link" href="${extra}">기존 단원</a>`:''}<button type="button" data-v35-bank="ref:${escapeHtml(z.id)}" ${score.total===0?'disabled':''}>관련 문제 ${score.total}개 →</button>${reviewCount?`<button class="v35-review-link" type="button" data-v35-review="ref:${escapeHtml(z.id)}">내 오답 복습 ↻</button>`:''}</div></article>`;
 }).join('')}</div></section>`).join('')}</div>
 <div class="v35-quick-footer"><div><strong>이 요약을 사용하는 순서</strong><p>핵심 규칙 → 판별 질문 → 함정 → 미니 예제 → 관련 문제. 정답은 정복 처리되어 기본 출제에서 제외돼요.</p></div><a href="#practice">전체 문제은행 가기 →</a><a href="#supplement">보충 단원 13개 보기 →</a><button type="button" data-v35-print class="v35-print">요약 인쇄 ↗</button><small>범위 구성 근거: 2024년 SQLD 제52회 개편 비교표(2023.10 교육기관 게시). 세부 출제 빈도는 독립 회차 검증 전까지 미집계. 모든 카드는 학습용 편집 요약이며 공식 문제 원문이 아니에요.</small></div>`;
}
function filterQuickReference(raw){const term=String(raw||'').toLowerCase().trim();let shown=0;
 $$('.v35-concept-card').forEach(card=>{const match=!term||card.dataset.v35Search.includes(term);card.hidden=!match;if(match)shown++;});
 $$('.v35-part').forEach(part=>{part.hidden=!part.querySelector('.v35-concept-card:not([hidden])');});
 const count=$('#v35-ref-count');if(count)count.textContent=`${shown} / 30`;
}
let v35PrintState=null;
window.addEventListener('beforeprint',()=>{v35PrintState=$$('#quick-reference details.v35-example').map(x=>x.open);$$('#quick-reference details.v35-example').forEach(x=>x.open=true);});
window.addEventListener('afterprint',()=>{if(v35PrintState)$$('#quick-reference details.v35-example').forEach((x,i)=>{x.open=!!v35PrintState[i];});v35PrintState=null;});

async function init(){
 try{
  const [bankRes,suppRes,deepRes,visualRes,traceRes,syllabusRes,quickRes]=await Promise.all([fetch(sourceUrl),fetch('/content/supplements.json'),fetch('/content/deepdives.json'),fetch('/content/visuals.json'),fetch('/content/execution_traces.json'),fetch('/content/syllabus.json'),fetch('/content/quick_reference.json')]);
  if(!bankRes.ok)throw Error('문제 파일 HTTP '+bankRes.status);
  questions=await bankRes.json();questionMap=new Map(questions.map(q=>[q.id,q]));
  if(!Array.isArray(questions)||questionMap.size!==questions.length||questions.some(q=>!q.verified||!/^qv3_[a-z0-9_]{1,64}$/.test(q.id)||q.choices?.length!==4||!Number.isInteger(q.answer)||q.answer<0||q.answer>3||!Array.isArray(q.option_explanations)||q.option_explanations.length!==4))throw Error('문제 데이터 검증 오류');
  supplements=suppRes.ok?await suppRes.json():[];
  try{if(!syllabusRes.ok||!quickRes.ok)throw Error('요약 데이터 요청 실패');const sc=await syllabusRes.json(),qc=await quickRes.json();if(sc.items?.length!==30||qc.cards?.length!==30)throw Error('요약 항목 수 오류');const ids=new Set(sc.items.map(x=>x.id));if(ids.size!==30||qc.cards.some(x=>!ids.has(x.id)))throw Error('요약 ID 정합성 오류');syllabusItems=sc.items;quickCards=qc.cards;quickMap=new Map(qc.cards.map(x=>[x.id,x]));}catch(e){quickRefError=e.message;console.warn('Quick reference data:',e);}
  if(deepRes.ok)addDeepdives(await deepRes.json());if(visualRes.ok)addLessonVisuals(await visualRes.json());if(traceRes.ok)addExecutionTraces(await traceRes.json());addLessonBridges();mountWeaknessPanel();
  states=loadLocal();refreshDashboard();setNotice('이 기기에 저장');
  if(inBank())navQuestion();if(inSupplement())renderSupplements();if(inQuickReference())renderQuickReference();
 }catch(e){bankFetchError=e.message;console.warn('Question bank fetch',e);renderLoadError();}
 window.addEventListener('hashchange',route);
 document.addEventListener('sqld:localchange',refreshDashboard);
 document.addEventListener('click',onClick);
 document.addEventListener('input',e=>{if(e.target?.id==='v35-quick-search')filterQuickReference(e.target.value);});
 document.addEventListener('change',e=>{
  if(e.target?.name==='v3-choice'){selected=Number(e.target.value);$$('.v3-choice').forEach(el=>el.classList.toggle('selected',Number(el.dataset.choice)===selected));const submit=$('[data-bank-submit]');if(submit)submit.disabled=false;}
  else if(e.target?.id==='v3-topic-select'){currentTopic=e.target.value;resetSession();navQuestion();}
  else if(e.target?.id==='v34-difficulty'){currentDifficulty=e.target.value;resetSession();navQuestion();}
 });
 window.addEventListener('sqld:authchange',onAuth);
 if(window.sqldCloudClient||window.sqldCloudUser)onAuth({detail:{user:window.sqldCloudUser||null,client:window.sqldCloudClient||null}});
 window.addEventListener('online',()=>{if(profile){setNotice('네트워크 연결됨 · 동기화 중');flushPending();}});
 route();
}
function onClick(e){const t=e.target.closest('button,a');if(!t)return;
 if(t.hasAttribute('data-v35-scroll')){document.getElementById('v35-part-'+t.dataset.v35Scroll)?.scrollIntoView({behavior:'smooth',block:'start'});}
 else if(t.hasAttribute('data-v35-bank')){navigateBank('mixed',t.dataset.v35Bank);}
 else if(t.hasAttribute('data-v35-review')){navigateBank('review',t.dataset.v35Review);}
 else if(t.hasAttribute('data-v35-print')){window.print();}
 else if(t.hasAttribute('data-v35-expand-all')){const open=t.dataset.v35ExpandAll==='open';$$('#quick-reference details.v35-example').forEach(x=>x.open=open);t.dataset.v35ExpandAll=open?'close':'open';t.textContent=open?'예제 모두 접기':'예제 모두 펼치기';}
 else if(t.hasAttribute('data-go-practice')){e.preventDefault();navigateBank('mixed');}
 else if(t.hasAttribute('data-go-review')){e.preventDefault();navigateBank('review');}
 else if(t.hasAttribute('data-bank-mode')){navigateBank(t.dataset.bankMode,currentTopic,null,currentDifficulty);}
 else if(t.hasAttribute('data-bank-all'))navigateBank('mixed','all');
 else if(t.hasAttribute('data-bank-next-session')){resetSession();navQuestion();}
 else if(t.hasAttribute('data-bank-next'))navQuestion();
 else if(t.hasAttribute('data-bank-lesson'))navigateBank('mixed','lesson:'+t.dataset.bankLesson);
 else if(t.hasAttribute('data-bank-exact'))navigateBank('mixed',t.dataset.bankFilter||'lesson:'+t.dataset.chapter,t.dataset.bankExact);
 else if(t.hasAttribute('data-bank-submit'))saveAnswer(selected===currentQuestion?.answer?'mastered':'wrong');
 else if(t.hasAttribute('data-bank-unknown'))saveAnswer('unknown');
 else if(t.hasAttribute('data-bank-reload')){location.reload();}
 else if(t.hasAttribute('data-bank-related')){const chapter=linkedLesson(currentQuestion||{});if(chapter){location.hash='#c'+String(chapter).padStart(2,'0');}else{const q=currentQuestion||{},topic=q.topic;location.hash='#supplement/'+(q.supplement_id||(topic==='sql_set'?'set':topic==='sql_regex'?'regex':topic==='sql_datetime'?'datetime':topic==='sql_pivot'?'pivot':topic==='sql_function'?'case':topic==='sql_dml'?'ddl':'case'));}}
 else if(t.hasAttribute('data-bank-topic'))navigateBank('mixed',t.dataset.bankTopic);
 else if(t.hasAttribute('data-bank-weak-topic'))navigateBank('review',t.dataset.bankWeakTopic);
 else if(t.hasAttribute('data-supp-back'))location.hash='#supplement';
 else if(t.hasAttribute('data-bank-sync-retry')){if(profile){if(cloudReadFailed)void onAuth({detail:{user:profile,client}},true);else void flushPending();}else setNotice('Google 로그인 후 동기화 가능');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
