const $ = s => document.querySelector(s), app = $('#app');
let generalBank = [], adminBank = [], clinicalBank = [], allBank = [], bank = [], activeArea = 'general';
let activeQuiz = null, currentIndex = 0, answers = {}, confidence = {}, checked = {}, mode = 'study', route = 'home', timerId = null, timeLeft = 0;
const D = { attempts: [], missed: [], favorites: [], theme: 'light', topicStats: {}, confidenceStats: { high: 0, medium: 0, guess: 0 }, studyDates: [], seen: [], xp: 0, level: 1, lastLevelSeen: 1, achievements: [], correctAnswers: 0, perfectExams: 0, studySeconds: 0, firstStudyDate: null,
dailyGoal:20,
dailyProgress:0,
goalCompletedDate:"", 
dailyQuestQuestions: 0,
dailyQuestCorrect: 0,
dailyQuestQuiz: 0,
dailyQuestCompleted: false,
dailyQuestDate: "",
};
const state = Object.assign({}, D, JSON.parse(localStorage.getItem('rmaStateV4') || '{}'));

document.documentElement.dataset.theme = state.theme;
function save() { localStorage.setItem('rmaStateV4', JSON.stringify(state)) }
function go(r) { stopTimer(); if (route === 'quiz' || activeQuiz) endStudySession(); route = r; document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === r)); render(); scrollTo(0, 0) }
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => go(b.dataset.route));
$('#themeBtn').onclick = () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = state.theme; save() };
const sh = a => [...a].sort(() => Math.random() - .5), pct = (n, d) => d ? Math.round(n / d * 100) : 0;
const todayKey = () => new Date().toISOString().slice(0, 10);
function recordStudyDay() {
   let d = todayKey();
   if (state.dailyQuestDate !== d) {
  state.dailyQuestDate = d;
  state.dailyQuestQuestions = 0;
  state.dailyQuestCorrect = 0;
  state.dailyQuestQuiz = 0;
  state.dailyQuestCompleted = false;
}
   if (!state.studyDates.includes(d)){
    state.studyDates.push(d);
    state.studyDates= state.studyDates.slice(-365);
   }
   }
   let studyStartedAt = null;
function beginStudySession() { if (!studyStartedAt) { studyStartedAt = Date.now(); if (!state.firstStudyDate) state.firstStudyDate = new Date().toISOString(); save() } }
function endStudySession() { if (studyStartedAt) { state.studySeconds = (state.studySeconds || 0) + Math.max(0, Math.round((Date.now() - studyStartedAt) / 1000)); studyStartedAt = null; save() } }
function formatStudyTime(sec) { const m = Math.floor((sec || 0) / 60); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return `${h}h ${r}m` }
window.addEventListener('beforeunload', endStudySession);

function streak() { let set = new Set(state.studyDates), n = 0, d = new Date(); while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1) } return n }
function readiness() { if (!state.attempts.length) return 0; const r = state.attempts.slice(-8), avg = r.reduce((s, a) => s + a.score, 0) / r.length, coverage = Math.min(100, Object.keys(state.topicStats).length / 18 * 100), ct = Object.values(state.confidenceStats).reduce((a, b) => a + b, 0), cp = ct ? pct(state.confidenceStats.high || 0, ct) : 50; return Math.round(avg * .65 + coverage * .2 + cp * .15) }

function levelFromXp(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1 }
function levelFloor(level) { return Math.pow(level - 1, 2) * 100 }
function levelCeiling(level) { return Math.pow(level, 2) * 100 }
function xpForDifficulty(d) { return d === 'Hard' ? 30 : (d === 'Moderate' ? 20 : 10) }
function awardXp(points) {
  const oldLevel = levelFromXp(state.xp || 0);
  state.xp = (state.xp || 0) + points;
  state.level = levelFromXp(state.xp);
  save();
  if (state.level > oldLevel) { setTimeout(() => showLevelUp(state.level), 200) } setTimeout(checkAchievements, 50)
}
function showLevelUp(level) {
  const box = document.createElement('div');
  box.className = 'level-up';
  box.innerHTML = `<div class="level-up-card"><div style="font-size:3rem">🎉</div><h2>Level ${level} reached!</h2><p>You’re building real RMA mastery, one question at a time.</p><button class="btn btn-primary" onclick="this.closest('.level-up').remove()">Keep Studying</button></div>`;
  document.body.appendChild(box);
}
function profileCard() {
  const xp = state.xp || 0, level = levelFromXp(xp), floor = levelFloor(level), ceil = levelCeiling(level), into = xp - floor, need = ceil - floor, progress = Math.min(100, Math.round(into / need * 100));
  return `<section class="card profile-card">
    <div class="level-orb">Lv ${level}</div>
    <div><div class="kicker">Student Profile</div><h2 style="margin:2px 0">RMA Mastery+</h2>
    <div class="xp-track"><div class="xp-fill" style="width:${progress}%"></div></div>
    <div class="xp-row"><span>${xp} total XP</span><span>${into}/${need} XP to Level ${level + 1}</span></div></div>
  </section>`;
}

