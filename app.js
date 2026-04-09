'use strict';

// ============================================================
// LANDING — SCROLL REVEALS
// ============================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ============================================================
// HERO FADE ON SCROLL
// ============================================================
const heroBody    = document.querySelector('.hero-body');
const heroBgCards = document.querySelectorAll('.bg-card');
const heroExplore = document.querySelector('.hero-explore');

window.addEventListener('scroll', () => {
  const vh = window.innerHeight;
  const progress = Math.min(window.scrollY / (vh * 0.45), 1);
  if (heroBody) {
    heroBody.style.opacity  = 1 - progress;
    heroBody.style.transform = `translate(-50%, calc(-50% - ${progress * 28}px))`;
  }
  heroBgCards.forEach(card => {
    card.style.opacity = 0.5 * (1 - progress);
  });
  if (heroExplore) {
    heroExplore.style.opacity = Math.max(0, 1 - progress * 3);
  }
}, { passive: true });

// ============================================================
// FEAT-ROW REVEAL ON SCROLL
// ============================================================
const featRowObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('feat-visible');
      featRowObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -48px 0px' });

document.querySelectorAll('.feat-row').forEach(el => featRowObserver.observe(el));

// ============================================================
// LANDING — CYCLING WORD
// ============================================================
const CYCLING_WORDS = ['unfair', 'secret', 'hidden', 'mathematical', 'real'];
let wordIndex = 0;
const wordEl = document.getElementById('cycling-word');
if (wordEl) {
  setInterval(() => {
    wordIndex = (wordIndex + 1) % CYCLING_WORDS.length;
    wordEl.classList.add('exiting');
    setTimeout(() => {
      wordEl.textContent = CYCLING_WORDS[wordIndex];
      wordEl.classList.remove('exiting');
      wordEl.classList.add('entering');
      setTimeout(() => wordEl.classList.remove('entering'), 400);
    }, 350);
  }, 2800);
}

// ============================================================
// APP STATE
// ============================================================
const AppState = {
  skillStatus: {
    'basic-strategy':  { done: false, correct: 0, total: 0 },
    'keep-counting':   { done: false },
    'deviations':      { done: false, correct: 0, total: 0 },
    'deck-estimation': { done: false, correct: 0, total: 0 },
    'true-count':      { done: false, correct: 0, total: 0 },
    'bet-spread':      { done: false },
    'full-training':   { done: false, correct: 0, total: 0 },
  }
};

// ============================================================
// ACCOUNT SYSTEM (localStorage)
// ============================================================
const SKILL_IDS = ['basic-strategy','keep-counting','deviations','deck-estimation','true-count','bet-spread'];
const SKILL_NAMES = {
  'basic-strategy': 'Basic Strategy',
  'keep-counting': 'Running Count',
  'deviations': 'Deviations',
  'deck-estimation': 'Deck Estimation',
  'true-count': 'True Count',
  'bet-spread': 'Bet Spread',
};

const Account = {
  _load() {
    try { return JSON.parse(localStorage.getItem('bj_accounts') || '{}'); } catch { return {}; }
  },
  _save(accounts) {
    localStorage.setItem('bj_accounts', JSON.stringify(accounts));
  },
  currentUser() {
    return localStorage.getItem('bj_current_user') || null;
  },
  signUp(username, pin) {
    const accounts = this._load();
    if (accounts[username]) return { error: 'Username already taken.' };
    accounts[username] = { pin, stats: {}, sessions: 0, createdAt: Date.now() };
    SKILL_IDS.forEach(id => { accounts[username].stats[id] = { correct: 0, total: 0 }; });
    this._save(accounts);
    localStorage.setItem('bj_current_user', username);
    return { ok: true };
  },
  signIn(username, pin) {
    const accounts = this._load();
    if (!accounts[username]) return { error: 'Account not found.' };
    if (accounts[username].pin !== pin) return { error: 'Incorrect PIN.' };
    localStorage.setItem('bj_current_user', username);
    return { ok: true };
  },
  signOut() {
    localStorage.removeItem('bj_current_user');
  },
  addResult(skillId, isCorrect) {
    const user = this.currentUser();
    if (!user) return;
    const accounts = this._load();
    if (!accounts[user]) return;
    if (!accounts[user].stats[skillId]) accounts[user].stats[skillId] = { correct: 0, total: 0 };
    accounts[user].stats[skillId].total++;
    if (isCorrect) accounts[user].stats[skillId].correct++;
    this._save(accounts);
  },
  markSession() {
    const user = this.currentUser();
    if (!user) return;
    const accounts = this._load();
    if (!accounts[user]) return;
    accounts[user].sessions = (accounts[user].sessions || 0) + 1;
    this._save(accounts);
  },
  getStats() {
    const user = this.currentUser();
    if (!user) return null;
    const accounts = this._load();
    return accounts[user] || null;
  }
};

// ============================================================
// VIEW ROUTER
// ============================================================
const VIEWS = ['landing', 'pipeline', 'skill-trainer', 'dashboard'];

function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
}

function goLanding()  { showView('landing'); }
function goPipeline() { showView('pipeline'); renderPipelineStatus(); }
function goSkill(id)  { showView('skill-trainer'); launchSkill(id); }
function goDashboard() { showView('dashboard'); renderDashboard(); }

function syncAuthUI() {
  const user = Account.currentUser();
  const pipeBtn = document.getElementById('pipe-nav-account');
  if (pipeBtn) pipeBtn.textContent = user ? `@${user}` : 'Sign In';
}

