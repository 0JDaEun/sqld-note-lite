/* SQLD NOTE v3.6: optional, local-only 50Q/90min timed mock examination. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='sqld_mock_exam_v1', HISTORY='sqld_mock_history_v1';
let exam=null, timer=null, lastRender=0;
const bank=()=>window.sqldBankForMock?.()||[];
const get=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
const put=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val));return true;}catch(e){console.warn('Mock local save',e);return false;}};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const range=Array.from({length:4},(_,i)=>i);
const readableTime=sec=>`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
const remaining=()=>exam?Math.max(0,Math.ceil((exam.expiresAt-Date.now())/1000)):0;
const active=()=>location.hash==='#mock';
const done=e=>e&&typeof e.finishedAt==='number';
function diversify(pool,n,quotas){
 let selected=[],picked=new Set(),topicCount={};
 function take(count,kind){for(let i=0;i<count;i++){
  let candidates=pool.filter(q=>!picked.has(q.id)&&(!kind||q.difficulty?.startsWith(kind+' ·')));
  if(!candidates.length)break;
  let min=Math.min(...candidates.map(q=>topicCount[q.topic]||0));
  const best=shuffle(candidates.filter(q=>(topicCount[q.topic]||0)===min))[0];
  selected.push(best);picked.add(best.id);topicCount[best.topic]=(topicCount[best.topic]||0)+1;
 }}
 for(const [level,k] of quotas)take(k,level);
 take(n-selected.length,null);
 if(selected.length!==n)throw Error('모의고사 과목별 문항 수 부족');
 return shuffle(selected);
}
function start(){const qs=bank(),model=qs.filter(q=>q.subject==='데이터 모델링'),sql=qs.filter(q=>q.subject==='SQL 기본 및 활용');
 if(model.length<10||sql.length<40){alert('문제은행을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');return;}
 if(exam&&!done(exam)&&!confirm('진행 중인 모의고사를 포기하고 새 시험을 시작할까요?'))return;
 const chosen=[...diversify(model,10,[['상',5],['중',4],['하',1]]),...diversify(sql,40,[['상',16],['중',20],['하',4]])];
 const startAt=Date.now();exam={version:1,bankVersion:'3.6',startedAt:startAt,expiresAt:startAt+90*60*1000,
  finishedAt:null,finishReason:null,index:0,entries:chosen.map(q=>({id:q.id,order:shuffle(range),selected:null,flagged:false}))};
 put(KEY,exam);render();tick();
}
function readExam(){const saved=get(KEY);if(!saved||!Array.isArray(saved.entries)||saved.entries.length!==50)return null;
 if(saved.entries.some((x,i)=>!bank().some(q=>q.id===x.id)||!Array.isArray(x.order)||x.order.length!==4||new Set(x.order).size!==4))return null;
 if(!Number.isFinite(saved.expiresAt)||!Number.isFinite(saved.startedAt))return null;
 return saved;
}
function save(){put(KEY,exam);}
function stats(){let correct=[0,0],answered=[0,0];for(let i=0;i<exam.entries.length;i++){
 const e=exam.entries[i],q=bank().find(z=>z.id===e.id),p=i<10?0:1;
 if(e.selected!==null){answered[p]++;if(e.selected===q.answer)correct[p]++;}
 }return {correct,answered,points:2*(correct[0]+correct[1]),pass:correct[0]>=4&&correct[1]>=16&&correct[0]+correct[1]>=30};}
function finish(reason='manual'){
 if(!exam||done(exam))return;
 const m=stats();exam.finishedAt=Date.now();exam.finishReason=reason;exam.score=m.points;exam.passed=m.pass;
 save();const history=get(HISTORY)||[];history.unshift({id:exam.startedAt,date:exam.finishedAt,score:m.points,pass:m.pass,model:m.correct[0],sql:m.correct[1]});put(HISTORY,history.slice(0,10));render();
}
function table(t){if(!t)return '';return `<div class="v36-table"><div class="v36-table-name">${esc(t.name||'INPUT')}</div><div class="v36-overflow"><table><thead><tr>${t.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r=>`<tr>${r.map(x=>`<td>${x===null?'<span class="v36-null">NULL</span>':esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;}
function questionMarkup(q){return `${q.input_tables?.length?`<div class="v36-sql-section"><span class="v36-mini">INPUT DATA · 입력표</span><div class="v36-table-grid">${q.input_tables.map(table).join('')}</div></div>`:''}${q.sql?`<div class="v36-sql-section"><span class="v36-mini">QUERY · SQL</span><pre class="v36-sql"><code>${esc(q.sql)}</code></pre></div>`:''}`;}
function header(){const history=get(HISTORY)||[];return `<div class="v36-mock-intro"><span class="v3-eyebrow">SQLD / TIMED EXAM</span><h1>실전 모의고사<span class="v3-period">.</span></h1><p>1과목 10문항 · 2과목 40문항 · 총 50문항 · 90분</p><p class="v36-privacy">모의고사 기록은 이 기기에만 저장돼요. 일반 문제은행의 정복·오답·모름 기록은 변경되지 않아요.</p>${history.length?`<div class="v36-history">최근 점수 <strong>${history[0].score}점</strong> · ${history[0].pass?'합격 기준 충족':'합격 기준 미충족'} · ${new Date(history[0].date).toLocaleDateString('ko-KR')}</div>`:''}</div>`;}
function intro(){return header()+`<div class="v36-start"><h2>시험처럼 풀고, 과목별로 분석해요.</h2><div class="v36-start-steps"><div><b>01</b> 시작과 동시에 90분 측정</div><div><b>02</b> 문제 이동 · 답안 변경 · 다시 볼 문제 표시</div><div><b>03</b> 제출 또는 시간 만료 후 일괄 채점</div></div><div class="v36-requirements"><span>총점 <b>60점 이상</b></span><span>1과목 <b>4문항 이상</b></span><span>2과목 <b>16문항 이상</b></span></div><p>난이도는 예상 등급이며, 공개 기출 원문이 아닌 자체 제작 문제은행에서 출제돼요. 모의고사는 정복한 문제도 포함할 수 있어요.</p><button class="v3-btn-primary v36-start-btn" type="button" data-mock-start>50문항 모의고사 시작 →</button></div>`;}
function inProgress(){const entry=exam.entries[exam.index],q=bank().find(x=>x.id===entry.id),s=stats(),total=s.answered[0]+s.answered[1],remainingS=remaining();
 const head=`<div class="v36-topline"><div><span class="v3-eyebrow">MOCK EXAM · ${exam.index<10?'1과목 데이터 모델링':'2과목 SQL 기본 및 활용'}</span><h1>실전 모의고사</h1></div><div class="v36-clock" id="v36-clock" role="timer" aria-label="남은 시간">${readableTime(remainingS)}</div></div>
 <div class="v36-progress"><span>문제 ${exam.index+1} / 50</span><span>${total}개 답안 선택 · ${50-total}개 미응답</span></div><div class="v36-progress-track"><span style="width:${total*2}%"></span></div>`;
 const navigation=`<div class="v36-navigation" aria-label="문제 번호 이동">${exam.entries.map((x,i)=>`<button type="button" title="${i+1}번 ${x.selected===null?'미응답':'응답'}${x.flagged?' · 표시됨':''}" data-mock-jump="${i}" class="${i===exam.index?'current':''} ${x.selected!==null?'answered':''} ${x.flagged?'flagged':''}" aria-current="${i===exam.index?'step':'false'}">${i+1}</button>`).join('')}</div>`;
 return head+`<div class="v36-mock-layout"><div class="v36-question"><div class="v36-question-meta"><span>Q${String(exam.index+1).padStart(2,'0')} · ${esc(q.topic_label)}</span><span>${esc(q.difficulty||'예상 난이도 미분류')}</span></div><h2>${esc(q.stem)}</h2>${questionMarkup(q)}<fieldset class="v36-options"><legend>정답 하나를 선택하세요</legend>${entry.order.map((oldIdx,i)=>`<label class="v36-option ${entry.selected===oldIdx?'picked':''}"><input type="radio" name="mock-answer" value="${oldIdx}" ${entry.selected===oldIdx?'checked':''}><span class="v36-letter">${'ABCD'[i]}</span><span>${esc(q.choices[oldIdx])}</span></label>`).join('')}</fieldset><div class="v36-actions"><button type="button" class="v36-flag ${entry.flagged?'on':''}" data-mock-flag>${entry.flagged?'표시 해제':'다시 볼 문제 표시'}</button><div class="v36-step-actions"><button type="button" class="v3-btn-secondary" data-mock-prev ${exam.index===0?'disabled':''}>← 이전</button><button type="button" class="v3-btn-primary" data-mock-next>${exam.index===49?'마지막 문제':'다음 →'}</button></div></div></div><aside class="v36-sidebar"><div class="v36-sidebar-top"><strong>답안 현황</strong><span>파랑: 응답 · 점: 표시</span></div>${navigation}<button type="button" class="v36-submit" data-mock-submit>답안 제출하고 채점하기</button><p>미응답도 오답 처리돼요. 시험 종료 후 정답과 해설이 공개돼요.</p></aside></div>`;
}
function results(){const s=stats(),graded=exam.entries.map((e,i)=>({entry:e,index:i,question:bank().find(x=>x.id===e.id),ok:e.selected===bank().find(x=>x.id===e.id).answer}));
 const unattempted=graded.filter(x=>x.entry.selected===null).length;
 const groups=[{title:'데이터 모델링',got:s.correct[0],total:10,min:4},{title:'SQL 기본 및 활용',got:s.correct[1],total:40,min:16}];
 const chips=groups.map(g=>`<div class="v36-score-part"><span>${g.title}</span><strong>${g.got*2} / ${g.total*2}점</strong><small>${g.got}/${g.total} 정답 · 과락선 ${g.min*2}점</small></div>`).join('');
 const misses=graded.filter(x=>!x.ok),byTopic={};misses.forEach(x=>{const t=x.question.topic_label;byTopic[t]=(byTopic[t]||0)+1;});const weak=Object.entries(byTopic).sort((a,b)=>b[1]-a[1]).slice(0,5);
 return `<div class="v36-result-head"><span class="v3-eyebrow">MOCK EXAM / RESULT</span><h1>${s.pass?'합격 기준 충족':'합격 기준 미충족'}</h1><div class="v36-final-score">${s.points}<span> / 100점</span></div><p>총점 60점 이상, 1과목 8점 이상, 2과목 32점 이상 모두 충족해야 합격 기준이에요.</p><p>${exam.finishReason==='timeout'?'제한 시간이 종료되어 자동 제출됐어요.':'직접 제출한 결과예요.'} · 미응답 ${unattempted}문항</p></div><div class="v36-score-grid">${chips}</div><div class="v36-after"><h2>취약 유형</h2><div class="v36-weak-tags">${weak.length?weak.map(([n,k])=>`<span>${esc(n)} · ${k}문항</span>`).join(''):'모든 문제를 정답으로 처리했어요.'}</div><p>결과는 이 기기에 저장되고, 평소 문제은행의 정복 기록과는 분리돼요.</p><div class="v36-after-actions"><button type="button" class="v3-btn-primary" data-mock-restart>새 모의고사 시작 →</button><a class="v3-btn-secondary" href="#quick-reference">전체 개념 복습 ↗</a></div></div><section class="v36-review"><h2>문항별 채점과 해설</h2><p>오답과 미응답을 먼저 배치했어. 항목을 펼치면 선택·정답·해설을 확인할 수 있어.</p>${[...misses,...graded.filter(x=>x.ok)].map(x=>{const q=x.question,e=x.entry;return `<details class="v36-reviewed ${x.ok?'is-correct':'is-wrong'}"><summary><span>${x.ok?'정답':'오답'} · ${x.index+1}번 · ${esc(q.topic_label)}</span><strong>${esc(q.stem)}</strong></summary><div class="v36-review-body"><p>선택: <b>${e.selected===null?'미응답':esc(q.choices[e.selected])}</b></p><p>정답: <b>${esc(q.choices[q.answer])}</b></p>${questionMarkup(q)}<div class="v36-review-why"><strong>핵심 풀이</strong><p>${esc(q.explanation)}</p>${q.steps?.length?`<ol>${q.steps.map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`:''}</div>${q.linked_chapters?.length?`<a class="v36-concept-link" href="#c${String(q.linked_chapters[0]).padStart(2,'0')}">관련 핵심 개념 복습 →</a>`:''}</div></details>`;}).join('')}</section>`;
}
function render(){const root=$('#mock-app');if(!root)return;root.hidden=!active();if(!active())return;
 const qs=bank();if(!qs.length){root.innerHTML='<div class="v36-start"><h2>문제은행을 불러오는 중이에요.</h2></div>';return;}
 if(!exam)exam=readExam();
 if(exam&&!done(exam)&&remaining()===0)finish('timeout');
 root.innerHTML=(!exam?intro():done(exam)?results():inProgress());lastRender=Date.now();document.title='실전 모의고사 | SQLD NOTE';
}
function tick(){if(!exam||done(exam))return;if(remaining()===0){finish('timeout');return;}
 const clock=$('#v36-clock');if(clock)clock.textContent=readableTime(remaining());
}
function click(e){const t=e.target.closest('button');if(!t||!active())return;
 if(t.hasAttribute('data-mock-start')){start();return;}
 if(!exam||done(exam)){if(t.hasAttribute('data-mock-restart'))start();return;}
 if(t.hasAttribute('data-mock-jump')){exam.index=Number(t.dataset.mockJump);save();render();}
 else if(t.hasAttribute('data-mock-prev')){exam.index=Math.max(0,exam.index-1);save();render();}
 else if(t.hasAttribute('data-mock-next')){exam.index=Math.min(49,exam.index+1);save();render();}
 else if(t.hasAttribute('data-mock-flag')){const v=exam.entries[exam.index];v.flagged=!v.flagged;save();render();}
 else if(t.hasAttribute('data-mock-submit')){const s=stats(),count=50-s.answered[0]-s.answered[1];if(confirm(count?`미응답 ${count}문항이 있어요. 제출하면 정답과 해설이 공개되고 다시 수정할 수 없어요. 제출할까요?`:'지금 제출하고 채점할까요?'))finish('manual');}
}
function change(e){if(!active()||!exam||done(exam)||e.target?.name!=='mock-answer')return;
 const value=Number(e.target.value);if(!range.includes(value))return;
 exam.entries[exam.index].selected=value;save();render();
}
function init(){exam=readExam();document.addEventListener('click',click);document.addEventListener('change',change);
 window.addEventListener('hashchange',render);window.addEventListener('sqld:bankready',()=>{exam=readExam();render();});
 timer=setInterval(tick,1000);render();
}
window.sqldMockUI={render};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