const achievementDefs = [
  { id: 'first_correct', icon: '🥉', name: 'First Step', desc: 'Answer your first question correctly.', target: 1, progress: () => state.correctAnswers || 0 },
  { id: 'ten_correct', icon: '🥈', name: 'Getting Warmed Up', desc: 'Answer 10 questions correctly.', target: 10, progress: () => state.correctAnswers || 0 },
  { id: 'fifty_correct', icon: '🥇', name: 'Knowledge Builder', desc: 'Answer 50 questions correctly.', target: 50, progress: () => state.correctAnswers || 0 },
  { id: 'hundred_correct', icon: '⚡', name: 'Century Scholar', desc: 'Answer 100 questions correctly.', target: 100, progress: () => state.correctAnswers || 0 },
  { id: 'level_five', icon: '⭐', name: 'Level 5', desc: 'Reach student Level 5.', target: 5, progress: () => levelFromXp(state.xp || 0) },
  { id: 'level_ten', icon: '🌟', name: 'Level 10', desc: 'Reach student Level 10.', target: 10, progress: () => levelFromXp(state.xp || 0) },
  { id: 'three_day', icon: '🔥', name: 'Three-Day Spark', desc: 'Study 3 days in a row.', target: 3, progress: () => streak() },
  { id: 'seven_day', icon: '🏅', name: 'Seven-Day Streak', desc: 'Study 7 days in a row.', target: 7, progress: () => streak() },
  { id: 'favorites_five', icon: '💛', name: 'Curious Mind', desc: 'Save 5 favorite questions.', target: 5, progress: () => state.favorites.length },
  { id: 'seen_hundred', icon: '📚', name: 'Deep Dive', desc: 'View 100 different questions.', target: 100, progress: () => state.seen.length },
  { id: 'perfect_score', icon: '🎯', name: 'Perfect Score', desc: 'Earn a perfect quiz score.', target: 1, progress: () => state.perfectExams || 0 },
  { id: 'readiness_80', icon: '👑', name: 'RMA Ready', desc: 'Reach an 80% Exam Readiness Score.', target: 80, progress: () => readiness() },
 {
  id: 'daily_goal',
  icon: '🏆',
  name: 'Daily Goal Champion',
  desc: 'Complete your daily question goal.',
  target: 1,
  progress: () => state.goalCompletedDate === todayKey() ? 1 : 0
},
]; 
function unlockedAchievementIds() { return new Set(state.achievements || []) }
function checkAchievements() {
  const unlocked = unlockedAchievementIds(), newOnes = [];
  achievementDefs.forEach(a => {
    if (!unlocked.has(a.id) && a.progress() >= a.target) {
      state.achievements.push(a.id); newOnes.push(a);
    }
  });
  if (newOnes.length) { save(); newOnes.forEach((a, i) => setTimeout(() => showAchievementToast(a), i * 900)) }
}
function showAchievementToast(a) {
  const el = document.createElement('div');
  el.className = 'achievement-toast';
  el.innerHTML = `<div class="kicker">Achievement Unlocked</div><div style="display:flex;gap:12px;align-items:center"><div style="font-size:2.2rem">${a.icon}</div><div><strong>${a.name}</strong><div class="small muted">${a.desc}</div></div></div>`;
  document.body.appendChild(el); setTimeout(() => el.remove(), 4200);
}
function achievementCard(a) {
  const unlocked = unlockedAchievementIds().has(a.id), value = Math.min(a.target, a.progress()), p = Math.min(100, Math.round(value / a.target * 100));
  return `<article class="achievement-card ${unlocked ? 'unlocked' : 'locked'}"><div class="achievement-icon">${unlocked ? a.icon : '🔒'}</div><div class="achievement-name">${a.name}</div><p class="small muted">${a.desc}</p><div class="achievement-progress"><div style="width:${p}%"></div></div><div class="xp-row"><span>${value}/${a.target}</span><span>${p}%</span></div><div class="achievement-status">${unlocked ? 'Unlocked' : 'In progress'}</div></article>`;
}
function achievementsPage() {
  checkAchievements();
  const unlocked = unlockedAchievementIds().size;
  app.innerHTML = `<h1>Achievement Center</h1><p class="muted">Every badge stays in your profile permanently once unlocked.</p>
  <section class="achievement-summary"><article class="card"><div class="muted">Unlocked</div><div class="stat">${unlocked}</div></article><article class="card"><div class="muted">Available</div><div class="stat">${achievementDefs.length}</div></article><article class="card"><div class="muted">Completion</div><div class="stat">${pct(unlocked, achievementDefs.length)}%</div></article></section>
  <section class="badge-grid">${achievementDefs.map(achievementCard).join('')}</section>`;
}
function areaBank(a) { return a === 'admin' ? adminBank : (a === 'clinical' ? clinicalBank : generalBank) }
function areaName(a) { return a === 'admin' ? 'Administrative Medical Assisting' : (a === 'clinical' ? 'Clinical Medical Assisting' : 'General Medical Assisting') }
function areaLabel(a) { return a === 'admin' ? 'Work Area II' : (a === 'clinical' ? 'Work Area III' : 'Work Area I') }
async function init() { try { [generalBank, adminBank, clinicalBank] = await Promise.all([fetch('questions-general.json').then(r => r.json()), fetch('questions-admin.json').then(r => r.json()), fetch('questions-clinical.json').then(r => r.json())]); allBank = [...generalBank, ...adminBank, ...clinicalBank]; bank = generalBank } catch (e) { app.innerHTML = '<section class="card warning"><h2>Question bank could not load</h2><p>Refresh after GitHub Pages finishes deploying.</p></section>'; return } render(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(() => { }) }
function render() { ({ home, study, quiz: practiceExamHub, saved, progress, search: searchPage, custom: customExam, achievements: achievementsPage }[route] || home)() }
function dailyQuestion() { const day = Math.floor(new Date() / 86400000); return allBank[day % allBank.length] }
function home() {

  
  if (
  state.dailyQuestQuestions >= 10 &&
  state.dailyQuestCorrect >= 5 &&
  state.dailyQuestQuiz >= 1 &&
  !state.dailyQuestCompleted
) {
  state.dailyQuestCompleted = true;
  state.correctAnswers = (state.correctAnswers || 0) + 50;
  save();
  alert('🎉 Daily Quests Complete! +50 bonus XP');
}
 let best = state.attempts.length ? Math.max(...state.attempts.map(a => a.score)) : 0, total = state.attempts.reduce((s, a) => s + a.total, 0), dq = dailyQuestion(); app.innerHTML = profileCard() + dailyGoalCard + dailyQuestCard +`<section class="hero"><h1>Master. Practice. Pass.</h1><span class="version-chip">Version 4.4</span><p>Full analytics dashboard is live—track accuracy, study time, quiz history, readiness, weak topics, and progress over time.</p></section><section class="grid"><article class="card card-button" onclick="selectArea('general')"><span class="badge">Work Area I</span><h2>General Medical Assisting</h2><p>65 questions</p></article><article class="card card-button" onclick="selectArea('admin')"><span class="badge">Work Area II</span><h2>Administrative Medical Assisting</h2><p>30 questions</p></article><article class="card card-button" onclick="selectArea('clinical')"><span class="badge">Work Area III</span><h2>Clinical Medical Assisting</h2><p>115 questions</p></article><article class="card card-button" onclick="adaptiveQuiz()"><span class="badge">Smart Study</span><h2>Study My Weakest Topics</h2><p>Builds a 20-question quiz from your lowest-scoring topics.</p></article></section><section class="card challenge"><div class="kicker">Daily Challenge</div><h2>${dq.q}</h2><p>${dq.topic} • ${dq.difficulty}</p><button class="btn btn-primary" onclick="startDaily('${dq.id}')">Answer Today’s Question</button></section><section class="grid" style="margin-top:18px"><article class="card"><div class="muted">Questions answered</div><div class="stat">${total}</div></article><article class="card"><div class="muted">Best score</div><div class="stat">${best}%</div></article><article class="card"><div class="muted">Study streak</div><div class="stat">🔥 ${streak()}</div></article><article class="card card-button" onclick="go('progress')"><div class="muted">Exam readiness</div><div class="readiness">${readiness()}%</div></article></section><section class="grid" style="margin-top:18px"><article class="card card-button" onclick="go('search')"><h2>🔎 Search</h2><p>Find any topic, term, or question.</p></article><article class="card card-button" onclick="go('custom')"><h2>🛠️ Custom Exam</h2><p>Choose area, difficulty, number, and mode.</p></article><article class="card card-button" onclick="go('saved')"><h2>⭐ Saved Review</h2><p>Favorites and missed questions.</p></article><article class="card card-button" onclick="go('progress')"><h2>📊 Analytics</h2><p>Readiness, charts, confidence, and achievements.</p></article><article class="card card-button" onclick="go('achievements')"><h2>🏆 Achievement Center</h2><p>Unlock badges and track every milestone.</p></article></section>` }
const remaining = Math.max(0, state.dailyGoal - state.dailyProgress);
const goalPct = Math.min(100, Math.round((state.dailyProgress / state.dailyGoal) * 100));
const streakDays = streak();
const readinessPct = readiness();
const dailyGoalCard = `
  <section class="card daily-goal-card">
    <div class="kicker">Today's Goal</div>
    <h2>${state.dailyProgress} of ${state.dailyGoal} questions</h2>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${goalPct}%"></div>
    </div>
    <p>${remaining === 0 ? '🎉 Daily goal complete!' : `${remaining} questions remaining`}</p>
    <p>🔥 ${streakDays}-day study streak</p>
  </section>
`;  
 const dailyQuestCard = `
  <section class="card">
    <div class="kicker">🎯 Daily Quests</div>
    <h2>Today's Challenges</h2>

    <p>📚 Answer 10 questions: ${Math.min(state.dailyQuestQuestions || 0, 10)}/10</p>

    <p>✅ Get 5 answers correct: ${Math.min(state.dailyQuestCorrect || 0, 5)}/5</p>

    <p>🏆 Complete 1 quiz: ${state.dailyQuestQuiz ? 1 : 0}/1</p>

    <p>${state.dailyQuestCompleted
      ? '🎉 Daily quests complete!'
      : 'Keep going — you got this! 💪🏽'}</p>
  </section>
`;

   window.selectArea = a => { activeArea = a; bank = areaBank(a); go('study') };
window.startDaily = id => { let q = allBank.find(x => x.id === id); activeQuiz = [q]; mode = 'study'; currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); showQ() };
window.adaptiveQuiz = () => { const stats = Object.entries(state.topicStats).map(([t, s]) => ({ t, score: pct(s.correct, s.total) })).sort((a, b) => a.score - b.score), weak = stats.slice(0, 4).map(x => x.t); let pool = weak.length ? allBank.filter(q => weak.includes(q.topic)) : allBank; activeQuiz = sh(pool).slice(0, 20); mode = 'study'; currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); showQ() };
function study() { let topics = [...new Set(bank.map(q => q.topic))]; app.innerHTML = `<div class="area-banner"><div><div class="area-label">${areaLabel(activeArea)}: ${areaName(activeArea)}</div><h1>Study by Topic</h1></div><button class="btn btn-secondary" onclick="go('home')">Change Area</button></div><p class="muted">Choose an answer, check it, then read why every option is right or wrong.</p><section class="card">${topics.map(t => `<div class="topic-row"><span><strong>${t}</strong><br><span class="small muted">${bank.filter(q => q.topic === t).length} questions</span></span><button class="btn btn-secondary" onclick='startTopic(${JSON.stringify(t)})'>Study</button></div>`).join('')}</section>` }
function practiceExamHub() {
  app.innerHTML = `
    <h1>RMA Practice Exam</h1>
    <p class="muted">
      Choose an exam option. Your full simulation uses all three RMA work areas.
    </p>

    <section class="grid" style="margin-top:18px">
      <article class="card">
        <div class="kicker">Full Simulation</div>
        <h2>200-Question RMA Exam</h2>
        <p>65 General, 30 Administrative, and 105 Clinical questions.</p>
        <button class="btn btn-primary" onclick="startFullPracticeExam()">
          Start Full Exam
        </button>
      </article>

      <article class="card">
        <div class="kicker">Quick Practice</div>
        <h2>50-Question Exam</h2>
        <p>A shorter mixed exam from all three work areas.</p>
        <button class="btn btn-secondary" onclick="startQuickPracticeExam()">
          Start 50 Questions
        </button>
      </article>
    </section>

    <section class="card" style="margin-top:18px">
      <h2>More Study Options</h2>
      <button class="btn btn-secondary" onclick="quizMenu()">
        Regular Quiz Menu
      </button>
    </section>
  `;
}