function renderDashboard() {
  const body = document.getElementById('dashboard-body');
  if (!body) return;
  const user = Account.currentUser();
  if (!user) { body.innerHTML = '<p style="color:#aaa;text-align:center;padding:2rem">Sign in to see your stats.</p>'; return; }
  const data = Account.getStats();
  if (!data) { body.innerHTML = '<p style="color:#aaa">No data found.</p>'; return; }

  const stats = data.stats || {};
  let totalCorrect = 0, totalAttempts = 0;
  SKILL_IDS.forEach(id => {
    const s = stats[id] || { correct: 0, total: 0 };
    totalCorrect += s.correct;
    totalAttempts += s.total;
  });
  const globalPct = totalAttempts > 0 ? Math.round(totalCorrect / totalAttempts * 100) : 0;

  const weaknesses = SKILL_IDS.filter(id => {
    const s = stats[id] || { correct: 0, total: 0 };
    return s.total >= 10 && (s.correct / s.total) < 0.75;
  });
  const strengths = SKILL_IDS.filter(id => {
    const s = stats[id] || { correct: 0, total: 0 };
    return s.total >= 10 && (s.correct / s.total) >= 0.85;
  });

  body.innerHTML = `<div class="dash-container">
    <div class="dash-user-header">
      <div class="dash-avatar">${user[0].toUpperCase()}</div>
      <div>
        <div class="dash-username">@${user}</div>
        <div class="dash-since">${data.sessions || 0} sessions</div>
      </div>
    </div>
    <div class="dash-global-stats">
      <div class="dash-global-item"><div class="dash-global-num">${totalAttempts}</div><div class="dash-global-label">Total Attempts</div></div>
      <div class="dash-global-divider"></div>
      <div class="dash-global-item"><div class="dash-global-num">${globalPct}%</div><div class="dash-global-label">Accuracy</div></div>
      <div class="dash-global-divider"></div>
      <div class="dash-global-item"><div class="dash-global-num">${weaknesses.length}</div><div class="dash-global-label">Weak Areas</div></div>
    </div>
    ${weaknesses.length ? `<div class="dash-section-title">Needs Work</div><div class="dash-tag-row">${weaknesses.map(id=>`<span class="dash-tag dash-tag-weak">${SKILL_NAMES[id]}</span>`).join('')}</div>` : ''}
    ${strengths.length ? `<div class="dash-section-title">Strengths</div><div class="dash-tag-row">${strengths.map(id=>`<span class="dash-tag dash-tag-strong">${SKILL_NAMES[id]}</span>`).join('')}</div>` : ''}
    <div class="dash-section-title">Skill Breakdown</div>
    <div class="dash-skills-grid">
      ${SKILL_IDS.map(id => {
        const s = stats[id] || { correct: 0, total: 0 };
        const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
        const cls = s.total < 5 ? 'dash-bar-neutral' : pct >= 85 ? 'dash-bar-good' : pct >= 65 ? 'dash-bar-ok' : 'dash-bar-bad';
        return `<div class="dash-skill-card">
          <div class="dash-skill-top">
            <div class="dash-skill-name">${SKILL_NAMES[id]}</div>
            <div class="dash-skill-pct">${s.total > 0 ? pct+'%' : '—'}</div>
          </div>
          <div class="dash-skill-detail">${s.correct}/${s.total} correct</div>
          <div class="dash-bar-track" style="margin-top:0.4rem"><div class="dash-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:2rem">
      <button class="btn-primary" id="dash-signout" style="background:#333;font-size:.85rem;padding:.5rem 1.2rem">Sign Out</button>
    </div>
  </div>`;

  document.getElementById('dash-signout').addEventListener('click', () => {
    Account.signOut();
    syncAuthUI();
    goLanding();
  });
}

// ============================================================
// PIPELINE
// ============================================================
function renderPipelineStatus() {
  Object.entries(AppState.skillStatus).forEach(([id, status]) => {
    const badge  = document.getElementById(`badge-${id}`);
    const circle = document.getElementById(`circle-${id}`);
    if (badge && status.done) {
      badge.textContent = 'Complete';
      badge.classList.add('done');
    }
    if (circle && status.done) {
      circle.classList.add('done');
      circle.textContent = '✓';
    }
  });
}

document.querySelectorAll('.pipe-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.skill;
    if (skill) goSkill(skill);
  });
});

// ============================================================
// SKILL LAUNCHER
// ============================================================
let activeSkillCleanup = null;

function launchSkill(skillId) {
  if (activeSkillCleanup) { activeSkillCleanup(); activeSkillCleanup = null; }

  const titleEl = document.getElementById('skill-nav-title');
  const scoreEl = document.getElementById('skill-nav-score');
  const bodyEl  = document.getElementById('skill-body');

  const SKILLS = {
    'basic-strategy':  BasicStrategy,
    'keep-counting':   KeepCounting,
    'deviations':      Deviations,
    'deck-estimation': DeckEstimation,
    'true-count':      TrueCount,
    'bet-spread':      BetSpread,
    'full-training':   FullTraining,
  };

  const skill = SKILLS[skillId];
  if (!skill) return;

  titleEl.textContent = skill.name;
  scoreEl.textContent = '';
  bodyEl.innerHTML = '';

  Account.markSession();
  activeSkillCleanup = skill.start(bodyEl, scoreEl, skillId);
}

// ============================================================
// SHARED HELPERS
// ============================================================
const HILO = {
  '2':1,'3':1,'4':1,'5':1,'6':1,
  '7':0,'8':0,'9':0,
  '10':-1,'J':-1,'Q':-1,'K':-1,'A':-1
};
const SUITS = [
  { name:'spades',   sym:'♠' },
  { name:'hearts',   sym:'♥' },
  { name:'diamonds', sym:'♦' },
  { name:'clubs',    sym:'♣' },
];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function buildDeck() {
  const d = [];
  for (const s of SUITS)
    for (const r of RANKS)
      d.push({ rank:r, suit:s.name, sym:s.sym, value:HILO[r] });
  return d;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
function cardEl(card, size='') {
  const d = document.createElement('div');
  d.className = `card suit-${card.suit}${size?' '+size:''}`;
  d.innerHTML = `<span class="rank tl">${card.rank}</span><span class="suit-sym">${card.sym}</span><span class="rank br">${card.rank}</span>`;
  return d;
}
function dealAnim(el, delay=0) {
  el.style.animationDelay = delay+'ms';
  el.classList.add('dealing');
}
function btn(text, cls='btn-primary') {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  return b;
}
function markScore(el, correct, total) {
  el.textContent = `${correct} / ${total} correct`;
}

// ============================================================
// SKILL 1 — BASIC STRATEGY
// ============================================================
// Dealer upcards index: 0=2, 1=3, 2=4, 3=5, 4=6, 5=7, 6=8, 7=9, 8=T, 9=A
// H=Hit, S=Stand, D=Double, P=Split
const BS_HARD = {
   8: 'HHHHHHHHHH',
   9: 'HDDDDHHHHH',
  10: 'DDDDDDDDHS',  // 10 vs A = H (no double)
  11: 'DDDDDDDDDH',
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH',
  14: 'SSSSSHHHHH',
  15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH',
  17: 'SSSSSSSSSS',
};
const BS_SOFT = {
  13: 'HHHDDHHHHH', // A2
  14: 'HHHDDHHHHH', // A3
  15: 'HHDDDHHHHH', // A4
  16: 'HHDDDHHHHH', // A5
  17: 'HDDDDHHHHH', // A6
  18: 'SDDDDSSHHH', // A7
  19: 'SSSSSSSSS',  // A8
  20: 'SSSSSSSSSS', // A9 (A+9)
};
const BS_PAIRS = {
  'AA': 'PPPPPPPPPP',
  '22': 'PPPPPPHHHH',
  '33': 'PPPPPPHHHH',
  '44': 'HHHPPHHHH',
  '55': 'DDDDDDDDHS', // treat as 10
  '66': 'PPPPPHHHHH',
  '77': 'PPPPPPPHHH',
  '88': 'PPPPPPPPPP',
  '99': 'PPPPPSPPS',
  'TT': 'SSSSSSSSSS',
};

const DEALER_LABELS = ['2','3','4','5','6','7','8','9','10','A'];
const ACTION_LABELS = { H:'Hit', S:'Stand', D:'Double', P:'Split' };

function bsLookup(hand, dealerIdx) {
  if (hand.type === 'pair') {
    const key = hand.pairKey;
    return (BS_PAIRS[key] || 'SSSSSSSSSS')[dealerIdx];
  }
  if (hand.soft) return (BS_SOFT[hand.total] || 'SSSSSSSSSS')[dealerIdx];
  if (hand.total >= 17) return 'S';
  return (BS_HARD[hand.total] || 'SSSSSSSSSS')[dealerIdx];
}

function randomHand() {
  const r = Math.random();
  if (r < 0.15) {
    // Pair
    const pairs = ['AA','22','33','44','55','66','77','88','99','TT'];
    const p = pairs[Math.floor(Math.random()*pairs.length)];
    return { type:'pair', pairKey:p, label: p[0]==='T'?'10-10':p[0]+'-'+p[0], soft:false };
  }
  if (r < 0.35) {
    // Soft hand A2-A9
    const x = Math.floor(Math.random()*8)+2; // 2..9
    const total = x + 11; // ace=11
    return { type:'soft', total, label:`A-${x}`, soft:true };
  }
  // Hard hand 8-16
  const total = Math.floor(Math.random()*9)+8; // 8..16
  return { type:'hard', total, label:`Hard ${total}`, soft:false };
}

const BasicStrategy = {
  name: 'Basic Strategy',
  start(body, scoreEl, skillId) {
    let correct=0, total=0, phase='question', hand, dealerIdx, correctAction;

    const wrap = document.createElement('div');
    wrap.className = 'kc-wrapper';
    wrap.style.maxWidth = '520px';
    wrap.style.width = '100%';

    wrap.innerHTML = `
      <div class="sk-score-bar" id="bs-score-bar">
        <div class="sk-score-item"><div class="sk-score-num" id="bs-correct">0</div><div>Correct</div></div>
        <div class="sk-score-item"><div class="sk-score-num" id="bs-total">0</div><div>Total</div></div>
      </div>

      <div class="felt-table">
        <div class="felt-dealer-zone">
          <span class="felt-zone-label">Dealer</span>
          <div class="felt-hand" id="bs-dealer-hand"></div>
        </div>
        <hr class="felt-divider">
        <div class="felt-player-zone">
          <span class="felt-zone-label">You</span>
          <div class="felt-hand" id="bs-player-hand"></div>
        </div>
      </div>

      <div class="sk-actions" id="bs-actions"></div>
      <div class="sk-feedback hidden" id="bs-feedback">
        <span class="sk-feedback-icon" id="bs-icon"></span>
        <span id="bs-msg"></span>
      </div>
      <button class="btn-primary sk-next-btn" id="bs-next">Next Hand →</button>
    `;
    body.appendChild(wrap);

    const dealerHandEl = wrap.querySelector('#bs-dealer-hand');
    const playerHandEl = wrap.querySelector('#bs-player-hand');
    const actionsEl = wrap.querySelector('#bs-actions');
    const feedbackEl= wrap.querySelector('#bs-feedback');
    const nextEl    = wrap.querySelector('#bs-next');
    const correctEl = wrap.querySelector('#bs-correct');
    const totalEl   = wrap.querySelector('#bs-total');

    function cardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function renderQuestion() {
      phase = 'question';
      hand = randomHand();
      dealerIdx = Math.floor(Math.random()*10);
      correctAction = bsLookup(hand, dealerIdx);

      // Dealer: one face-down + upcard
      dealerHandEl.innerHTML = '';
      dealerHandEl.appendChild(cardBackEl());
      const dr = DEALER_LABELS[dealerIdx];
      const ds = SUITS[Math.floor(Math.random()*4)];
      dealerHandEl.appendChild(cardEl({rank:dr, suit:ds.name, sym:ds.sym}));

      // Player hand
      playerHandEl.innerHTML = '';
      if (hand.type === 'pair') {
        const r = hand.pairKey[0]==='T'?'10':hand.pairKey[0];
        const suits = shuffle([...SUITS]);
        playerHandEl.appendChild(cardEl({rank:r,suit:suits[0].name,sym:suits[0].sym}));
        playerHandEl.appendChild(cardEl({rank:r,suit:suits[1].name,sym:suits[1].sym}));
      } else if (hand.type === 'soft') {
        const x = hand.total - 11;
        const suits = shuffle([...SUITS]);
        playerHandEl.appendChild(cardEl({rank:'A',suit:suits[0].name,sym:suits[0].sym}));
        playerHandEl.appendChild(cardEl({rank:String(x),suit:suits[1].name,sym:suits[1].sym}));
      } else {
        const a = Math.min(Math.floor(Math.random()*(hand.total-3))+2, 9);
        const b = hand.total - a;
        const bRank = b===10?'10':String(b);
        const suits = shuffle([...SUITS]);
        playerHandEl.appendChild(cardEl({rank:String(a),suit:suits[0].name,sym:suits[0].sym}));
        playerHandEl.appendChild(cardEl({rank:bRank,suit:suits[1].name,sym:suits[1].sym}));
      }

      // Action buttons
      actionsEl.innerHTML = '';
      const actions = hand.type === 'pair' ? ['H','S','D','P'] : ['H','S','D'];
      actions.forEach(a => {
        const b = document.createElement('button');
        b.className = 'sk-action-btn';
        b.textContent = ACTION_LABELS[a];
        b.dataset.action = a;
        b.addEventListener('click', () => answer(a));
        actionsEl.appendChild(b);
      });

      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');
    }

    function answer(chosen) {
      if (phase !== 'question') return;
      phase = 'feedback';
      total++;
      const isCorrect = chosen === correctAction;
      if (isCorrect) correct++;

      // Mark buttons
      actionsEl.querySelectorAll('.sk-action-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.action === correctAction) b.classList.add('correct');
        if (b.dataset.action === chosen && !isCorrect) b.classList.add('wrong');
      });

      feedbackEl.classList.remove('hidden','correct','wrong');
      feedbackEl.classList.add(isCorrect?'correct':'wrong');
      feedbackEl.querySelector('#bs-icon').textContent = isCorrect ? '✓' : '✗';
      const actionName = ACTION_LABELS[correctAction] || correctAction;
      feedbackEl.querySelector('#bs-msg').textContent = isCorrect
        ? `Correct! ${actionName} is the right play here.`
        : `The correct play is ${actionName}. ${hand.label} vs ${DEALER_LABELS[dealerIdx]} — remember it.`;

      correctEl.textContent = correct;
      totalEl.textContent   = total;
      markScore(scoreEl, correct, total);

      Account.addResult(skillId, isCorrect);
      if (total >= 5) AppState.skillStatus[skillId].done = true;
      nextEl.classList.add('visible');
    }

    nextEl.addEventListener('click', renderQuestion);
    renderQuestion();
    return () => {};
  }
};

// ============================================================
// SKILL 2 — KEEP COUNTING
// ============================================================
const KC_LEVELS = [
  { level:1, name:'Beginner',     cards:1, timerMs:null,  xpRequired:0  },
  { level:2, name:'Apprentice',   cards:2, timerMs:null,  xpRequired:10 },
  { level:3, name:'Intermediate', cards:3, timerMs:8000,  xpRequired:25 },
  { level:4, name:'Advanced',     cards:4, timerMs:5000,  xpRequired:45 },
  { level:5, name:'Expert',       cards:5, timerMs:3000,  xpRequired:70 },
];

const KeepCounting = {
  name: 'Running Count',
  start(body, scoreEl, skillId) {
    let deck=[], deckIdx=0, runningCount=0, playerCount=0;
    let score=0, streak=0;
    let phase='dealing', revealTimers=[], currentCards=[];

    body.innerHTML = `
      <div class="kc-wrapper">
        <div class="kc-header">
          <div class="kc-stat">
            <div class="kc-stat-val" id="kc-score">0</div>
            <div class="kc-stat-label">Correct</div>
          </div>
          <div class="kc-stat">
            <div class="kc-stat-val" id="kc-streak">0</div>
            <div class="kc-stat-label">Streak</div>
          </div>
        </div>

        <div class="kc-speed-wrap">
          <span class="kc-speed-label">Speed</span>
          <input type="range" id="kc-speed" min="400" max="3000" step="200" value="1200">
          <span class="kc-speed-val" id="kc-speed-val">1.2s</span>
        </div>

        <div class="sk-card-stage" id="kc-stage" style="min-height:130px">
          <div style="text-align:center;color:var(--tr-dim);opacity:.5">♠ ♥ ♦ ♣</div>
        </div>

        <div id="kc-input-section" class="hidden">
          <div style="font-size:.82rem;color:var(--tr-muted);text-align:center;margin-bottom:.5rem">What is the running count?</div>
          <div class="count-controls">
            <button class="stepper-btn" id="kc-minus">−</button>
            <div class="count-display" id="kc-display">0</div>
            <button class="stepper-btn" id="kc-plus">+</button>
          </div>
          <div style="display:flex;justify-content:center;margin-top:1rem">
            <button class="btn-primary btn-submit" id="kc-submit">Submit Count</button>
          </div>
          <p class="keyboard-hint" style="margin-top:.5rem">or press <kbd>Enter</kbd> · <kbd>↑</kbd><kbd>↓</kbd> to adjust</p>
        </div>

        <div class="sk-feedback hidden" id="kc-feedback">
          <span class="sk-feedback-icon" id="kc-icon"></span>
          <span id="kc-msg"></span>
          <div id="kc-breakdown" style="font-size:.8rem;color:var(--tr-muted);font-family:monospace;white-space:pre-line;margin-top:.5rem"></div>
        </div>
        <button class="btn-primary sk-next-btn" id="kc-next">Next Round →</button>

        <div class="hilo-ref-strip">
          <div class="ref-group"><span class="ref-cards">2–6</span><span class="ref-val c-green">+1</span></div>
          <span class="ref-sep">·</span>
          <div class="ref-group"><span class="ref-cards">7–9</span><span class="ref-val" style="color:var(--tr-muted)">0</span></div>
          <span class="ref-sep">·</span>
          <div class="ref-group"><span class="ref-cards">10 J Q K A</span><span class="ref-val c-red">−1</span></div>
        </div>
      </div>
    `;

    const scoreEl2 = body.querySelector('#kc-score');
    const strkEl   = body.querySelector('#kc-streak');
    const stageEl  = body.querySelector('#kc-stage');
    const inputSec = body.querySelector('#kc-input-section');
    const displayEl= body.querySelector('#kc-display');
    const feedbackEl= body.querySelector('#kc-feedback');
    const nextEl   = body.querySelector('#kc-next');
    const minusBtn = body.querySelector('#kc-minus');
    const plusBtn  = body.querySelector('#kc-plus');
    const submitBtn= body.querySelector('#kc-submit');
    const speedSlider = body.querySelector('#kc-speed');
    const speedValEl  = body.querySelector('#kc-speed-val');

    function getSpeedMs() { return parseInt(speedSlider.value); }
    speedSlider.addEventListener('input', () => {
      speedValEl.textContent = (getSpeedMs()/1000).toFixed(1) + 's';
    });

    function initDeck() {
      deck = shuffle(buildDeck());
      deckIdx = 0;
      runningCount = 0;
    }
    function drawCards(n) {
      if (deckIdx + n * 4 >= deck.length) { deck = shuffle(buildDeck()); deckIdx=0; }
      return deck.slice(deckIdx, deckIdx += n);
    }

    function updateDisplay() {
      displayEl.textContent = playerCount > 0 ? `+${playerCount}` : `${playerCount}`;
      displayEl.classList.toggle('positive', playerCount > 0);
      displayEl.classList.toggle('negative', playerCount < 0);
    }

    function clearRevealTimers() {
      revealTimers.forEach(t => clearTimeout(t));
      revealTimers = [];
    }

    function dealRound() {
      clearRevealTimers();
      phase = 'dealing';
      playerCount = 0;
      updateDisplay();

      currentCards = drawCards(5);
      const delta = currentCards.reduce((s,c)=>s+c.value,0);
      runningCount += delta;

      stageEl.innerHTML = '';
      inputSec.classList.add('hidden');
      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');

      const ms = getSpeedMs();
      currentCards.forEach((c, i) => {
        const t = setTimeout(() => {
          const el = cardEl(c);
          el.classList.add('dealing');
          stageEl.appendChild(el);
          if (i === currentCards.length - 1) {
            const t2 = setTimeout(() => {
              phase = 'awaiting';
              inputSec.classList.remove('hidden');
            }, Math.min(ms, 600));
            revealTimers.push(t2);
          }
        }, i * ms);
        revealTimers.push(t);
      });
    }

    function submitCount() {
      if (phase !== 'awaiting') return;
      phase = 'feedback';

      const isCorrect = playerCount === runningCount;
      if (isCorrect) { score++; streak++; }
      else { streak = 0; }

      scoreEl2.textContent = score;
      strkEl.textContent   = streak;
      markScore(scoreEl, score, score + (AppState.skillStatus[skillId].total||0));
      Account.addResult(skillId, isCorrect);
      if (isCorrect) AppState.skillStatus[skillId].done = true;

      inputSec.classList.add('hidden');
      feedbackEl.classList.remove('hidden','correct','wrong');
      feedbackEl.classList.add(isCorrect?'correct':'wrong');

      const iconEl = feedbackEl.querySelector('#kc-icon');
      const msgEl  = feedbackEl.querySelector('#kc-msg');
      const brkEl  = feedbackEl.querySelector('#kc-breakdown');

      if (isCorrect) {
        iconEl.textContent = '✓';
        msgEl.textContent = `Correct! Running count is ${runningCount >= 0 ? '+' : ''}${runningCount}.`;
        brkEl.textContent = '';
      } else {
        iconEl.textContent = '✗';
        const pStr = playerCount>0?`+${playerCount}`:String(playerCount);
        const rStr = runningCount>0?`+${runningCount}`:String(runningCount);
        msgEl.textContent = `You said ${pStr}, answer is ${rStr}.`;
        const roundDelta = currentCards.reduce((s,c)=>s+c.value,0);
        const lines = currentCards.map(c=>{ const v=c.value; return `${c.rank}${c.sym}  →  ${v>0?'+':''}${v}`; });
        lines.push(`Net: ${roundDelta>0?'+':''}${roundDelta}`);
        brkEl.textContent = lines.join('\n');
      }

      nextEl.classList.add('visible');
    }

    minusBtn.addEventListener('click', ()=>{ if(phase==='awaiting'){playerCount--;updateDisplay();} });
    plusBtn.addEventListener('click',  ()=>{ if(phase==='awaiting'){playerCount++;updateDisplay();} });
    submitBtn.addEventListener('click', submitCount);
    nextEl.addEventListener('click', ()=>{ feedbackEl.classList.remove('correct','wrong'); dealRound(); });

    const keyHandler = (e) => {
      if (document.getElementById('skill-trainer').classList.contains('hidden')) return;
      if (phase==='awaiting') {
        if (e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();playerCount++;updateDisplay();}
        if (e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();playerCount--;updateDisplay();}
        if (e.key==='Enter') submitCount();
      } else if (phase==='feedback') {
        if (e.key==='Enter'||e.key===' '){e.preventDefault();feedbackEl.classList.remove('correct','wrong');dealRound();}
      }
    };
    document.addEventListener('keydown', keyHandler);

    initDeck();
    dealRound();

    return () => {
      clearRevealTimers();
      document.removeEventListener('keydown', keyHandler);
    };
  }
};

// ============================================================
// SKILL 3 — DEVIATIONS (Illustrious 18)
// ============================================================
const DEVIATIONS_LIST = [
  { hand:'16', upcard:'10', basic:'H', deviate:'S', tc:0,  cond:'>=', explain:'16 vs 10: Stand if TC ≥ 0 (normally Hit).' },
  { hand:'15', upcard:'10', basic:'H', deviate:'S', tc:4,  cond:'>=', explain:'15 vs 10: Stand if TC ≥ +4.' },
  { hand:'12', upcard:'2',  basic:'H', deviate:'S', tc:3,  cond:'>=', explain:'12 vs 2: Stand if TC ≥ +3.' },
  { hand:'12', upcard:'3',  basic:'H', deviate:'S', tc:2,  cond:'>=', explain:'12 vs 3: Stand if TC ≥ +2.' },
  { hand:'12', upcard:'4',  basic:'S', deviate:'H', tc:0,  cond:'<',  explain:'12 vs 4: Hit if TC < 0 (normally Stand).' },
  { hand:'9',  upcard:'2',  basic:'H', deviate:'D', tc:1,  cond:'>=', explain:'9 vs 2: Double if TC ≥ +1.' },
  { hand:'9',  upcard:'7',  basic:'H', deviate:'D', tc:3,  cond:'>=', explain:'9 vs 7: Double if TC ≥ +3.' },
  { hand:'11', upcard:'A',  basic:'H', deviate:'D', tc:1,  cond:'>=', explain:'11 vs A: Double if TC ≥ +1.' },
  { hand:'10', upcard:'A',  basic:'H', deviate:'D', tc:4,  cond:'>=', explain:'10 vs A: Double if TC ≥ +4.' },
  { hand:'A8', upcard:'4',  basic:'S', deviate:'D', tc:3,  cond:'>=', explain:'A8 vs 4: Double if TC ≥ +3.' },
  { hand:'A8', upcard:'5',  basic:'S', deviate:'D', tc:1,  cond:'>=', explain:'A8 vs 5: Double if TC ≥ +1.' },
  { hand:'A8', upcard:'6',  basic:'S', deviate:'D', tc:0,  cond:'>=', explain:'A8 vs 6: Always double.' },
  { hand:'13', upcard:'2',  basic:'S', deviate:'H', tc:-1, cond:'<',  explain:'13 vs 2: Hit if TC < −1.' },
];

const Deviations = {
  name: 'Deviations',
  start(body, scoreEl, skillId) {
    let correct=0, total=0, phase='question', currentDev, givenTC, shouldDeviate;

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:520px;width:100%">
        <div class="sk-score-bar">
          <div class="sk-score-item"><div class="sk-score-num" id="dev-correct">0</div><div>Correct</div></div>
          <div class="sk-score-item"><div class="sk-score-num" id="dev-total">0</div><div>Total</div></div>
        </div>

        <div class="felt-table">
          <div class="felt-tc-badge">
            <span class="felt-tc-badge-label">True Count</span>
            <div class="felt-tc-badge-val" id="dev-tc">+2</div>
          </div>
          <div class="felt-dealer-zone">
            <span class="felt-zone-label">Dealer</span>
            <div class="felt-hand" id="dev-dealer-hand"></div>
          </div>
          <hr class="felt-divider">
          <div class="felt-player-zone">
            <span class="felt-zone-label">You · <span id="dev-hand-label">16</span></span>
            <div class="felt-hand" id="dev-player-hand"></div>
          </div>
          <div class="felt-basic-note">Basic strategy: <strong id="dev-basic">Hit</strong></div>
        </div>

        <div class="sk-actions" id="dev-actions"></div>
        <div class="sk-feedback hidden" id="dev-feedback">
          <span class="sk-feedback-icon" id="dev-icon"></span>
          <span id="dev-msg"></span>
        </div>
        <button class="btn-primary sk-next-btn" id="dev-next">Next →</button>
      </div>
    `;

    const tcEl         = body.querySelector('#dev-tc');
    const handLabelEl  = body.querySelector('#dev-hand-label');
    const basicEl      = body.querySelector('#dev-basic');
    const dealerHandEl = body.querySelector('#dev-dealer-hand');
    const playerHandEl = body.querySelector('#dev-player-hand');
    const actionsEl    = body.querySelector('#dev-actions');
    const feedbackEl   = body.querySelector('#dev-feedback');
    const nextEl       = body.querySelector('#dev-next');
    const correctEl    = body.querySelector('#dev-correct');
    const totalEl      = body.querySelector('#dev-total');

    const ACTION_FULL = { H:'Hit', S:'Stand', D:'Double', P:'Split' };

    function devCardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function renderQuestion() {
      phase = 'question';
      currentDev = DEVIATIONS_LIST[Math.floor(Math.random()*DEVIATIONS_LIST.length)];

      const triggers = Math.random() < 0.5;
      if (triggers) {
        givenTC = currentDev.cond === '>='
          ? currentDev.tc + Math.floor(Math.random()*3)
          : currentDev.tc - 1 - Math.floor(Math.random()*2);
        shouldDeviate = true;
      } else {
        givenTC = currentDev.cond === '>='
          ? currentDev.tc - 1 - Math.floor(Math.random()*3)
          : currentDev.tc + Math.floor(Math.random()*3);
        shouldDeviate = false;
      }

      tcEl.textContent = givenTC >= 0 ? `+${givenTC}` : String(givenTC);
      tcEl.style.color = givenTC > 0 ? '#4ade80' : givenTC < 0 ? '#f87171' : 'var(--tr-text)';
      handLabelEl.textContent = currentDev.hand;
      basicEl.textContent = ACTION_FULL[currentDev.basic] || currentDev.basic;

      // Dealer hand: back card + upcard
      dealerHandEl.innerHTML = '';
      dealerHandEl.appendChild(devCardBackEl());
      const upcardRank = currentDev.upcard === 'A' ? 'A' : currentDev.upcard;
      const ds = SUITS[Math.floor(Math.random()*4)];
      dealerHandEl.appendChild(cardEl({rank: upcardRank, suit: ds.name, sym: ds.sym}));

      // Player hand: generate cards that match the hand description
      playerHandEl.innerHTML = '';
      const handStr = currentDev.hand;
      let cards = [];
      if (handStr.startsWith('A')) {
        // Soft hand e.g. "A8"
        const x = parseInt(handStr.slice(1));
        const suits2 = shuffle([...SUITS]);
        cards = [{rank:'A', suit:suits2[0].name, sym:suits2[0].sym},
                 {rank:String(x), suit:suits2[1].name, sym:suits2[1].sym}];
      } else if (handStr.includes(',')) {
        // Pair e.g. "10,10"
        const r = handStr.split(',')[0];
        const suits2 = shuffle([...SUITS]);
        cards = [{rank:r, suit:suits2[0].name, sym:suits2[0].sym},
                 {rank:r, suit:suits2[1].name, sym:suits2[1].sym}];
      } else {
        // Hard total
        const total = parseInt(handStr);
        const a = Math.min(Math.max(2, Math.floor(Math.random()*(total-3))+2), total-2);
        const b = total - a;
        const suits2 = shuffle([...SUITS]);
        cards = [{rank:String(a), suit:suits2[0].name, sym:suits2[0].sym},
                 {rank:b===10?'10':String(b), suit:suits2[1].name, sym:suits2[1].sym}];
      }
      cards.forEach(c => playerHandEl.appendChild(cardEl(c)));

      actionsEl.innerHTML = '';
      // Buttons: "Follow Basic Strategy" or "Deviate"
      const followBtn = document.createElement('button');
      followBtn.className = 'sk-action-btn';
      followBtn.textContent = `Follow (${ACTION_FULL[currentDev.basic]})`;
      followBtn.dataset.choice = 'follow';
      followBtn.addEventListener('click', ()=>answer('follow'));

      const deviateBtn = document.createElement('button');
      deviateBtn.className = 'sk-action-btn';
      deviateBtn.textContent = `Deviate (${ACTION_FULL[currentDev.deviate]})`;
      deviateBtn.dataset.choice = 'deviate';
      deviateBtn.addEventListener('click', ()=>answer('deviate'));

      actionsEl.appendChild(followBtn);
      actionsEl.appendChild(deviateBtn);
      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');
    }

    function answer(chosen) {
      if (phase !== 'question') return;
      phase = 'feedback';
      total++;
      const isCorrect = (chosen === 'deviate') === shouldDeviate;
      if (isCorrect) correct++;

      actionsEl.querySelectorAll('.sk-action-btn').forEach(b => {
        b.disabled = true;
        const correctChoice = shouldDeviate ? 'deviate' : 'follow';
        if (b.dataset.choice === correctChoice) b.classList.add('correct');
        if (b.dataset.choice === chosen && !isCorrect) b.classList.add('wrong');
      });

      feedbackEl.classList.remove('hidden','correct','wrong');
      feedbackEl.classList.add(isCorrect?'correct':'wrong');
      feedbackEl.querySelector('#dev-icon').textContent = isCorrect ? '✓' : '✗';
      feedbackEl.querySelector('#dev-msg').textContent = isCorrect
        ? (shouldDeviate ? `Correct! Deviate here. ${currentDev.explain}` : `Correct! Stick to basic strategy at TC ${givenTC}.`)
        : (shouldDeviate ? `Wrong — you should deviate. ${currentDev.explain}` : `Wrong — basic strategy is correct at TC ${givenTC}. ${currentDev.explain}`);

      correctEl.textContent = correct;
      totalEl.textContent   = total;
      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      nextEl.classList.add('visible');
    }

    nextEl.addEventListener('click', renderQuestion);
    renderQuestion();
    return ()=>{};
  }
};

