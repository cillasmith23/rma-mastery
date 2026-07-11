const $=s=>document.querySelector(s),app=$('#app');
let bank=[],generalBank=[],adminBank=[],clinicalBank=[],activeArea='general',activeQuiz=null,currentIndex=0,answers={},confidence={},checked={},mode='study',route='home',timerId=null,timeLeft=0;
const D={attempts:[],missed:[],favorites:[],theme:'light',topicStats:{},confidenceStats:{high:0,medium:0,guess:0},studyDates:[]};
const state=Object.assign({},D,JSON.parse(localStorage.getItem('rmaStateV12')||'{}'));
document.documentElement.dataset.theme=state.theme;

function save(){localStorage.setItem('rmaStateV12',JSON.stringify(state))}
function go(r){stopTimer();route=r;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.route===r));render();scrollTo(0,0)}
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>go(b.dataset.route));
$('#themeBtn').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;save()};
const sh=a=>[...a].sort(()=>Math.random()-.5),pct=(n,d)=>d?Math.round(n/d*100):0;
function todayKey(){return new Date().toISOString().slice(0,10)}
function recordStudyDay(){let d=todayKey();if(!state.studyDates.includes(d)){state.studyDates.push(d);state.studyDates=state.studyDates.slice(-60);save()}}
function streak(){
  let set=new Set(state.studyDates),n=0,d=new Date();
  while(set.has(d.toISOString().slice(0,10))){n++;d.setDate(d.getDate()-1)}
  return n;
}
async function init(){
  try{[generalBank,adminBank,clinicalBank]=await Promise.all([fetch('questions-general.json').then(r=>r.json()),fetch('questions-admin.json').then(r=>r.json()),fetch('questions-clinical.json').then(r=>r.json())]);bank=generalBank}
  catch(e){app.innerHTML='<section class="card warning"><h2>Question bank could not load</h2><p>Refresh after GitHub Pages finishes deploying.</p></section>';return}
  render();
  if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js').catch(()=>{});
}
function render(){({home,study,quiz:quizMenu,saved,progress}[route]||home)()}
function home(){
  let best=state.attempts.length?Math.max(...state.attempts.map(a=>a.score)):0,total=state.attempts.reduce((s,a)=>s+a.total,0);
  app.innerHTML=`<section class="hero"><h1>Learn. Practice. Succeed.</h1><span class="version-chip">Version 3.0</span><p>All three RMA work areas are now available.</p></section>
  <section class="grid">
    <article class="card card-button" onclick="selectArea('general')"><span class="badge">Work Area I</span><h2>General Medical Assisting</h2><p>65 questions • Body Systems, Terminology, Law & Ethics, Human Relations.</p></article>
    <article class="card card-button" onclick="selectArea('admin')"><span class="badge">New</span><h2>Administrative Medical Assisting</h2><p>30 questions • Insurance, Coding, Scheduling, Records, Safety.</p></article>
    <article class="card card-button" onclick="selectArea('clinical')"><span class="badge">New</span><h2>Clinical Medical Assisting</h2><p>115 questions • Infection Control, Lab, Vital Signs, Pharmacology, ECG, First Aid.</p></article>
    <article class="card card-button" onclick="go('progress')"><h2>Progress & Analytics</h2><p>Review scores, confidence, strongest topics, and areas needing work.</p></article>
  </section>
  <section class="grid"><article class="card"><div class="muted">Questions answered</div><div class="stat">${total}</div></article><article class="card"><div class="muted">Best score</div><div class="stat">${best}%</div></article><article class="card"><div class="muted">Study streak</div><div class="streak">🔥 ${streak()}</div></article><article class="card"><div class="muted">Question bank</div><div class="stat">210</div></article></section>`;
}
window.selectArea=a=>{activeArea=a;bank=a==='admin'?adminBank:(a==='clinical'?clinicalBank:generalBank);go('quiz')};
function study(){
  let topics=[...new Set(bank.map(q=>q.topic))];
  app.innerHTML=`<h1>Study by Topic</h1><p class="muted">Choose an answer, tap Check Answer, then read why every option is right or wrong.</p>
  <section class="card">${topics.map(t=>`<div class="topic-row"><span><strong>${t}</strong><br><span class="small muted">${bank.filter(q=>q.topic===t).length} questions</span></span><button class="btn btn-secondary" onclick='startTopic(${JSON.stringify(t)})'>Study</button></div>`).join('')}</section>`;
}
function quizMenu(){
  const areaName=activeArea==='admin'?'Work Area II: Administrative Medical Assisting':(activeArea==='clinical'?'Work Area III: Clinical Medical Assisting':'Work Area I: General Medical Assisting');
  const maxN=bank.length;
  app.innerHTML=`<div class="area-banner"><div><div class="area-label">${areaName}</div><h1>Practice Options</h1></div><button class="btn btn-secondary" onclick="go('home')">Change Area</button></div>
  <div class="pill-row"><button class="pill ${mode==='study'?'active':''}" onclick="setMode('study')">Study Mode</button><button class="pill ${mode==='exam'?'active':''}" onclick="setMode('exam')">Exam Mode</button></div>
  <div class="mode-note">${mode==='study'?'Study Mode shows explanations after you check each answer.':'Exam Mode saves explanations until the end. Timed mode is available for the 65-question exam.'}</div>
  <section class="grid">${([10,25,50,65].filter(n=>n<=maxN).concat(maxN===30?[30]:[]).filter((v,i,a)=>a.indexOf(v)===i)).map(n=>`<article class="card card-button" onclick="startQuiz(${n},mode,${n===maxN?"mode==='exam'":"false"})"><h2>${n} Questions</h2><p>${n===maxN?'Full work-area exam':'Randomized practice'}</p></article>`).join('')}</section>`;
}
window.setMode=m=>{mode=m;quizMenu()};
window.startQuiz=(n,m='study',timed=false)=>{
  mode=m;activeQuiz=sh(bank).slice(0,Math.min(n,bank.length));currentIndex=0;answers={};confidence={};checked={};recordStudyDay();
  if(timed){timeLeft=(activeArea==='admin'?36:(activeArea==='clinical'?138:78))*60;startTimer()} else stopTimer();
  showQ();
};
window.startTopic=t=>{mode='study';activeQuiz=sh(bank.filter(q=>q.topic===t));currentIndex=0;answers={};confidence={};checked={};recordStudyDay();stopTimer();showQ()};
function startTimer(){stopTimer();timerId=setInterval(()=>{timeLeft--;let el=$('#timer');if(el){el.textContent=formatTime(timeLeft);el.classList.toggle('warning',timeLeft<=300)}if(timeLeft<=0){stopTimer();finishQuiz(true)}},1000)}
function stopTimer(){if(timerId){clearInterval(timerId);timerId=null}}
function formatTime(s){let m=Math.floor(s/60),r=s%60;return `${m}:${String(r).padStart(2,'0')}`}
function explain(q,c){
  let ok=c===q.a;
  return `<div class="feedback ${ok?'good':'bad'}"><strong>${ok?'Correct':'Not quite'}</strong><br>${ok?'':`Correct answer: ${'ABCD'[q.a]}. ${q.choices[q.a]}<br>`}${q.exp}</div>
  <div class="option-review"><strong>Why each option is right or wrong:</strong>${q.choices.map((x,i)=>`<div class="option-note ${i===q.a?'correct-option':''}"><strong>${'ABCD'[i]}. ${x}</strong><br>${q.optionExplanations[i]}</div>`).join('')}</div>
  <div class="tip"><strong>💡 Remember:</strong> ${q.tip}</div>`;
}
function showQ(){
  let q=activeQuiz[currentIndex],c=answers[q.id],fav=state.favorites.includes(q.id),cf=confidence[q.id],done=checked[q.id];
  app.innerHTML=`<section class="card">
    <button class="star" onclick="toggleFav('${q.id}')">${fav?'★':'☆'}</button>
    <div class="question-head"><span>Question ${currentIndex+1} of ${activeQuiz.length}</span><span>${timerId?`<span id="timer" class="timer">${formatTime(timeLeft)}</span> • `:''}${q.topic} • ${q.difficulty}</span></div>
    <div class="progress-track" style="margin:12px 0 20px"><div class="progress-fill" style="width:${(currentIndex+1)/activeQuiz.length*100}%"></div></div>
    <h2>${q.q}</h2>
    ${q.choices.map((x,i)=>`<label class="choice"><input type="radio" name="ans" value="${i}" ${c===i?'checked':''} ${done&&mode==='study'?'disabled':''}><strong>${'ABCD'[i]}.</strong> ${x}</label>`).join('')}
    ${mode==='study'&&!done?'<button class="btn btn-primary" onclick="checkAnswer()">Check Answer</button>':''}
    ${mode==='study'&&done?explain(q,c):''}
    <div class="confidence"><button class="${cf==='high'?'active':''}" onclick="setConf('${q.id}','high')">😊 Confident</button><button class="${cf==='medium'?'active':''}" onclick="setConf('${q.id}','medium')">😐 Unsure</button><button class="${cf==='guess'?'active':''}" onclick="setConf('${q.id}','guess')">😬 Guessed</button></div>
    <div class="btn-row"><button class="btn btn-secondary" onclick="prevQ()" ${currentIndex===0?'disabled':''}>Previous</button><button class="btn btn-primary" onclick="${currentIndex===activeQuiz.length-1?'finishQuiz()':'nextQ()'}">${currentIndex===activeQuiz.length-1?'Submit':'Next'}</button><button class="btn btn-secondary" onclick="go('home')">Exit</button></div>
  </section>`;
  document.querySelectorAll('input[name=ans]').forEach(i=>i.onchange=()=>answers[q.id]=+i.value);
}
window.checkAnswer=()=>{let q=activeQuiz[currentIndex];if(answers[q.id]===undefined){alert('Choose an answer first.');return}checked[q.id]=true;showQ()};
window.setConf=(id,v)=>{confidence[id]=v;showQ()};
window.toggleFav=id=>{state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];save();showQ()};
window.nextQ=()=>{currentIndex++;showQ()};window.prevQ=()=>{currentIndex--;showQ()};
window.finishQuiz=(timedOut=false)=>{
  stopTimer();
  let correct=0;
  const details=activeQuiz.map(q=>{
    let c=answers[q.id],ok=c===q.a;if(ok)correct++;else if(!state.missed.includes(q.id))state.missed.push(q.id);
    let s=state.topicStats[q.topic]||{correct:0,total:0};s.total++;if(ok)s.correct++;state.topicStats[q.topic]=s;
    let cf=confidence[q.id];if(cf)state.confidenceStats[cf]=(state.confidenceStats[cf]||0)+1;
    return{q,c,ok};
  });
  let score=Math.round(correct/activeQuiz.length*100);
  state.attempts.push({date:new Date().toISOString(),score,correct,total:activeQuiz.length,mode,area:activeArea,timed:!!timeLeft,timedOut});
  save();
  app.innerHTML=`<section class="hero center"><h1>${score}%</h1><p>${correct} of ${activeQuiz.length} correct${timedOut?' • Time expired':''}</p></section>
  <div class="btn-row"><button class="btn btn-primary" onclick="go('home')">Home</button><button class="btn btn-secondary" onclick="go('progress')">View Analytics</button></div>
  <h2>Answer Review</h2>${details.map((d,i)=>`<section class="card"><div class="question-head"><span>Question ${i+1}</span><span>${d.q.topic}</span></div><h3>${d.q.q}</h3>${explain(d.q,d.c)}</section>`).join('')}`;
  activeQuiz=null;
};
function saved(){
  let favs=state.favorites.map(id=>bank.find(q=>q.id===id)).filter(Boolean),missed=state.missed.map(id=>bank.find(q=>q.id===id)).filter(Boolean);
  app.innerHTML=`<h1>Saved Review</h1><section class="grid"><article class="card"><h2>⭐ Favorites</h2><p>${favs.length} saved</p>${favs.length?'<button class="btn btn-primary" onclick="startCustom(\'favorites\')">Practice Favorites</button>':''}</article><article class="card"><h2>❌ Missed</h2><p>${missed.length} to review</p>${missed.length?'<button class="btn btn-primary" onclick="startCustom(\'missed\')">Practice Missed</button>':''}</article></section>${favs.map(q=>`<section class="card"><span class="badge">${q.topic}</span><h3>${q.q}</h3><p><strong>Correct:</strong> ${'ABCD'[q.a]}. ${q.choices[q.a]}</p><div class="tip">${q.tip}</div><div class="mastered-row"><span class="small muted">Finished reviewing?</span><button class="btn btn-secondary" onclick="markMastered('${q.id}')">Mark Mastered</button></div></section>`).join('')}`;
}
window.markMastered=id=>{state.favorites=state.favorites.filter(x=>x!==id);state.missed=state.missed.filter(x=>x!==id);save();saved()};
window.startCustom=type=>{let ids=type==='favorites'?state.favorites:state.missed;activeQuiz=sh(ids.map(id=>bank.find(q=>q.id===id)).filter(Boolean));mode='study';currentIndex=0;answers={};confidence={};checked={};recordStudyDay();showQ()};
function progress(){
  let a=state.attempts,avg=a.length?Math.round(a.reduce((x,y)=>x+y.score,0)/a.length):0,best=a.length?Math.max(...a.map(x=>x.score)):0;
  let stats=Object.entries(state.topicStats).map(([t,s])=>({t,score:pct(s.correct,s.total),correct:s.correct,total:s.total})).sort((x,y)=>y.score-x.score);
  let strongest=stats[0],weakest=stats.at(-1);
  let rows=stats.map(s=>`<div class="analytics-row"><div><strong>${s.t}</strong><div class="meter"><div style="width:${s.score}%"></div></div></div><strong>${s.score}%</strong></div>`).join('');
  let cs=state.confidenceStats,totalC=(cs.high||0)+(cs.medium||0)+(cs.guess||0);
  app.innerHTML=`<h1>Progress & Analytics</h1>
  <section class="grid"><article class="card"><div class="muted">Attempts</div><div class="stat">${a.length}</div></article><article class="card"><div class="muted">Average</div><div class="stat">${avg}%</div></article><article class="card"><div class="muted">Best</div><div class="stat">${best}%</div></article><article class="card"><div class="muted">Study streak</div><div class="stat">🔥 ${streak()}</div></article></section>
  <section class="grid">
    <article class="card"><span class="badge badge-good">Strongest</span><h2>${strongest?strongest.t:'Not enough data yet'}</h2><p>${strongest?strongest.score+'% accuracy':'Complete a quiz to calculate.'}</p></article>
    <article class="card"><span class="badge badge-warn">Needs Review</span><h2>${weakest?weakest.t:'Not enough data yet'}</h2><p>${weakest?weakest.score+'% accuracy':'Complete a quiz to calculate.'}</p></article>
  </section>
  <section class="card" style="margin-top:18px"><h2>Performance by Topic</h2>${rows||'<p class="muted">Complete a quiz to begin tracking.</p>'}</section>
  <section class="card" style="margin-top:18px"><h2>Confidence Breakdown</h2>${totalC?`<p>😊 Confident: ${pct(cs.high||0,totalC)}% &nbsp; • &nbsp; 😐 Unsure: ${pct(cs.medium||0,totalC)}% &nbsp; • &nbsp; 😬 Guessed: ${pct(cs.guess||0,totalC)}%</p>`:'<p class="muted">Use the confidence buttons during quizzes to populate this report.</p>'}</section>`;
}
init();