window.startFullPracticeExam = () => {
  mode = "exam";
  activeQuiz = sh(allBank).slice(0, 200);
  timed = true;
  timeLeft = 210 * 60;
  answers = {};
  confidence = {};
  currentIndex = 0;
  startTimer();
  showQ();
};

window.startQuickPracticeExam = () => {
  mode = "exam";
  activeQuiz = sh(allBank).slice(0, 50);
  timed = true;
  timeLeft = 60 * 60;
  answers = {};
  confidence = {};
  currentIndex = 0;
  startTimer();
  showQ();
};
function quizMenu() { const maxN = bank.length; app.innerHTML = `<div class="area-banner"><div><div class="area-label">${areaLabel(activeArea)}: ${areaName(activeArea)}</div><h1>Practice Options</h1></div><button class="btn btn-secondary" onclick="go('home')">Change Area</button></div><div class="pill-row"><button class="pill ${mode === 'study' ? 'active' : ''}" onclick="setMode('study')">Study Mode</button><button class="pill ${mode === 'exam' ? 'active' : ''}" onclick="setMode('exam')">Exam Mode</button></div><div class="mode-note">${mode === 'study' ? 'Study Mode shows explanations after each checked answer.' : 'Exam Mode holds explanations until the end.'}</div><section class="grid">${([10, 25, 50, maxN].filter((v, i, a) => v <= maxN && a.indexOf(v) === i)).map(n => `<article class="card card-button" onclick="startQuiz(${n},mode,${n === maxN ? "mode==='exam'" : "false"})"><h2>${n} Questions</h2><p>${n === maxN ? 'Full work-area exam' : 'Randomized practice'}</p></article>`).join('')}</section><section class="grid" style="margin-top:18px"><article class="card card-button" onclick="adaptiveQuiz()"><h2>🧠 Adaptive 20</h2><p>Focus on weak topics.</p></article><article class="card card-button" onclick="go('custom')"><h2>🛠️ Custom Exam</h2><p>Build your own quiz.</p></article></section>` }
window.setMode = m => { mode = m; quizMenu() };
window.startQuiz = (n, m = 'study', timed = false) => { mode = m; activeQuiz = sh(bank).slice(0, Math.min(n, bank.length)); currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); if (timed) { timeLeft = (activeArea === 'admin' ? 36 : (activeArea === 'clinical' ? 138 : 78)) * 60; startTimer() } else stopTimer(); showQ() };
window.startTopic = t => { mode = 'study'; activeQuiz = sh(bank.filter(q => q.topic === t)); currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); stopTimer(); showQ() };
function startTimer() { stopTimer(); timerId = setInterval(() => { timeLeft--; let el = $('#timer'); if (el) { el.textContent = formatTime(timeLeft); el.classList.toggle('warning', timeLeft <= 300) } if (timeLeft <= 0) { stopTimer(); finishQuiz(true) } }, 1000) }
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null } }
function formatTime(s) { let m = Math.floor(s / 60), r = s % 60; return `${m}:${String(r).padStart(2, '0')}` }
function explain(q, c) { let ok = c === q.a; return `<div class="feedback ${ok ? 'good' : 'bad'}"><strong>${ok ? 'Correct' : 'Not quite'}</strong><br>${ok ? '' : `Correct answer: ${'ABCD'[q.a]}. ${q.choices[q.a]}<br>`}${q.exp}</div><div class="option-review"><strong>Why each option is right or wrong:</strong>${q.choices.map((x, i) => `<div class="option-note ${i === q.a ? 'correct-option' : ''}"><strong>${'ABCD'[i]}. ${x}</strong><br>${q.optionExplanations[i]}</div>`).join('')}</div><div class="tip"><strong>💡 Remember:</strong> ${q.tip}</div>` }
function showQ() { let q = activeQuiz[currentIndex], c = answers[q.id], fav = state.favorites.includes(q.id), cf = confidence[q.id], done = checked[q.id]; if (!state.seen.includes(q.id)) { state.seen.push(q.id); save() } app.innerHTML = `<section class="card"><button class="star" onclick="toggleFav('${q.id}')">${fav ? '★' : '☆'}</button><div class="question-head"><span>Question ${currentIndex + 1} of ${activeQuiz.length}</span><span>${timerId ? `<span id="timer" class="timer">${formatTime(timeLeft)}</span> • ` : ''}${q.topic} • ${q.difficulty} • <span class="xp-chip">+${xpForDifficulty(q.difficulty)} XP</span></span></div><div class="progress-track" style="margin:12px 0 20px"><div class="progress-fill" style="width:${(currentIndex + 1) / activeQuiz.length * 100}%"></div></div><h2>${q.q}</h2>${q.choices.map((x, i) => `<label class="choice"><input type="radio" name="ans" value="${i}" ${c === i ? 'checked' : ''} ${done && mode === 'study' ? 'disabled' : ''}><strong>${'ABCD'[i]}.</strong> ${x}</label>`).join('')}${mode === 'study' && !done ? '<button class="btn btn-primary" onclick="checkAnswer()">Check Answer</button>' : ''}${mode === 'study' && done ? explain(q, c) : ''}<div class="confidence"><button class="${cf === 'high' ? 'active' : ''}" onclick="setConf('${q.id}','high')">😊 Confident</button><button class="${cf === 'medium' ? 'active' : ''}" onclick="setConf('${q.id}','medium')">😐 Unsure</button><button class="${cf === 'guess' ? 'active' : ''}" onclick="setConf('${q.id}','guess')">😬 Guessed</button></div><div class="btn-row"><button class="btn btn-secondary" onclick="prevQ()" ${currentIndex === 0 ? 'disabled' : ''}>Previous</button><button class="btn btn-primary" onclick="${currentIndex === activeQuiz.length - 1 ? 'finishQuiz()' : 'nextQ()'}">${currentIndex === activeQuiz.length - 1 ? 'Submit' : 'Next'}</button><button class="btn btn-secondary" onclick="go('home')">Exit</button></div></section>`; document.querySelectorAll('input[name=ans]').forEach(i => i.onchange = () => answers[q.id] = +i.value) }
window.checkAnswer = () => {
   let q = activeQuiz[currentIndex];
   
    if (answers[q.id] === undefined) { alert('Choose an answer first.'); return }; recordStudyDay();
recordStudyDay();
  if (!checked[q.id]) {
  state.dailyProgress = (state.dailyProgress || 0) + 1;
state.dailyQuestQuestions++;

if (answers[q.id] === q.a) state.dailyQuestCorrect++;
save();
  if (
    state.dailyProgress >= state.dailyGoal &&
    state.goalCompletedDate !== todayKey()
  ) {
    state.goalCompletedDate = todayKey();
    state.correctAnswers = (state.correctAnswers || 0) + 50;
    alert('🎉 Daily Goal Complete! +50 bonus XP');
  }


  save();
}
   if (!checked[q.id] && answers[q.id] === q.a) { state.correctAnswers = (state.correctAnswers || 0) + 1; awardXp(xpForDifficulty(q.difficulty)); checkAchievements() } checked[q.id] = true; showQ() };