// ============================================================
// SKILL 4 — DECK ESTIMATION
// ============================================================
const DeckEstimation = {
  name: 'Deck Estimation',
  start(body, scoreEl, skillId) {
    let correct=0, total=0, phase='question', answer;
    const TOTAL_CARDS = 312; // 6 decks

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:480px;width:100%">
        <div class="sk-score-bar">
          <div class="sk-score-item"><div class="sk-score-num" id="de-correct">0</div><div>Correct</div></div>
          <div class="sk-score-item"><div class="sk-score-num" id="de-total">0</div><div>Total</div></div>
        </div>
        <div class="sk-question">
          <span class="sk-label">How many decks remain in the shoe?</span>
          <div class="shoe-visual-wrap" style="margin-top:1.25rem">
            <div class="shoe-box">
              <div class="shoe-fill" id="de-shoe-fill" style="width:50%"></div>
              <span class="shoe-empty-label">empty</span>
            </div>
            <div class="shoe-stats">
              <span>Dealt: <strong id="de-dealt">156</strong></span>
              <span>Remaining: <strong id="de-remaining">156</strong></span>
            </div>
          </div>
        </div>
        <div style="width:100%;max-width:380px">
          <div class="sk-slider-value" id="de-slider-val">3.0 decks</div>
          <input type="range" class="sk-slider" id="de-slider" min="0.5" max="6" step="0.5" value="3">
          <div class="sk-slider-labels"><span>½ deck</span><span>3 decks</span><span>6 decks</span></div>
        </div>
        <button class="btn-primary" id="de-submit" style="margin-top:.5rem">Submit Estimate</button>
        <div class="sk-feedback hidden" id="de-feedback">
          <span class="sk-feedback-icon" id="de-icon"></span>
          <span id="de-msg"></span>
        </div>
        <button class="btn-primary sk-next-btn" id="de-next">Next →</button>
      </div>
    `;

    const dealtEl     = body.querySelector('#de-dealt');
    const remainingEl = body.querySelector('#de-remaining');
    const shoeFillEl  = body.querySelector('#de-shoe-fill');
    const sliderEl    = body.querySelector('#de-slider');
    const sliderVal   = body.querySelector('#de-slider-val');
    const submitEl    = body.querySelector('#de-submit');
    const feedbackEl  = body.querySelector('#de-feedback');
    const nextEl      = body.querySelector('#de-next');
    const correctEl   = body.querySelector('#de-correct');
    const totalEl     = body.querySelector('#de-total');

    sliderEl.addEventListener('input', ()=>{
      sliderVal.textContent = parseFloat(sliderEl.value).toFixed(1) + ' decks';
    });

    function renderQuestion() {
      phase = 'question';
      const dealt = Math.floor(Math.random() * 260) + 20;
      const remaining = TOTAL_CARDS - dealt;
      answer = parseFloat((remaining / 52).toFixed(1));
      answer = Math.round(answer * 2) / 2;

      dealtEl.textContent = dealt;
      remainingEl.textContent = remaining;
      // Shoe fill = percentage of cards remaining
      shoeFillEl.style.width = Math.max(4, (remaining / TOTAL_CARDS) * 100) + '%';

      sliderEl.value = 3;
      sliderVal.textContent = '3.0 decks';
      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');
      submitEl.disabled = false;
    }

    function submitAnswer() {
      if (phase !== 'question') return;
      phase = 'feedback';
      total++;
      const guess = parseFloat(sliderEl.value);
      const isCorrect = Math.abs(guess - answer) <= 0.5;
      if (isCorrect) correct++;

      feedbackEl.classList.remove('hidden','correct','wrong');
      feedbackEl.classList.add(isCorrect?'correct':'wrong');
      feedbackEl.querySelector('#de-icon').textContent = isCorrect ? '✓' : '✗';
      feedbackEl.querySelector('#de-msg').textContent = isCorrect
        ? `Correct! About ${answer} decks remain.`
        : `Not quite. There are ${answer} decks remaining (${Math.round(answer*52)} cards). You guessed ${guess}.`;

      correctEl.textContent = correct;
      totalEl.textContent   = total;
      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      submitEl.disabled = true;
      nextEl.classList.add('visible');
    }

    submitEl.addEventListener('click', submitAnswer);
    nextEl.addEventListener('click', renderQuestion);
    renderQuestion();
    return ()=>{};
  }
};

// ============================================================
// SKILL 5 — TRUE COUNT CONVERSION
// ============================================================
const TrueCount = {
  name: 'True Count',
  start(body, scoreEl, skillId) {
    let correct=0, total=0, phase='question', trueCount, playerTC=0;

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:480px;width:100%">
        <div class="sk-score-bar">
          <div class="sk-score-item"><div class="sk-score-num" id="tc-correct">0</div><div>Correct</div></div>
          <div class="sk-score-item"><div class="sk-score-num" id="tc-total">0</div><div>Total</div></div>
        </div>
        <div class="sk-question">
          <span class="sk-label">Running Count ÷ Decks Remaining = True Count</span>

          <div class="shoe-visual-wrap" style="margin-top:1rem">
            <div class="shoe-box">
              <div class="shoe-fill" id="tc-shoe-fill" style="width:50%"></div>
              <span class="shoe-empty-label">empty</span>
            </div>
            <div class="shoe-stats">
              <span>Remaining: <strong id="tc-decks-cards">156</strong> cards</span>
              <span><strong id="tc-decks">3</strong> decks</span>
            </div>
          </div>

          <div style="display:flex;gap:1rem;justify-content:center;align-items:center;flex-wrap:wrap;margin-top:1rem">
            <div style="background:var(--tr-panel);border:1px solid var(--tr-border);border-radius:10px;padding:0.9rem 1.25rem;text-align:center;min-width:110px">
              <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--tr-dim);margin-bottom:.3rem">Running Count</div>
              <div style="font-size:2.5rem;font-family:var(--font-serif)" id="tc-rc">+8</div>
            </div>
            <div style="font-size:1.75rem;color:var(--tr-dim)">÷</div>
            <div style="background:var(--tr-panel);border:1px solid var(--tr-border);border-radius:10px;padding:0.9rem 1.25rem;text-align:center;min-width:110px">
              <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.08em;color:var(--tr-dim);margin-bottom:.3rem">Decks Left</div>
              <div style="font-size:2.5rem;font-family:var(--font-serif)" id="tc-decks-num">3</div>
            </div>
          </div>
          <p style="text-align:center;font-size:.82rem;color:var(--tr-muted);margin-top:.65rem">What is the true count? (Round to nearest whole number)</p>
        </div>
        <div class="count-controls">
          <button class="stepper-btn" id="tc-minus">−</button>
          <div class="count-display" id="tc-display">0</div>
          <button class="stepper-btn" id="tc-plus">+</button>
        </div>
        <div style="display:flex;justify-content:center;margin-top:1rem">
          <button class="btn-primary" id="tc-submit">Submit</button>
        </div>
        <div class="sk-feedback hidden" id="tc-feedback">
          <span class="sk-feedback-icon" id="tc-icon"></span>
          <span id="tc-msg"></span>
        </div>
        <button class="btn-primary sk-next-btn" id="tc-next">Next →</button>
      </div>
    `;

    const rcEl          = body.querySelector('#tc-rc');
    const decksNumEl    = body.querySelector('#tc-decks-num');
    const decksCardsEl  = body.querySelector('#tc-decks-cards');
    const decksLabelEl  = body.querySelector('#tc-decks');
    const shoeFillEl    = body.querySelector('#tc-shoe-fill');
    const displayEl    = body.querySelector('#tc-display');
    const feedbackEl   = body.querySelector('#tc-feedback');
    const nextEl       = body.querySelector('#tc-next');
    const correctEl    = body.querySelector('#tc-correct');
    const totalEl      = body.querySelector('#tc-total');

    function updateDisplay() {
      displayEl.textContent = playerTC > 0 ? `+${playerTC}` : String(playerTC);
      displayEl.classList.toggle('positive', playerTC > 0);
      displayEl.classList.toggle('negative', playerTC < 0);
    }

    function renderQuestion() {
      phase = 'question';
      playerTC = 0;
      updateDisplay();

      const rc = Math.floor(Math.random()*25) - 12;
      const decksOpts = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      const decks = decksOpts[Math.floor(Math.random()*decksOpts.length)];
      trueCount = Math.round(rc / decks);

      rcEl.textContent = rc >= 0 ? `+${rc}` : String(rc);
      rcEl.style.color = rc > 0 ? '#4ade80' : rc < 0 ? '#f87171' : 'var(--tr-text)';
      const decksStr = decks % 1 === 0 ? String(decks) : decks.toFixed(1);
      decksNumEl.textContent = decksStr;
      if (decksLabelEl) decksLabelEl.textContent = decksStr;
      const cardsLeft = Math.round(decks * 52);
      decksCardsEl.textContent = cardsLeft;
      shoeFillEl.style.width = Math.max(4, (decks / 6) * 100) + '%';

      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');
    }

    function submitAnswer() {
      if (phase !== 'question') return;
      phase = 'feedback';
      total++;
      const isCorrect = Math.abs(playerTC - trueCount) <= 1;
      if (isCorrect) correct++;

      feedbackEl.classList.remove('hidden','correct','wrong');
      feedbackEl.classList.add(isCorrect?'correct':'wrong');
      feedbackEl.querySelector('#tc-icon').textContent = isCorrect ? '✓' : '✗';
      const tcStr = trueCount >= 0 ? `+${trueCount}` : String(trueCount);
      feedbackEl.querySelector('#tc-msg').textContent = isCorrect
        ? `Correct! True Count is ${tcStr}.`
        : `The True Count is ${tcStr}. Remember: divide running count by decks remaining and round.`;

      correctEl.textContent = correct;
      totalEl.textContent   = total;
      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      nextEl.classList.add('visible');
    }

    body.querySelector('#tc-minus').addEventListener('click', ()=>{ if(phase==='question'){playerTC--;updateDisplay();} });
    body.querySelector('#tc-plus').addEventListener('click',  ()=>{ if(phase==='question'){playerTC++;updateDisplay();} });
    body.querySelector('#tc-submit').addEventListener('click', submitAnswer);
    nextEl.addEventListener('click', renderQuestion);
    renderQuestion();
    return ()=>{};
  }
};

// ============================================================
// SKILL 6 — BET SPREAD CONFIGURATOR
// ============================================================
const BetSpread = {
  name: 'Custom Bet Spread',
  start(body, scoreEl, skillId) {
    let bankroll = 50000, risk = 'moderate';

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:480px;width:100%;justify-content:flex-start;padding-top:1rem">
        <h3 style="color:var(--tr-text);margin-bottom:.25rem">Generate Your Bet Spread</h3>
        <p style="font-size:.875rem;color:var(--tr-muted);margin-bottom:1.5rem">Enter your bankroll and risk tolerance to see your recommended bet spread, hourly EV, and variance.</p>

        <div class="sk-form">
          <div class="sk-field">
            <label>Bankroll ($)</label>
            <input class="sk-input" type="number" id="bs-bankroll" value="50000" min="100" max="10000000" step="1000">
          </div>
          <div class="sk-field">
            <label>Risk Tolerance</label>
            <div class="sk-radio-group" id="bs-risk">
              <div class="sk-radio-btn" data-risk="conservative">Conservative</div>
              <div class="sk-radio-btn selected" data-risk="moderate">Moderate</div>
              <div class="sk-radio-btn" data-risk="aggressive">Aggressive</div>
            </div>
          </div>
        </div>
        <button class="btn-primary" id="bs-generate">Generate Bet Spread →</button>

        <div id="bs-result" style="width:100%;margin-top:1.5rem;display:none">
          <div style="font-size:.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);margin-bottom:.75rem">Your Bet Spread</div>
          <table class="sk-table" id="bs-table"></table>
          <div style="background:var(--tr-panel);border:1px solid var(--tr-border);border-radius:8px;padding:.85rem 1rem;font-size:.82rem;color:var(--tr-muted);line-height:1.6;margin-top:1rem" id="bs-notes"></div>
        </div>

        <button class="btn-primary sk-next-btn" id="bs-done" style="margin-top:1.25rem">Save & Continue →</button>
      </div>
    `;

    const bankrollInput = body.querySelector('#bs-bankroll');
    const riskBtns      = body.querySelectorAll('.sk-radio-btn');
    const generateBtn   = body.querySelector('#bs-generate');
    const resultDiv     = body.querySelector('#bs-result');
    const tableEl       = body.querySelector('#bs-table');
    const notesEl       = body.querySelector('#bs-notes');
    const doneBtn       = body.querySelector('#bs-done');

    riskBtns.forEach(b => {
      b.addEventListener('click', ()=>{
        riskBtns.forEach(x=>x.classList.remove('selected'));
        b.classList.add('selected');
        risk = b.dataset.risk;
      });
    });

    function generate() {
      bankroll = parseFloat(bankrollInput.value) || 50000;

      const configs = {
        conservative: { divisor:500, spread:[1,1,2,4,8],   label:'1–8x spread',  note:'Safe for recreational play. Variance is manageable; bankroll risk of ruin is low (~2%). Good for learning.' },
        moderate:     { divisor:300, spread:[1,2,4,8,12],  label:'1–12x spread', note:'Balanced approach. Higher edge but more variance. Requires solid counting skills. ~5% risk of ruin on a single session.' },
        aggressive:   { divisor:200, spread:[1,2,6,12,20], label:'1–20x spread', note:'Maximum edge extraction. High variance — you need discipline and a large bankroll buffer. Not recommended until you\'re consistently accurate.' },
      };
      const cfg = configs[risk];
      const minBet = Math.max(5, Math.round(bankroll / cfg.divisor / 5) * 5);

      // TC frequency distribution (approximate for 6-deck Hi-Lo)
      const freqs = [0.60, 0.15, 0.10, 0.07, 0.08]; // ≤0, +1, +2, +3, +4+
      const edges = [-0.005, 0.005, 0.010, 0.015, 0.020]; // player edge per TC level
      const HANDS_PER_HOUR = 80;

      const rows = cfg.spread.map((mult, i) => ({
        tc:   ['≤ 0','+1','+2','+3','+4+'][i],
        mult, freq: freqs[i], edge: edges[i]
      }));

      // Hourly EV = sum(freq × edge × bet) × hands/hr
      const hourlyEV = rows.reduce((s, r) => s + r.freq * r.edge * (minBet * r.mult), 0) * HANDS_PER_HOUR;
      // Hourly SD ≈ 1.14 × avg_bet × sqrt(hands/hr)
      const avgBet = rows.reduce((s, r) => s + r.freq * (minBet * r.mult), 0);
      const hourlySD = 1.14 * avgBet * Math.sqrt(HANDS_PER_HOUR);

      tableEl.innerHTML = `
        <tr><th>True Count</th><th>Bet</th><th>Edge</th></tr>
        ${rows.map(r=>`
          <tr>
            <td>${r.tc}</td>
            <td class="td-bet">$${(minBet*r.mult).toLocaleString()}</td>
            <td class="${r.edge > 0 ? 'td-edge' : ''}" style="${r.edge <= 0 ? 'color:var(--tr-muted)' : ''}">${r.tc==='≤ 0'?'House −0.5%':'+'+(r.edge*100).toFixed(1)+'%'}</td>
          </tr>
        `).join('')}
      `;

      notesEl.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem">
          <div style="background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.2);border-radius:8px;padding:.7rem 1rem;text-align:center">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:#4ade80;margin-bottom:.2rem">Hourly EV</div>
            <div style="font-size:1.4rem;font-family:var(--font-serif);color:#4ade80">+$${Math.round(hourlyEV).toLocaleString()}</div>
            <div style="font-size:.65rem;color:var(--tr-dim)">at ${HANDS_PER_HOUR} hands/hr</div>
          </div>
          <div style="background:rgba(255,255,255,0.03);border:1px solid var(--tr-border);border-radius:8px;padding:.7rem 1rem;text-align:center">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:var(--tr-dim);margin-bottom:.2rem">Hourly σ</div>
            <div style="font-size:1.4rem;font-family:var(--font-serif);color:var(--tr-text)">±$${Math.round(hourlySD).toLocaleString()}</div>
            <div style="font-size:.65rem;color:var(--tr-dim)">std deviation</div>
          </div>
        </div>
        <strong style="color:var(--tr-text)">${cfg.label}</strong> · Min $${minBet} · Max $${(minBet*cfg.spread[4]).toLocaleString()}<br>
        <span style="font-size:.8rem">${cfg.note}</span>
      `;
      resultDiv.style.display = 'block';
      doneBtn.classList.add('visible');
    }

    generateBtn.addEventListener('click', generate);
    doneBtn.addEventListener('click', ()=>{
      AppState.skillStatus[skillId].done = true;
      Account.markSession();
      scoreEl.textContent = 'Configured ✓';
      goPipeline();
    });

    return ()=>{};
  }
};