window.setConf = (id, v) => { confidence[id] = v; showQ() }; window.toggleFav = id => { state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id]; save(); checkAchievements(); showQ() }; window.nextQ = () => { currentIndex++; showQ() }; window.prevQ = () => { currentIndex--; showQ() };
window.finishQuiz = (timedOut = false) => { stopTimer(); endStudySession(); state.dailyQuestQuiz = 1; saved ();  let correct = 0; const details = activeQuiz.map(q => { let c = answers[q.id], ok = c === q.a; if (ok) { correct++; if (mode === 'exam') { state.correctAnswers = (state.correctAnswers || 0) + 1; awardXp(xpForDifficulty(q.difficulty)) } } else if (!state.missed.includes(q.id)) state.missed.push(q.id); let s = state.topicStats[q.topic] || { correct: 0, total: 0 }; s.total++; if (ok) s.correct++; state.topicStats[q.topic] = s; let cf = confidence[q.id]; if (cf) state.confidenceStats[cf] = (state.confidenceStats[cf] || 0) + 1; return { q, c, ok } }); let score = Math.round(correct / activeQuiz.length * 100); state.attempts.push({ date: new Date().toISOString(), score, correct, total: activeQuiz.length, mode, area: activeArea, timed: !!timeLeft, timedOut }); if (score === 100) state.perfectExams = (state.perfectExams || 0) + 1; save(); checkAchievements(); app.innerHTML = `<section class="hero center"><h1>${score}%</h1><p>${correct} of ${activeQuiz.length} correct${timedOut ? ' • Time expired' : ''}</p></section><div class="btn-row"><button class="btn btn-primary" onclick="go('home')">Home</button><button class="btn btn-secondary" onclick="go('progress')">View Analytics</button></div><h2>Answer Review</h2>${details.map((d, i) => `<section class="card"><div class="question-head"><span>Question ${i + 1}</span><span>${d.q.topic}</span></div><h3>${d.q.q}</h3>${explain(d.q, d.c)}</section>`).join('')}`; activeQuiz = null };
function saved() { let favs = state.favorites.map(id => allBank.find(q => q.id === id)).filter(Boolean), missed = state.missed.map(id => allBank.find(q => q.id === id)).filter(Boolean); app.innerHTML = `<h1>Saved Review</h1><section class="grid"><article class="card"><h2>⭐ Favorites</h2><p>${favs.length} saved</p>${favs.length ? '<button class="btn btn-primary" onclick="startCustomSet(\'favorites\')">Practice Favorites</button>' : ''}</article><article class="card"><h2>❌ Missed</h2><p>${missed.length} to review</p>${missed.length ? '<button class="btn btn-primary" onclick="startCustomSet(\'missed\')">Practice Missed</button>' : ''}</article></section>${favs.map(q => `<section class="card"><span class="badge">${q.topic}</span><h3>${q.q}</h3><p><strong>Correct:</strong> ${'ABCD'[q.a]}. ${q.choices[q.a]}</p><div class="tip">${q.tip}</div><div class="mastered-row"><span class="small muted">Finished reviewing?</span><button class="btn btn-secondary" onclick="markMastered('${q.id}')">Mark Mastered</button></div></section>`).join('')}` }
window.markMastered = id => { state.favorites = state.favorites.filter(x => x !== id); state.missed = state.missed.filter(x => x !== id); save(); saved() }; window.startCustomSet = type => { let ids = type === 'favorites' ? state.favorites : state.missed; activeQuiz = sh(ids.map(id => allBank.find(q => q.id === id)).filter(Boolean)); mode = 'study'; currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); showQ() };
function searchPage() { app.innerHTML = `<h1>Search Questions</h1><div class="search-box"><input id="searchInput" placeholder="Search insulin, HIPAA, ECG, sterilization..."><select id="searchArea"><option value="all">All work areas</option><option value="general">General</option><option value="admin">Administrative</option><option value="clinical">Clinical</option></select></div><div id="searchResults" class="result-list"></div>`; $('#searchInput').oninput = runSearch; $('#searchArea').onchange = runSearch; runSearch() }
function runSearch() { const term = $('#searchInput').value.trim().toLowerCase(), area = $('#searchArea').value; let pool = area === 'all' ? allBank : areaBank(area), res = pool.filter(q => !term || [q.q, q.topic, q.exp, q.tip, ...q.choices].join(' ').toLowerCase().includes(term)).slice(0, 40); $('#searchResults').innerHTML = res.map(q => `<div class="result-item" onclick="openSingle('${q.id}')"><div class="kicker">${q.topic} • ${q.difficulty}</div><strong>${q.q}</strong></div>`).join('') || '<p class="muted">No matches found.</p>' }
window.openSingle = id => { let q = allBank.find(x => x.id === id); activeQuiz = [q]; mode = 'study'; currentIndex = 0; answers = {}; confidence = {}; checked = {}; showQ() };
function customExam() { app.innerHTML = `<h1>Build a Custom Exam</h1><section class="card custom-grid"><label>Work area<select id="cArea"><option value="all">All work areas</option><option value="general">General</option><option value="admin">Administrative</option><option value="clinical">Clinical</option></select></label><label>Difficulty<select id="cDiff"><option value="all">All difficulties</option><option>Easy</option><option>Moderate</option><option>Hard</option></select></label><label>Number of questions<input id="cCount" type="number" min="5" max="210" value="25"></label><label>Mode<select id="cMode"><option value="study">Study Mode</option><option value="exam">Exam Mode</option></select></label><button class="btn btn-primary" onclick="launchCustom()">Start Custom Exam</button></section>` }
window.launchCustom = () => { const area = $('#cArea').value, diff = $('#cDiff').value, n = Math.max(5, Math.min(210, +$('#cCount').value || 25)), m = $('#cMode').value; let pool = area === 'all' ? allBank : areaBank(area); if (diff !== 'all') pool = pool.filter(q => q.difficulty === diff); if (!pool.length) { alert('No questions match those filters.'); return } activeQuiz = sh(pool).slice(0, Math.min(n, pool.length)); mode = m; currentIndex = 0; answers = {}; confidence = {}; checked = {}; recordStudyDay(); beginStudySession(); showQ() };