// ============================================================
// SKILL 7 — FULL TRAINING (combined)
// ============================================================
const FullTraining = {
  name: 'Full Training',
  start(body, scoreEl, skillId) {
    let deck=shuffle(buildDeck()), deckIdx=0;
    let runningCount=0, playerCount=0;
    let countCorrect=0, playCorrect=0, total=0;
    let phase='question', currentCards=[], correctPlay;

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:560px;width:100%">
        <div style="font-size:.8rem;color:var(--tr-muted);text-align:center;margin-bottom:.25rem">Track the count AND make the correct play</div>
        <div class="sk-score-bar" style="margin-bottom:1.25rem">
          <div class="sk-score-item"><div class="sk-score-num" id="ft-count-correct">0</div><div>Count ✓</div></div>
          <div class="sk-score-item"><div class="sk-score-num" id="ft-play-correct">0</div><div>Play ✓</div></div>
          <div class="sk-score-item"><div class="sk-score-num" id="ft-total">0</div><div>Rounds</div></div>
        </div>

        <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;margin-bottom:1.25rem">
          <div class="sk-hand-group">
            <span class="sk-hand-group-label">Dealer Up Card</span>
            <div class="sk-card-stage" id="ft-dealer" style="min-height:auto"></div>
          </div>
          <div class="sk-hand-group">
            <span class="sk-hand-group-label">Your Hand</span>
            <div class="sk-card-stage" id="ft-player" style="min-height:auto"></div>
          </div>
          <div class="sk-hand-group">
            <span class="sk-hand-group-label">Burn Cards (Count these too)</span>
            <div class="sk-card-stage" id="ft-burn" style="min-height:auto"></div>
          </div>
        </div>

        <div id="ft-step1">
          <div style="font-size:.82rem;color:var(--tr-muted);text-align:center;margin-bottom:.5rem">Step 1: What's your play?</div>
          <div class="sk-actions" id="ft-play-actions"></div>
        </div>

        <div id="ft-step2" style="display:none">
          <div style="font-size:.82rem;color:var(--tr-muted);text-align:center;margin-bottom:.5rem">Step 2: What is the running count of all visible cards?</div>
          <div class="count-controls">
            <button class="stepper-btn" id="ft-minus">−</button>
            <div class="count-display" id="ft-display">0</div>
            <button class="stepper-btn" id="ft-plus">+</button>
          </div>
          <div style="display:flex;justify-content:center;margin-top:.75rem">
            <button class="btn-primary" id="ft-count-submit">Submit Count</button>
          </div>
        </div>

        <div class="sk-feedback hidden" id="ft-feedback">
          <span class="sk-feedback-icon" id="ft-icon"></span>
          <span id="ft-msg"></span>
        </div>
        <button class="btn-primary sk-next-btn" id="ft-next">Next Round →</button>

        <div class="hilo-ref-strip" style="margin-top:auto">
          <div class="ref-group"><span class="ref-cards">2–6</span><span class="ref-val c-green">+1</span></div>
          <span class="ref-sep">·</span>
          <div class="ref-group"><span class="ref-cards">7–9</span><span class="ref-val" style="color:var(--tr-muted)">0</span></div>
          <span class="ref-sep">·</span>
          <div class="ref-group"><span class="ref-cards">10 J Q K A</span><span class="ref-val c-red">−1</span></div>
        </div>
      </div>
    `;

    const dealerEl   = body.querySelector('#ft-dealer');
    const playerEl   = body.querySelector('#ft-player');
    const burnEl     = body.querySelector('#ft-burn');
    const step1El    = body.querySelector('#ft-step1');
    const step2El    = body.querySelector('#ft-step2');
    const actionsEl  = body.querySelector('#ft-play-actions');
    const displayEl  = body.querySelector('#ft-display');
    const feedbackEl = body.querySelector('#ft-feedback');
    const nextEl     = body.querySelector('#ft-next');
    const ccEl       = body.querySelector('#ft-count-correct');
    const pcEl       = body.querySelector('#ft-play-correct');
    const totEl      = body.querySelector('#ft-total');

    let playWasCorrect;

    function draw(n=1) {
      if (deckIdx+n*4>=deck.length){deck=shuffle(buildDeck());deckIdx=0;}
      return deck.slice(deckIdx, deckIdx+=n);
    }

    function updateDisplay() {
      displayEl.textContent = playerCount>0?`+${playerCount}`:String(playerCount);
      displayEl.classList.toggle('positive', playerCount>0);
      displayEl.classList.toggle('negative', playerCount<0);
    }

    function renderRound() {
      phase='question';
      playerCount=0;
      updateDisplay();

      // Deal: 1 dealer card, 2 player cards, 0-2 burn cards
      const dealerCards = draw(1);
      const playerCards = draw(2);
      const burnCards   = draw(Math.floor(Math.random()*3));
      currentCards      = [...dealerCards,...playerCards,...burnCards];

      // Update running count with all visible cards
      const delta = currentCards.reduce((s,c)=>s+c.value,0);
      runningCount += delta;

      // Render
      dealerEl.innerHTML='';
      const dc=cardEl(dealerCards[0]);
      dc.style.animationDelay='0ms';
      dc.classList.add('dealing');
      dealerEl.appendChild(dc);

      playerEl.innerHTML='';
      playerCards.forEach((c,i)=>{
        const el=cardEl(c);
        el.style.animationDelay=(80+i*80)+'ms';
        el.classList.add('dealing');
        playerEl.appendChild(el);
      });

      burnEl.innerHTML='';
      burnCards.forEach((c,i)=>{
        const el=cardEl(c,'card-sm');
        el.style.animationDelay=(200+i*80)+'ms';
        el.classList.add('dealing');
        burnEl.appendChild(el);
      });

      // Determine correct basic strategy play
      const pTotal = playerCards.reduce((s,c)=>{
        const v=c.rank==='A'?11:c.rank==='10'||c.rank==='J'||c.rank==='Q'||c.rank==='K'?10:parseInt(c.rank)||10;
        return s+v;
      },0);
      const isAce = playerCards.some(c=>c.rank==='A');
      const isPair= playerCards[0].rank===playerCards[1].rank;
      const dIdx  = DEALER_LABELS.indexOf(dealerCards[0].rank==='10'||dealerCards[0].rank==='J'||dealerCards[0].rank==='Q'||dealerCards[0].rank==='K'?'10':dealerCards[0].rank);
      const dI    = Math.max(0, dIdx);

      if (isPair) {
        const r=playerCards[0].rank;
        const key=(r==='10'||r==='J'||r==='Q'||r==='K')?'TT':(r+r);
        correctPlay=(BS_PAIRS[key]||'SSSSSSSSSS')[dI]||'S';
      } else if (isAce && pTotal<=21) {
        const softTot=pTotal>21?pTotal-10:pTotal;
        correctPlay=(BS_SOFT[Math.min(20,Math.max(13,softTot))]||'SSSSSSSSSS')[dI]||'S';
      } else {
        const hard=pTotal>21?pTotal-10:pTotal;
        if (hard>=17) correctPlay='S';
        else correctPlay=(BS_HARD[Math.min(16,Math.max(8,hard))]||'SSSSSSSSSS')[dI]||'H';
      }

      // Render action buttons
      actionsEl.innerHTML='';
      const actions=isPair?['H','S','D','P']:['H','S','D'];
      actions.forEach(a=>{
        const b=document.createElement('button');
        b.className='sk-action-btn';
        b.textContent=ACTION_LABELS[a];
        b.dataset.action=a;
        b.addEventListener('click',()=>choosePlay(a,b));
        actionsEl.appendChild(b);
      });

      step1El.style.display='block';
      step2El.style.display='none';
      feedbackEl.classList.add('hidden');
      nextEl.classList.remove('visible');
    }

    function choosePlay(action) {
      playWasCorrect=(action===correctPlay);

      actionsEl.querySelectorAll('.sk-action-btn').forEach(b=>{
        b.disabled=true;
        if(b.dataset.action===correctPlay)b.classList.add('correct');
        if(b.dataset.action===action&&!playWasCorrect)b.classList.add('wrong');
      });

      step1El.style.display='none';
      step2El.style.display='block';
      phase='count';
    }

    function submitCount() {
      if(phase!=='count')return;
      phase='feedback';
      total++;
      const countIsCorrect=playerCount===runningCount;
      if(playWasCorrect)playCorrect++;
      if(countIsCorrect)countCorrect++;

      ccEl.textContent=countCorrect;
      pcEl.textContent=playCorrect;
      totEl.textContent=total;
      markScore(scoreEl, countCorrect+playCorrect, total*2);
      if(total>=5)AppState.skillStatus[skillId].done=true;

      step2El.style.display='none';
      feedbackEl.classList.remove('hidden','correct','wrong');
      const bothCorrect=playWasCorrect&&countIsCorrect;
      feedbackEl.classList.add(bothCorrect?'correct':'wrong');
      const rcStr=runningCount>=0?`+${runningCount}`:String(runningCount);
      const pStr=playerCount>=0?`+${playerCount}`:String(playerCount);
      feedbackEl.querySelector('#ft-icon').textContent=bothCorrect?'✓':(playWasCorrect||countIsCorrect)?'~':'✗';
      feedbackEl.querySelector('#ft-msg').textContent=[
        playWasCorrect?`Play: ✓ ${ACTION_LABELS[correctPlay]}`:`Play: ✗ Should be ${ACTION_LABELS[correctPlay]}`,
        countIsCorrect?`Count: ✓ ${rcStr}`:`Count: ✗ Answer is ${rcStr}, you said ${pStr}`,
      ].join('  ·  ');

      nextEl.classList.add('visible');
    }

    body.querySelector('#ft-minus').addEventListener('click',()=>{if(phase==='count'){playerCount--;updateDisplay();}});
    body.querySelector('#ft-plus').addEventListener('click', ()=>{if(phase==='count'){playerCount++;updateDisplay();}});
    body.querySelector('#ft-count-submit').addEventListener('click',submitCount);
    nextEl.addEventListener('click',renderRound);

    renderRound();
    return()=>{};
  }
};

// ============================================================
// NAVIGATION WIRING
// ============================================================

// "Start Training" → open auth modal (or go straight to pipeline if already signed in)
function startTraining() {
  if (Account.currentUser()) goPipeline();
  else openAuthModal('signup');
}

const heroCta = document.getElementById('hero-cta');
if (heroCta) heroCta.addEventListener('click', startTraining);


const navCta = document.getElementById('nav-cta');
if (navCta) navCta.addEventListener('click', startTraining);

const featuresCta = document.getElementById('features-cta');
if (featuresCta) featuresCta.addEventListener('click', startTraining);


// Info popups (Blackjack / Card Counting)
function openInfoModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeInfoModal(id) {
  document.getElementById(id).classList.add('hidden');
}
['bj-modal', 'cc-modal'].forEach(id => {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeInfoModal(id); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoModal(id); });
});
document.getElementById('nav-open-bj-modal').addEventListener('click', () => openInfoModal('bj-modal'));
document.getElementById('nav-open-cc-modal').addEventListener('click', () => openInfoModal('cc-modal'));
document.getElementById('close-bj-modal').addEventListener('click', () => closeInfoModal('bj-modal'));
document.getElementById('close-cc-modal').addEventListener('click', () => closeInfoModal('cc-modal'));

// Skill panel CTAs → individual skills or pipeline
document.querySelectorAll('.sp-cta[data-skill]').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.skill;
    if (skill === 'full-training') goPipeline();
    else goSkill(skill);
  });
});

// Skill list switching with mockup pop animation
document.querySelectorAll('.skill-item').forEach(item => {
  item.addEventListener('click', () => {
    const idx = item.dataset.idx;
    if (item.classList.contains('active')) return;

    // Exit current mockup
    const currentMockup = document.querySelector('.skill-panel.active .sp-mockup');
    if (currentMockup) currentMockup.classList.add('tab-exit');

    setTimeout(() => {
      document.querySelectorAll('.skill-item').forEach(b => b.classList.toggle('active', b.dataset.idx === idx));
      document.querySelectorAll('.skill-panel').forEach(p => p.classList.toggle('active', p.dataset.idx === idx));

      // Enter new mockup
      const newMockup = document.querySelector('.skill-panel.active .sp-mockup');
      if (newMockup) {
        newMockup.classList.remove('tab-exit');
        newMockup.classList.add('tab-enter');
        setTimeout(() => newMockup.classList.remove('tab-enter'), 600);
      }
    }, 220);
  });
});

// Slide-in on scroll — trigger when features section enters view
const featuresSlide = document.querySelector('.features-slide');
if (featuresSlide) {
  const featuresObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        featuresSlide.classList.add('features-visible');
        featuresObserver.disconnect();
      }
    });
  }, { threshold: 0.15 });
  featuresObserver.observe(featuresSlide);
}

// Back buttons
document.getElementById('pipeline-back').addEventListener('click', goLanding);
document.getElementById('skill-back').addEventListener('click', goPipeline);

const dashBack = document.getElementById('dashboard-back');
if (dashBack) dashBack.addEventListener('click', goLanding);

// ============================================================
// AUTH MODAL
// ============================================================
function openAuthModal(panel = 'signup') {
  document.getElementById('auth-modal').classList.remove('hidden');
  _showAuthPanel(panel);
  const focusId = panel === 'signin' ? 'signin-username' : 'signup-username';
  setTimeout(() => { const el = document.getElementById(focusId); if (el) el.focus(); }, 50);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  ['signin-error','signup-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  });
  ['signin-username','signin-pin','signup-username','signup-pin','signup-pin2'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function _showAuthPanel(panel) {
  document.getElementById('auth-signup').classList.toggle('hidden', panel !== 'signup');
  document.getElementById('auth-signin').classList.toggle('hidden', panel !== 'signin');
}

const authModal = document.getElementById('auth-modal');
if (authModal) {
  // Close on backdrop click
  authModal.addEventListener('click', e => { if (e.target === authModal) closeAuthModal(); });
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);

  // Panel switching links
  document.getElementById('show-signin').addEventListener('click', () => _showAuthPanel('signin'));
  document.getElementById('show-signup').addEventListener('click', () => _showAuthPanel('signup'));

  // Guest buttons
  function continueAsGuest() { closeAuthModal(); goPipeline(); }
  document.getElementById('guest-btn').addEventListener('click', continueAsGuest);
  document.getElementById('guest-btn-2').addEventListener('click', continueAsGuest);

  // Sign Up
  document.getElementById('signup-btn').addEventListener('click', () => {
    const username = document.getElementById('signup-username').value.trim();
    const pin      = document.getElementById('signup-pin').value.trim();
    const pin2     = document.getElementById('signup-pin2').value.trim();
    const errEl    = document.getElementById('signup-error');
    errEl.classList.add('hidden');
    if (!username || !pin || !pin2) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.remove('hidden'); return; }
    if (!/^\d{4}$/.test(pin))       { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.classList.remove('hidden'); return; }
    if (pin !== pin2)                { errEl.textContent = 'PINs do not match.'; errEl.classList.remove('hidden'); return; }
    const result = Account.signUp(username, pin);
    if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); return; }
    syncAuthUI();
    closeAuthModal();
    goPipeline();
  });

  // Sign In
  document.getElementById('signin-btn').addEventListener('click', () => {
    const username = document.getElementById('signin-username').value.trim();
    const pin      = document.getElementById('signin-pin').value.trim();
    const errEl    = document.getElementById('signin-error');
    errEl.classList.add('hidden');
    if (!username || !pin) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.remove('hidden'); return; }
    const result = Account.signIn(username, pin);
    if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); return; }
    syncAuthUI();
    closeAuthModal();
    goPipeline();
  });

  // Escape to close
  authModal.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuthModal(); });
}

// Pipeline nav account button
const pipeNavAccount = document.getElementById('pipe-nav-account');
if (pipeNavAccount) {
  pipeNavAccount.addEventListener('click', () => {
    if (Account.currentUser()) goDashboard();
    else openAuthModal();
  });
}

// Init auth UI on load
syncAuthUI();