function longestStreak() {
  if (!state.studyDates.length) return 0;
  const days = [...new Set(state.studyDates)].sort();
  let best = 1, current = 1;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1]), b = new Date(days[i]);
    const diff = Math.round((b - a) / 86400000);
    if (diff === 1) { current++; best = Math.max(best, current) } else if (diff > 1) { current = 1 }
  }
  return best;
}
function areaStats() {
  const map = { general: { correct: 0, total: 0 }, admin: { correct: 0, total: 0 }, clinical: { correct: 0, total: 0 } };
  state.attempts.forEach(a => {
    if (!map[a.area]) return;
    map[a.area].correct += a.correct || 0;
    map[a.area].total += a.total || 0;
  });
  return map;
}
function studyRecommendation() {
  const stats = Object.entries(state.topicStats).map(([t, s]) => ({ t, score: pct(s.correct, s.total) })).sort((a, b) => a.score - b.score);
  if (!stats.length) return "Complete a quiz so RMA Mastery+ can recommend your next study target.";
  const w = stats[0];
  return `Focus next on ${w.t}. Your current accuracy there is ${w.score}%. Try a 10-question Study Mode quiz in that topic.`;
}
function scoreTrendHtml() {
  const recent = state.attempts.slice(-10);
  if (!recent.length) return '<p class="muted">Complete quizzes to build your score trend.</p>';
  return `<div class="score-trend">${recent.map(a => `<div class="score-bar" style="height:${Math.max(8, a.score)}%"><span>${a.score}%</span></div>`).join('')}</div>`;
}
function areaBarsHtml() {
  const s = areaStats();
  const rows = [
    ['Work Area I — General', s.general],
    ['Work Area II — Administrative', s.admin],
    ['Work Area III — Clinical', s.clinical]
  ];
  return `<div class="bar-chart">${rows.map(([label, v]) => {
    const score = pct(v.correct, v.total);
    return `<div class="bar-row"><strong>${label}</strong><div class="bar-track"><div class="bar-fill" style="width:${score}%"></div></div><strong>${score}%</strong></div>`;
  }).join('')}</div>`;
}

function attemptsByArea() {
  const out = { general: [], admin: [], clinical: [] };
  state.attempts.forEach(a => { if (out[a.area]) out[a.area].push(a) });
  return out;
}
function areaAccuracyRows() {
  const groups = attemptsByArea();
  return [
    ['Work Area I — General', 'general', groups.general],
    ['Work Area II — Administrative', 'admin', groups.admin],
    ['Work Area III — Clinical', 'clinical', groups.clinical]
  ].map(([label, key, arr]) => {
    const correct = arr.reduce((s, a) => s + (a.correct || 0), 0);
    const total = arr.reduce((s, a) => s + (a.total || 0), 0);
    return { label, key, score: pct(correct, total), attempts: arr.length, correct, total };
  });
}
function firstAndLatestScore() {
  if (!state.attempts.length) return { first: 0, latest: 0, change: 0 };
  const first = state.attempts[0].score || 0, latest = state.attempts.at(-1).score || 0;
  return { first, latest, change: latest - first };
}
function readinessMessage() {
  const r = readiness();
  if (r >= 90) return "Excellent readiness. Keep reviewing missed questions and maintain consistency.";
  if (r >= 80) return "You are in a strong range. Focus on your weakest topic and keep taking mixed exams.";
  if (r >= 65) return "You are improving. Build accuracy in your weakest work area to move above 80%.";
  if (state.attempts.length) return "Keep practicing. Use Smart Study and review missed questions after every quiz.";
  return "Complete your first quiz so RMA Mastery+ can calculate your readiness.";
}
function predictedExamScore() {

  if (!state.attempts.length) return 0;

  const recent = state.attempts.slice(-8);
  const recentAverage = Math.round(
    recent.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / recent.length
  );

  return Math.round((recentAverage * 0.7) + (readiness() * 0.3));
}
function studyCoachRecommendation() {
  if (!state.attempts.length) {
    return {
      title: "Start with a mixed quiz",
      reason: "Complete your first quiz so RMA Mastery+ can personalize your study plan.",
      area: "general"
    };
    const weakest = [...attemptsByArea()].sort((a, b) => a.score - b.score)[0];

    return {
      title: `Focus on ${weakest.label}`,
      reason: `Your current accuracy in this area is ${weakest.score}%.`,
      area: weakest.key
    };
  }
}
function weakestTopics(limit = 5) {
  return Object.entries(state.topicStats)
    .map(([t, s]) => ({ t, score: pct(s.correct, s.total), correct: s.correct, total: s.total }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}
function quizHistoryHtml() {
  const recent = [...state.attempts].slice(-8).reverse();
  if (!recent.length) return '<p class="muted">No quiz history yet.</p>';
  return `<div class="history-list">${recent.map(a => {
    const date = new Date(a.date).toLocaleDateString();
    const area = areaName(a.area || 'general');
    return `<div class="history-item"><div><strong>${area}</strong><div class="small muted">${date} • ${a.mode === 'exam' ? 'Exam Mode' : 'Study Mode'} • ${a.total} questions</div></div><strong>${a.score}%</strong><span class="small muted">${a.correct}/${a.total}</span></div>`;
  }).join('')}</div>`;
}
function exportProgressCsv() {
  const rows = [['Date', 'Work Area', 'Mode', 'Score', 'Correct', 'Total']];
  state.attempts.forEach(a => rows.push([new Date(a.date).toLocaleString(), areaName(a.area || 'general'), a.mode || 'study', a.score, a.correct, a.total]));
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' }), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'RMA-Mastery-Progress.csv'; link.click(); URL.revokeObjectURL(url);
}
function printProgress() { window.print() }
function progress() {
  checkAchievements();
  const a = state.attempts;
  const avg = a.length ? Math.round(a.reduce((x, y) => x + y.score, 0) / a.length) : 0;
  const best = a.length ? Math.max(...a.map(x => x.score)) : 0;
  const totalAnswered = a.reduce((s, x) => s + (x.total || 0), 0);
  const totalCorrect = a.reduce((s, x) => s + (x.correct || 0), 0);
  const overallAccuracy = pct(totalCorrect, totalAnswered);
  const stats = Object.entries(state.topicStats).map(([t, s]) => ({ t, score: pct(s.correct, s.total), correct: s.correct, total: s.total })).sort((x, y) => y.score - x.score);
  const strongest = stats[0], weakest = stats.at(-1);
  const rows = stats.map(s => `<div class="analytics-row"><div><strong>${s.t}</strong><div class="meter"><div style="width:${s.score}%"></div></div></div><strong>${s.score}%</strong></div>`).join('');
  const cs = state.confidenceStats, totalC = (cs.high || 0) + (cs.medium || 0) + (cs.guess || 0);
  const dots = Array.from({ length: 42 }, (_, i) => { let d = new Date(); d.setDate(d.getDate() - (41 - i)); return `<div class="day-dot ${state.studyDates.includes(d.toISOString().slice(0, 10)) ? 'active' : ''}" title="${d.toISOString().slice(0, 10)}"></div>` }).join('');
  const areaRows = areaAccuracyRows();
  const trend = firstAndLatestScore();
  const weak = weakestTopics();
  const coach = studyCoachRecommendation();
  const predicted = predictedExamScore();
  const daysSince = state.firstStudyDate ? Math.max(1, Math.ceil((Date.now() - new Date(state.firstStudyDate)) / 86400000)) : 0;

  app.innerHTML = `<h1>Progress & Analytics</h1>
  <p class="muted">Version 4.4 turns your study history into a complete progress report.</p>
  <div class="print-report"><button class="btn btn-primary" onclick="printProgress()">Print Progress Report</button><button class="btn btn-secondary" onclick="exportProgressCsv()">Export Quiz History</button></div>

  ${profileCard()}

  <section class="analytics-hero" style="margin-top:18px">
    <article class="card"><div class="kicker">RMA Exam Readiness</div><div class="readiness-ring" style="--p:${readiness()}"><strong>${readiness()}%</strong></div><p class="center muted">${readinessMessage()}</p></article>
    <article class="card"><div class="kicker">Since You Started</div><div class="since-started">
      <div class="since-item"><span class="muted">Questions answered</span><strong>${totalAnswered}</strong></div>
      <div class="since-item"><span class="muted">Overall accuracy</span><strong>${overallAccuracy}%</strong></div>
      <div class="since-item"><span class="muted">Study time</span><strong>${formatStudyTime(state.studySeconds || 0)}</strong></div>
      <div class="since-item"><span class="muted">Days active</span><strong>${state.studyDates.length}</strong></div>
      <div class="since-item"><span class="muted">XP earned</span><strong>${state.xp || 0}</strong></div>
      <div class="since-item"><span class="muted">Badges earned</span><strong>${unlockedAchievementIds().size}</strong></div>
    </div></article>
  </section>

  <section class="metric-grid" style="margin-top:18px">
    <article class="metric-card"><div class="muted">Quiz attempts</div><div class="metric-value">${a.length}</div></article>
    <article class="metric-card"><div class="muted">Average score</div><div class="metric-value">${avg}%</div></article>
    <article class="metric-card"><div class="muted">Best score</div><div class="metric-value">${best}%</div></article>
    <article class="metric-card"><div class="muted">Current streak</div><div class="metric-value">🔥 ${streak()}</div></article>
    <article class="metric-card"><div class="muted">Longest streak</div><div class="metric-value">${longestStreak()} days</div></article>
    <article class="metric-card"><div class="muted">Score change</div><div class="metric-value">${trend.change >= 0 ? '+' : ''}${trend.change}%</div></article>
  </section>

  <section class="card chart-card" style="margin-top:18px"><h2>Progress Over Time</h2>${scoreTrendHtml()}<div class="legend"><span><i class="legend-dot"></i>Last 10 quiz scores</span></div></section>

  <section class="card chart-card" style="margin-top:18px"><h2>Performance by Work Area</h2>
    <table class="analytics-table"><thead><tr><th>Work Area</th><th>Accuracy</th><th>Attempts</th><th>Correct</th></tr></thead><tbody>
    ${areaRows.map(r => `<tr><td>${r.label}</td><td><div class="bar-track"><div class="bar-fill" style="width:${r.score}%"></div></div><strong>${r.score}%</strong></td><td>${r.attempts}</td><td>${r.correct}/${r.total}</td></tr>`).join('')}
    </tbody></table>
  </section>

 <section class="grid" style="margin-top:18px">
    <article class="card"><span class="badge badge-good">Strongest Topic</span><h2>${strongest ? strongest.t : 'Not enough data yet'}</h2><p>${strongest ? strongest.score + '% accuracy' : 'Complete a quiz to calculate.'}</p></article>
    <article class="card"><span class="badge badge-warn">Needs Review</span><h2>${weakest ? weakest.t : 'Not enough data yet'}</h2><p>${weakest ? weakest.score + '% accuracy' : 'Complete a quiz to calculate.'}</p></article>
  </section>

  <section class="card" style="margin-top:18px"><h2>Weakest Topics</h2>
    ${weak.length ? weak.map((w, i) => `<div class="topic-rank"><div class="rank-badge">${i + 1}</div><div><strong>${w.t}</strong><div class="small muted">${w.correct}/${w.total} correct • ${w.score}% accuracy</div></div><button class="btn btn-secondary study-now" onclick='startTopic(${JSON.stringify(w.t)})'>Study Now</button></div>`).join('') : '<p class="muted">Complete quizzes to identify your weakest topics.</p>'}
  </section>

  <section class="card" style="margin-top:18px"><h2>Performance by Topic</h2>${rows || '<p class="muted">Complete a quiz to begin tracking.</p>'}</section>

  <section class="card" style="margin-top:18px"><h2>Confidence Breakdown</h2>
    ${totalC ? `<p>😊 Confident: ${pct(cs.high || 0, totalC)}% &nbsp; • &nbsp; 😐 Unsure: ${pct(cs.medium || 0, totalC)}% &nbsp; • &nbsp; 😬 Guessed: ${pct(cs.guess || 0, totalC)}%</p>` : '<p class="muted">Use the confidence buttons during quizzes.</p>'}
  </section>

  <section class="card" style="margin-top:18px"><h2>42-Day Study Calendar</h2><div class="calendar">${dots}</div><div class="heatmap-legend"><span class="heatmap-swatch"></span> No study <span class="heatmap-swatch active"></span> Studied</div></section>

  <section class="card" style="margin-top:18px"><h2>Recent Quiz History</h2>${quizHistoryHtml()}</section>

<section class="card recommendation" style="margin-top:18px">
  <div class="kicker">🧠 Study Coach</div>
<h2>${coach?.title || 'Keep Building Momentum'}</h2>
<p>${coach?.reason || 'Keep practicing your weakest topics and reviewing missed questions.'}</p>

  <div class="coach-actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;">
    <button class="btn btn-primary" onclick="adaptiveQuiz()">
      Study Weakest Topics
    </button>

    <button class="btn btn-secondary" onclick="study()">
      Review by Topic
    </button>
  </div>
</section>

<section class="card" style="margin-top:18px">
  <h2>Achievement Progress</h2>
  <p>${unlockedAchievementIds().size} of ${achievementDefs.length} achievements unlocked.</p>
</section>
`;
}
init();