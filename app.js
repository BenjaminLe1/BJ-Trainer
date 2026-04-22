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
// HERO FADE ON SNAP SCROLL
// ============================================================
const heroBody     = document.querySelector('.hero-body');
const heroBgCards  = document.querySelectorAll('.bg-card');
const heroExplore  = document.querySelector('.hero-explore');
const heroCardRing = document.querySelector('.hero-card-ring-wrap');
const heroNav      = document.querySelector('.hero-nav');

const landingSnap = document.getElementById('landing-snap');
if (landingSnap) {
  landingSnap.addEventListener('scroll', () => {
    const progress = Math.min(landingSnap.scrollTop / (window.innerHeight * 0.45), 1);
    const fade = 1 - progress;

    if (heroBody) {
      heroBody.style.opacity  = fade;
      heroBody.style.transform = `translateY(calc(-50% - ${progress * 40}px))`;
    }
    if (heroCardRing) {
      heroCardRing.style.opacity  = fade;
      heroCardRing.style.transform = `translateY(calc(-50% - ${progress * 40}px))`;
    }
    if (heroNav) {
      heroNav.style.opacity  = Math.max(0, 1 - progress * 2);
      heroNav.style.transform = `translateY(${-progress * 20}px)`;
    }
    if (heroExplore) {
      heroExplore.style.opacity = Math.max(0, 1 - progress * 3);
    }
    heroBgCards.forEach(card => {
      card.style.opacity = 0.5 * fade;
    });
  }, { passive: true });
}

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
    'true-count':      { done: false, correct: 0, total: 0 },
    'bet-spread':      { done: false },
    'full-training':   { done: false, correct: 0, total: 0 },
  },
  currentDifficulty: {}, // skillId → { level 1-5, name, cardCount, delayMs, timerMs, ... }
};

// ============================================================
// ACCOUNT SYSTEM (localStorage)
// ============================================================
const SKILL_IDS = ['basic-strategy','keep-counting','true-count','deviations','bet-spread'];
const SKILL_NAMES = {
  'basic-strategy': 'Basic Strategy',
  'keep-counting': 'Running Count',
  'deviations': 'Deviations',
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
  },
  getBankrollConfig() {
    const user = this.currentUser();
    if (user) {
      const accounts = this._load();
      const cfg = accounts[user]?.bankrollConfig;
      if (cfg) return cfg;
    }
    // fallback to legacy global keys
    return {
      bankroll: parseInt(localStorage.getItem('bj_configured_bankroll') || '0') || 5000,
      risk: localStorage.getItem('bj_configured_risk') || 'moderate',
      ftBankroll: parseInt(localStorage.getItem('ft_bankroll') || '0') || 0,
    };
  },
  saveBankrollConfig(bankroll, risk) {
    const user = this.currentUser();
    if (!user) { localStorage.setItem('bj_configured_bankroll', String(bankroll)); localStorage.setItem('bj_configured_risk', risk); return; }
    const accounts = this._load();
    if (!accounts[user]) return;
    if (!accounts[user].bankrollConfig) accounts[user].bankrollConfig = {};
    accounts[user].bankrollConfig.bankroll = bankroll;
    accounts[user].bankrollConfig.risk = risk;
    this._save(accounts);
  },
  saveFtBankroll(amount) {
    const user = this.currentUser();
    if (!user) { localStorage.setItem('ft_bankroll', String(amount)); return; }
    const accounts = this._load();
    if (!accounts[user]) return;
    if (!accounts[user].bankrollConfig) accounts[user].bankrollConfig = {};
    accounts[user].bankrollConfig.ftBankroll = amount;
    this._save(accounts);
  },
};

// ============================================================
// VIEW ROUTER
// ============================================================
const VIEWS = ['landing', 'pipeline', 'skill-trainer', 'dashboard'];

const APP_VIEWS = ['skill-trainer', 'dashboard'];

function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
  // Hero nav persists everywhere except app views (which have their own dark-nav)
  const hn = document.getElementById('hero-nav');
  if (hn) hn.classList.toggle('hidden', APP_VIEWS.includes(id));
  if (typeof updateSideArrows === 'function') updateSideArrows();
}

function goLanding()  {
  // Also close any active tour stage
  const stage = document.getElementById('tour-stage');
  if (stage && !stage.classList.contains('hidden')) {
    stage.classList.add('hidden');
    stage.classList.remove('active', 'entering', 'leaving');
  }
  showView('landing');
  const hn = document.getElementById('hero-nav');
  if (hn) { hn.classList.remove('hidden'); hn.classList.remove('pipeline-mode'); }
}
function goPipeline() {
  // Close tour stage if open
  const _ts = document.getElementById('tour-stage');
  if (_ts && !_ts.classList.contains('hidden')) {
    _ts.classList.add('hidden');
    _ts.classList.remove('active', 'entering', 'leaving');
  }
  showView('pipeline');
  document.getElementById('hero-nav')?.classList.add('pipeline-mode');
  playPipelineVideo();
  const data = Account.getStats();
  window.dispatchEvent(new CustomEvent('colin:event', { detail: {
    event: 'view_change',
    payload: {
      view: 'pipeline',
      user: Account.currentUser(),
      stats: data ? data.stats : null,
      sessions: data ? (data.sessions || 0) : 0
    }
  }}));
}
function goPipelineReturn() {
  const _ts = document.getElementById('tour-stage');
  if (_ts && !_ts.classList.contains('hidden')) {
    _ts.classList.add('hidden');
    _ts.classList.remove('active', 'entering', 'leaving');
  }
  showView('pipeline');
  document.getElementById('hero-nav')?.classList.add('pipeline-mode');
  showPipelineEndFrame();
  const data = Account.getStats();
  window.dispatchEvent(new CustomEvent('colin:event', { detail: {
    event: 'view_change',
    payload: {
      view: 'pipeline',
      user: Account.currentUser(),
      stats: data ? data.stats : null,
      sessions: data ? (data.sessions || 0) : 0
    }
  }}));
}
function goSkill(id)  { showView('skill-trainer'); launchSkill(id); }

// Phase-in: zoom the clicked pipeline item forward, then fade in the trainer.
function phaseIntoTrainer(skillId, itemEl) {
  const pipeline = document.getElementById('pipeline');
  const trainer  = document.getElementById('skill-trainer');
  if (!pipeline || !trainer) { goSkill(skillId); return; }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    goSkill(skillId);
    return;
  }

  // Set transform-origin on the pipeline to the clicked item's center
  // so the zoom appears to "dive into" that specific item.
  if (itemEl) {
    const pipeRect = pipeline.getBoundingClientRect();
    const hit = itemEl;
    const iRect = hit.getBoundingClientRect();
    const ox = ((iRect.left + iRect.width / 2)  - pipeRect.left) / pipeRect.width  * 100;
    const oy = ((iRect.top  + iRect.height / 2) - pipeRect.top)  / pipeRect.height * 100;
    pipeline.style.transformOrigin = `${ox}% ${oy}%`;
  }

  pipeline.classList.remove('phasing-in-return');
  pipeline.classList.add('phasing-in');

  setTimeout(() => {
    pipeline.classList.remove('phasing-in');
    pipeline.style.transformOrigin = '';
    goSkill(skillId);
    trainer.classList.remove('phasing-in-enter');
    void trainer.offsetWidth;
    trainer.classList.add('phasing-in-enter');
    setTimeout(() => trainer.classList.remove('phasing-in-enter'), 520);
  }, 460);
}

// Phase-out: fade/shrink the trainer, then bring pipeline back in.
function phaseOutTrainer() {
  const pipeline = document.getElementById('pipeline');
  const trainer  = document.getElementById('skill-trainer');
  if (!pipeline || !trainer) { goPipeline(); return; }

  if (activeSkillCleanup) { activeSkillCleanup(); activeSkillCleanup = null; }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    goPipeline();
    return;
  }

  trainer.classList.remove('phasing-in-enter');
  trainer.classList.add('phasing-out');

  setTimeout(() => {
    trainer.classList.remove('phasing-out');
    goPipelineReturn();
    pipeline.classList.remove('phasing-in-return');
    void pipeline.offsetWidth;
    pipeline.classList.add('phasing-in-return');
    setTimeout(() => pipeline.classList.remove('phasing-in-return'), 520);
  }, 340);
}
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
  const DRILL_IDS = SKILL_IDS.filter(id => id !== 'bet-spread');
  DRILL_IDS.forEach(id => {
    const s = stats[id] || { correct: 0, total: 0 };
    totalCorrect += s.correct;
    totalAttempts += s.total;
  });
  const globalPct = totalAttempts > 0 ? Math.round(totalCorrect / totalAttempts * 100) : 0;

  const weaknesses = DRILL_IDS.filter(id => {
    const s = stats[id] || { correct: 0, total: 0 };
    return s.total >= 10 && (s.correct / s.total) < 0.75;
  });
  const strengths = DRILL_IDS.filter(id => {
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
        if (id === 'bet-spread') {
          const _dCfg = Account.getBankrollConfig();
          const savedBankroll = _dCfg.bankroll;
          const savedRisk     = _dCfg.risk;
          const CFGS = {
            conservative: { divisor:500, spread:[1,1,2,4,8],   label:'1–8x' },
            moderate:     { divisor:300, spread:[1,2,4,8,12],  label:'1–12x' },
            aggressive:   { divisor:200, spread:[1,2,6,12,20], label:'1–20x' },
          };
          if (savedBankroll && savedRisk && CFGS[savedRisk]) {
            const cfg     = CFGS[savedRisk];
            const bankroll = parseInt(savedBankroll);
            const minBet  = Math.max(5, Math.round(bankroll / cfg.divisor / 5) * 5);
            const maxBet  = minBet * cfg.spread[4];
            const riskLabel = savedRisk.charAt(0).toUpperCase() + savedRisk.slice(1);
            return `<div class="dash-skill-card">
              <div class="dash-skill-top">
                <div class="dash-skill-name">${SKILL_NAMES[id]}</div>
                <div class="dash-skill-pct" style="color:var(--accent)">${cfg.label}</div>
              </div>
              <div class="dash-skill-detail">$${bankroll.toLocaleString()} bankroll · ${riskLabel}</div>
              <div class="dash-skill-detail" style="margin-top:.2rem;color:var(--tr-text)">$${minBet} → $${maxBet.toLocaleString()} per hand</div>
            </div>`;
          }
          return `<div class="dash-skill-card">
            <div class="dash-skill-top">
              <div class="dash-skill-name">${SKILL_NAMES[id]}</div>
              <div class="dash-skill-pct">—</div>
            </div>
            <div class="dash-skill-detail">Not configured yet</div>
          </div>`;
        }
        const s = stats[id] || { correct: 0, total: 0 };
        const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
        const cls = s.total < 5 ? 'dash-bar-neutral' : pct >= 85 ? 'dash-bar-good' : pct >= 65 ? 'dash-bar-ok' : 'dash-bar-bad';
        return `<div class="dash-skill-card">
          <div class="dash-skill-top">
            <div class="dash-skill-name">${SKILL_NAMES[id]}</div>
            <div class="dash-skill-pct">${s.total > 0 ? pct+'%' : '—'}</div>
          </div>
          <div class="dash-skill-detail">${s.correct}/${s.total} correct</div>
          <div class="dash-bar-track" style="margin-top:0.4rem"><div class="dash-bar-fill ${cls}" style="width:0%" data-target-width="${pct}%"></div></div>
        </div>`;
      }).join('')}
    </div>
    <div style="text-align:center;margin-top:2rem;display:flex;justify-content:center;gap:.75rem;flex-wrap:wrap">
      <button class="btn-primary" id="dash-reset" style="background:#5c1a1a;font-size:.85rem;padding:.5rem 1.2rem">Reset Data</button>
      <button class="btn-primary" id="dash-signout" style="background:#333;font-size:.85rem;padding:.5rem 1.2rem">Sign Out</button>
    </div>
  </div>`;

  // Animate skill bars from 0 to target width
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.dash-bar-fill[data-target-width]').forEach(bar => {
        bar.style.width = bar.dataset.targetWidth;
      });
    }, 80);
  });

  window.dispatchEvent(new CustomEvent('colin:event', { detail: {
    event: 'dashboard_load',
    payload: {
      user,
      stats,
      sessions: data.sessions || 0,
      globalPct,
      weaknesses,
      strengths
    }
  }}));

  document.getElementById('dash-reset').addEventListener('click', () => {
    if (!confirm('Reset all your stats? This cannot be undone.')) return;
    const user = Account.currentUser();
    if (!user) return;
    const accounts = Account._load();
    if (accounts[user]) {
      accounts[user].stats = {};
      SKILL_IDS.forEach(id => { accounts[user].stats[id] = { correct: 0, total: 0 }; });
      accounts[user].sessions = 0;
      Account._save(accounts);
    }
    renderDashboard();
  });

  document.getElementById('dash-signout').addEventListener('click', () => {
    Account.signOut();
    syncAuthUI();
    goLanding();
  });
}

// ============================================================
// PIPELINE — BLACKJACK TABLE SCENE
// ============================================================
const BJ_SKILL_NAMES = {
  'basic-strategy': 'Basic Strategy',
  'keep-counting':  'Running Count',
  'true-count':     'True Count',
  'deviations':     'Deviations',
  'bet-spread':     'Bet Spread',
  'full-training':  'Full Training'
};

// Hotspot positions as % of video frame (1928×1072)
const HOTSPOT_POS = {
  'basic-strategy': { left: '9%',  top: '9%',  width: '18%', height: '22%' },
  'keep-counting':  { left: '72%', top: '17%', width: '16%', height: '22%' },
  'true-count':     { left: '9%',  top: '27%', width: '16%', height: '20%' },
  'deviations':     { left: '74%', top: '4%',  width: '16%', height: '20%' },
  'bet-spread':     { left: '64%', top: '31%', width: '16%', height: '18%' },
  'full-training':  { left: '2%',  top: '48%', width: '18%', height: '16%' },
};

const BJ_LABEL_ANCHORS = {
  'bj-discard':    { dx: 0,   dy:  0.85 },
  'bj-dealerhand': { dx: 0,   dy:  0.95 },
  'bj-shoe':       { dx: 0,   dy:  0.85 },
  'bj-playerhand': { dx: 0,   dy: -0.75 },
  'bj-chipstack':  { dx: 0,   dy: -0.85 },
};

function initPipelineHotspots() {
  const container = document.getElementById('pipeline-hotspots');
  if (!container) return;
  container.addEventListener('click', e => {
    const label = e.target.closest('.ph-label[data-skill]');
    if (label) goSkill(label.dataset.skill);
  });
}

const PIPELINE_FRAME_COUNT = 121;
const PIPELINE_FPS = 24;
let pipelineFrames = [];
let pipelineFramesLoaded = false;
let pipelineAnimRaf = null;
let pipelineLastFrameTime = 0;
let pipelineCurrentFrame = 0;

function preloadPipelineFrames() {
  let loaded = 0;
  for (let i = 1; i <= PIPELINE_FRAME_COUNT; i++) {
    const img = new Image();
    const num = String(i).padStart(4, '0');
    img.src = `assets/frames/frame_${num}.jpg`;
    img.onload = img.onerror = () => {
      if (++loaded === PIPELINE_FRAME_COUNT) pipelineFramesLoaded = true;
    };
    pipelineFrames.push(img);
  }
}

function resizePipelineCanvas() {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;
  canvas.width  = Math.round(rect.width  * dpr);
  canvas.height = Math.round(rect.height * dpr);
  drawPipelineFrame(pipelineCurrentFrame);
}

function drawPipelineFrame(index) {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas || !canvas.width) return;
  const img = pipelineFrames[index];
  if (!img?.complete) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;
  const iw = img.naturalWidth || 1928, ih = img.naturalHeight || 1076;
  const scale = Math.max(cw / iw, ch / ih);
  const sw = iw * scale, sh = ih * scale;
  ctx.drawImage(img, (cw - sw) / 2, (ch - sh) / 2, sw, sh);
}

function showPipelineEndFrame() {
  cancelAnimationFrame(pipelineAnimRaf);
  resizePipelineCanvas();
  drawPipelineFrame(PIPELINE_FRAME_COUNT - 1);
  const hotspots = document.getElementById('pipeline-hotspots');
  if (hotspots) hotspots.classList.add('visible');
}

function playPipelineVideo() {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;

  const hotspots = document.getElementById('pipeline-hotspots');
  if (hotspots) hotspots.classList.remove('visible');

  cancelAnimationFrame(pipelineAnimRaf);
  pipelineCurrentFrame = 0;
  pipelineLastFrameTime = 0;
  resizePipelineCanvas();

  const interval = 1000 / PIPELINE_FPS;

  function animate(ts) {
    if (!pipelineLastFrameTime) pipelineLastFrameTime = ts;
    if (ts - pipelineLastFrameTime >= interval) {
      drawPipelineFrame(pipelineCurrentFrame);
      pipelineLastFrameTime = ts;
      if (pipelineCurrentFrame < PIPELINE_FRAME_COUNT - 1) {
        pipelineCurrentFrame++;
        pipelineAnimRaf = requestAnimationFrame(animate);
      } else {
        if (hotspots) hotspots.classList.add('visible');
      }
    } else {
      pipelineAnimRaf = requestAnimationFrame(animate);
    }
  }

  drawPipelineFrame(0);
  setTimeout(() => { pipelineAnimRaf = requestAnimationFrame(animate); }, 1000);
}

function renderPipelineStatus() {
  // No done-state shown on hotspots per design decision
}

function playBJEnterAnim() {
  // No-op: replaced by video animation
}

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
  showSkillIntro(skillId, bodyEl, scoreEl, skill);
}

// ============================================================
// SKILL INTRO SCREENS
// ============================================================
const SKILL_INTROS = {
  'basic-strategy': {
    icon: '♠',
    headline: 'Basic Strategy',
    sub: 'The optimal play for every hand — no guessing.',
    bullets: [
      'You\'ll see dealer upcard + your hand',
      'Choose Hit, Stand, Double, or Split',
      'Correct answer is shown after each play',
      'Build muscle memory until decisions are instant',
    ],
    howto: {
      overview: 'Basic strategy is a mathematically proven set of rules for every possible hand in blackjack. It tells you the exact right move — Hit, Stand, Double, or Split — based on your cards and the dealer\'s upcard. Playing perfect basic strategy reduces the house edge to around 0.5%, the lowest of any casino game.',
      sections: [
        {
          title: 'How the drill works',
          items: [
            'You are dealt two cards and shown the dealer\'s upcard.',
            'Select Hit, Stand, Double Down, or Split.',
            'The correct play is revealed immediately after you choose.',
            'Keep going until decisions feel automatic.',
          ],
        },
        {
          title: 'Key rules to remember',
          items: [
            'Always split Aces and 8s — no exceptions.',
            'Never split 10s or 5s.',
            'Double down on 11 against any dealer card except an Ace.',
            'Always hit a hard 16 against a dealer 10 or Ace.',
            'Stand on 17 or higher against any dealer card.',
          ],
        },
        {
          title: 'Why it matters',
          items: [
            'Without basic strategy, the average player gives up 2–3% to the house.',
            'With perfect basic strategy, that drops to 0.5%.',
            'Card counting only works on top of perfect basic strategy — this is the non-negotiable foundation.',
          ],
        },
      ],
    },
  },
  'keep-counting': {
    icon: '♣',
    headline: 'Running Count',
    sub: 'Five cards dealt one at a time — keep the count.',
    bullets: [
      '5 cards are revealed at your chosen speed',
      'Each card adds +1, 0, or −1 to the count',
      'Submit the running total when all cards are shown',
      'Speed up as your accuracy improves',
    ],
    howto: {
      overview: 'The Hi-Lo running count is the core of card counting. Every card dealt is assigned a value: low cards (2–6) add +1, neutral cards (7–9) add 0, and high cards (10–A) subtract −1. You keep a mental running total of these values as each card comes out.',
      sections: [
        {
          title: 'The Hi-Lo values',
          items: [
            '2, 3, 4, 5, 6 → +1 (low cards favour the dealer, so their exit helps you)',
            '7, 8, 9 → 0 (neutral, ignore these)',
            '10, J, Q, K, A → −1 (high cards favour the player)',
            'A positive count means more high cards remain — good for you.',
          ],
        },
        {
          title: 'How the drill works',
          items: [
            'Cards are dealt one at a time at your chosen speed.',
            'Add or subtract each card\'s value to your running total.',
            'When all cards are shown, submit your running count.',
            'Five speed levels: start slow, work up to casino pace.',
          ],
        },
        {
          title: 'Tips for accuracy',
          items: [
            'Don\'t try to memorize individual cards — just update the total.',
            'Practice cancellation: a 5 and a King cancel out to 0.',
            'At the casino, count every card on the table after each hand.',
            'Accuracy first, speed second — a wrong count is worse than a slow one.',
          ],
        },
      ],
    },
  },
  'deviations': {
    icon: '♦',
    headline: 'Deviations',
    sub: 'When the count tells you to override basic strategy.',
    bullets: [
      'A true count and hand scenario are shown',
      'Decide whether the count changes your play',
      'Basic strategy is shown as a reference',
      'Mastering these adds significant edge',
    ],
    howto: {
      overview: 'Basic strategy is calculated assuming a neutral deck. But when the true count rises or falls significantly, the mathematically correct play changes. These departures from basic strategy are called deviations, and the most important ones are known as the Illustrious 18.',
      sections: [
        {
          title: 'What is a deviation?',
          items: [
            'A deviation is any situation where the true count changes the correct play.',
            'Example: basic strategy says Stand on 16 vs 10 — but at TC −1 or lower, you Hit.',
            'Example: basic strategy says Hit on 12 vs 2 — but at TC +3 or higher, you Stand.',
            'Deviations are based on index numbers — the true count threshold at which you switch.',
          ],
        },
        {
          title: 'How the drill works',
          items: [
            'You are shown a hand, dealer upcard, and the current true count.',
            'Decide whether to play basic strategy or deviate based on the count.',
            'The correct answer and reasoning are shown after each round.',
            'Focus on the Illustrious 18 first — they cover the highest-impact scenarios.',
          ],
        },
        {
          title: 'The most important deviations',
          items: [
            'Insurance: take it at TC +3 or higher.',
            '16 vs 10: Stand at TC 0 or higher.',
            '15 vs 10: Stand at TC +4 or higher.',
            '10,10 vs 5: Split at TC +5 or higher.',
            '10,10 vs 6: Split at TC +4 or higher.',
          ],
        },
      ],
    },
  },
  'true-count': {
    icon: '÷',
    headline: 'True Count',
    sub: 'Normalize the running count by decks remaining.',
    bullets: [
      'A shoe and running count are shown',
      'Estimate decks remaining from the shoe depth',
      'Divide running count by decks remaining',
      'Round your answer to the nearest 0.5',
    ],
    howto: {
      overview: 'The running count tells you how many more high cards than low cards have been seen, but it doesn\'t account for how many decks are left. A running count of +10 means very different things in a 6-deck shoe vs. a 1-deck game. The true count normalizes this by dividing the running count by the number of decks remaining.',
      sections: [
        {
          title: 'The formula',
          items: [
            'True Count = Running Count ÷ Decks Remaining',
            'Round to the nearest 0.5 (e.g. +7 ÷ 2.5 decks = +2.8 → TC +3)',
            'Decks remaining is estimated visually from the discard tray.',
            'A 6-deck shoe is about 21cm thick — each deck is roughly 3.5cm.',
          ],
        },
        {
          title: 'How the drill works',
          items: [
            'You are shown a shoe with a visual indicator of how many decks remain.',
            'The current running count is displayed.',
            'Calculate and enter the true count to the nearest 0.5.',
            'Immediate feedback shows the correct answer and calculation.',
          ],
        },
        {
          title: 'Why this matters',
          items: [
            'All betting and deviation decisions are based on the true count, not the running count.',
            'At TC +1, you have roughly a 0.5% edge over the house.',
            'Each additional true count point adds approximately 0.5% to your edge.',
            'At TC +4 or above, you have a significant edge — this is when to bet big.',
          ],
        },
      ],
    },
  },
  'bet-spread': {
    icon: '$',
    headline: 'Bet Spread',
    sub: 'Size your bets based on your edge.',
    bullets: [
      'Enter your bankroll and risk tolerance',
      'Get a recommended bet for each true count',
      'See your hourly EV and standard deviation',
      'Know exactly what to bet before you sit down',
    ],
    startLabel: 'Configure →',
    howto: {
      overview: 'Knowing when you have an edge is only half the battle — you also need to know how much to bet. Bet too little and you leave money on the table. Bet too much and you risk ruin before the long run plays out. The bet spread trainer helps you build a mathematically sound betting ramp based on your bankroll.',
      sections: [
        {
          title: 'How bet sizing works',
          items: [
            'At a negative or neutral true count, bet the minimum (the "cover" bet).',
            'As the true count rises above +1, increase your bet proportionally.',
            'A common spread is 1–12 units (e.g. $10 minimum, $120 maximum).',
            'The Kelly Criterion tells you the mathematically optimal bet for each edge level.',
          ],
        },
        {
          title: 'What you\'ll configure',
          items: [
            'Your total bankroll — the amount you\'re willing to risk.',
            'Your minimum and maximum bet.',
            'Your betting ramp — how aggressively you scale up with the count.',
            'Risk of ruin tolerance — how often you\'re willing to bust your bankroll.',
          ],
        },
        {
          title: 'What you\'ll see',
          items: [
            'Recommended bet at each true count level (+1 through +6 and above).',
            'Hourly expected value (EV) — your average profit per hour at your bet sizes.',
            'Standard deviation — how much your results will swing in any given session.',
            'N0 — the number of hands needed to reach long-term expectation.',
          ],
        },
      ],
    },
  },
  'full-training': {
    icon: '★',
    headline: 'Full Training',
    sub: 'Count, play correctly, and size bets — simultaneously.',
    bullets: [
      'Cards are dealt across multiple rounds',
      'Maintain a running count through the shoe',
      'Make correct basic strategy plays on each hand',
      'Submit your count at the end of each round',
    ],
    howto: {
      overview: 'Full Training puts everything together in a simulated casino environment. You play real blackjack hands while simultaneously maintaining the running count and sizing bets based on your true count. This is the closest thing to sitting at a real table.',
      sections: [
        {
          title: 'What happens each round',
          items: [
            'You are dealt a hand against the dealer.',
            'Make the correct basic strategy play (or deviation if the count warrants it).',
            'Track every card that is dealt — yours, the dealer\'s, and any others.',
            'At the end of the round, submit your running count.',
          ],
        },
        {
          title: 'Bet sizing in full training',
          items: [
            'Your bankroll is tracked throughout the session.',
            'Bet sizes are based on the true count from the previous round.',
            'Correct bet sizing is part of your score.',
            'The goal is to grow your bankroll while keeping count accurately.',
          ],
        },
        {
          title: 'How to succeed',
          items: [
            'Don\'t attempt full training until basic strategy is automatic.',
            'Running count accuracy should be above 90% before combining skills.',
            'Start at the slowest speed — speed up as accuracy stabilizes.',
            'This is the final test. Casino-ready means consistently performing well here.',
          ],
        },
      ],
    },
  },
};

// ============================================================
// DYNAMIC DIFFICULTY
// ============================================================
// Levels 1–5 derived from the user's accuracy on that skill.
// New/untrained users always start at Level 1.
function computeDifficulty(skillId) {
  const data = Account.getStats();
  const s = data ? (data.stats[skillId] || { correct: 0, total: 0 }) : { correct: 0, total: 0 };
  const pct = s.total >= 5 ? Math.round((s.correct / s.total) * 100) : 0;

  let level;
  if (s.total < 5)   level = 1;
  else if (pct < 55) level = 1;
  else if (pct < 68) level = 2;
  else if (pct < 80) level = 3;
  else if (pct < 90) level = 4;
  else               level = 5;

  const NAMES = ['', 'Beginner', 'Developing', 'Intermediate', 'Advanced', 'Expert'];

  // KC: cards shown + reveal speed + countdown timer
  const KC_PARAMS = [
    null,
    { cardCount: 1, delayMs: 1200, timerMs: null  },
    { cardCount: 2, delayMs: 1000, timerMs: null  },
    { cardCount: 3, delayMs: 800,  timerMs: 9000  },
    { cardCount: 4, delayMs: 600,  timerMs: 6000  },
    { cardCount: 5, delayMs: 450,  timerMs: 4000  },
  ];

  // Deviations: how many from the ordered list to include
  const DEV_COUNT = [0, 5, 7, 9, 11, 13];

  // TrueCount: RC range and deck options
  const TC_PARAMS = [
    null,
    { rcRange: 6,  deckOpts: [1, 1.5, 2, 2.5, 3]                         },
    { rcRange: 10, deckOpts: [1, 1.5, 2, 2.5, 3, 3.5]                    },
    { rcRange: 14, deckOpts: [1, 1.5, 2, 2.5, 3, 3.5, 4]                 },
    { rcRange: 20, deckOpts: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]        },
    { rcRange: 25, deckOpts: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6] },
  ];

  return {
    level,
    name: NAMES[level],
    pct,
    total: s.total,
    kc: KC_PARAMS[level],
    devCount: DEV_COUNT[level],
    tc: TC_PARAMS[level],
  };
}

function showSkillIntro(skillId, bodyEl, scoreEl, skill) {
  const intro = SKILL_INTROS[skillId];
  if (!intro) {
    activeSkillCleanup = skill.start(bodyEl, scoreEl, skillId);
    return;
  }

  const diff = computeDifficulty(skillId);
  AppState.currentDifficulty[skillId] = diff;

  bodyEl.innerHTML = `
    <div class="skill-intro-wrap">
      <div class="skill-intro-icon">${intro.icon}</div>
      <h2 class="skill-intro-headline">${intro.headline}</h2>
      <div class="skill-intro-level">Level ${diff.level} · ${diff.name}</div>
      <button class="skill-intro-start" id="skill-intro-start-btn">${intro.startLabel || 'Start Training →'}</button>
    </div>
  `;

  const data = Account.getStats();
  const skillStats = data ? (data.stats[skillId] || { correct: 0, total: 0 }) : { correct: 0, total: 0 };
  window.dispatchEvent(new CustomEvent('colin:event', { detail: {
    event: 'trainer_enter',
    payload: { skillId, skillName: skill.name, stats: skillStats, difficultyLevel: diff.level, difficultyName: diff.name }
  }}));

  bodyEl.querySelector('#skill-intro-start-btn').addEventListener('click', () => {
    bodyEl.innerHTML = '';
    activeSkillCleanup = skill.start(bodyEl, scoreEl, skillId);
  });

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

// level 1 = hard only, 2 = hard+soft, 3+ = all types
function randomHand(level = 5) {
  const r = Math.random();
  if (level >= 3 && r < 0.15) {
    // Pair
    const pairs = ['AA','22','33','44','55','66','77','88','99','TT'];
    const p = pairs[Math.floor(Math.random()*pairs.length)];
    return { type:'pair', pairKey:p, label: p[0]==='T'?'10-10':p[0]+'-'+p[0], soft:false };
  }
  if (level >= 2 && r < 0.35) {
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
    const diff = AppState.currentDifficulty[skillId] || computeDifficulty(skillId);
    const level = diff.level;

    const wrap = document.createElement('div');
    wrap.className = 'kc-wrapper';
    wrap.style.maxWidth = '420px';
    wrap.style.width = '100%';

    wrap.innerHTML = `
      <div class="felt-table" style="width:100%">
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

      <div class="sk-actions sk-actions-vertical" id="bs-actions"></div>
      <button class="btn-primary sk-next-btn" id="bs-next">Next Hand →</button>
    `;
    body.appendChild(wrap);

    const dealerHandEl = wrap.querySelector('#bs-dealer-hand');
    const playerHandEl = wrap.querySelector('#bs-player-hand');
    const actionsEl    = wrap.querySelector('#bs-actions');
    const nextEl       = wrap.querySelector('#bs-next');

    function cardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function renderQuestion() {
      phase = 'question';
      hand = randomHand(level);
      dealerIdx = Math.floor(Math.random()*10);
      correctAction = bsLookup(hand, dealerIdx);

      // Build both hands first, then deal in casino order:
      // player1 → dealer-up → player2 → dealer-hole
      dealerHandEl.innerHTML = '';
      playerHandEl.innerHTML = '';

      const dealerBack   = cardBackEl();
      const dr = DEALER_LABELS[dealerIdx];
      const ds = SUITS[Math.floor(Math.random()*4)];
      const dealerUpcard = cardEl({rank:dr, suit:ds.name, sym:ds.sym});

      let p1, p2;
      if (hand.type === 'pair') {
        const r = hand.pairKey[0]==='T'?'10':hand.pairKey[0];
        const suits = shuffle([...SUITS]);
        p1 = cardEl({rank:r,suit:suits[0].name,sym:suits[0].sym});
        p2 = cardEl({rank:r,suit:suits[1].name,sym:suits[1].sym});
      } else if (hand.type === 'soft') {
        const x = hand.total - 11;
        const suits = shuffle([...SUITS]);
        p1 = cardEl({rank:'A',suit:suits[0].name,sym:suits[0].sym});
        p2 = cardEl({rank:String(x),suit:suits[1].name,sym:suits[1].sym});
      } else {
        const lo = Math.max(2, hand.total - 10);
        const hi = Math.min(10, hand.total - 2);
        const a = lo + Math.floor(Math.random() * (hi - lo + 1));
        const b = hand.total - a;
        const aRank = a === 10 ? '10' : String(a);
        const bRank = b === 10 ? '10' : String(b);
        const suits = shuffle([...SUITS]);
        p1 = cardEl({rank:aRank,suit:suits[0].name,sym:suits[0].sym});
        p2 = cardEl({rank:bRank,suit:suits[1].name,sym:suits[1].sym});
      }

      // Stagger classes = deal order
      p1.classList.add('dealt-in', 'deal-stagger-1');
      dealerUpcard.classList.add('dealt-in', 'deal-stagger-2');
      p2.classList.add('dealt-in', 'deal-stagger-3');
      dealerBack.classList.add('dealt-in', 'deal-stagger-4');

      // Append in DOM order: dealer [back, up], player [p1, p2]
      dealerHandEl.appendChild(dealerBack);
      dealerHandEl.appendChild(dealerUpcard);
      playerHandEl.appendChild(p1);
      playerHandEl.appendChild(p2);

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

      markScore(scoreEl, correct, total);

      Account.addResult(skillId, isCorrect);
      if (total >= 5) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'basic-strategy',
          isCorrect,
          chosen,
          correctAction,
          handLabel: hand.label,
          dealerLabel: DEALER_LABELS[dealerIdx],
          correct,
          total
        }
      }}));
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
    let score=0, roundsTotal=0;
    let phase='dealing', revealTimers=[], currentCards=[];
    let countdownTimer = null;
    // 60-second drill timer
    let drillSecondsLeft = 60;
    let drillInterval = null;
    let drillActive = false;
    let autoAdvanceTimer = null;

    const diff = AppState.currentDifficulty[skillId] || computeDifficulty(skillId);
    const { cardCount, delayMs, timerMs } = diff.kc;

    body.innerHTML = `
      <div class="kc-wrapper">
        <div class="drill-timer-wrap">
          <div class="drill-timer-ring">
            <svg viewBox="0 0 44 44" class="drill-timer-svg">
              <circle cx="22" cy="22" r="18" class="drill-timer-track"/>
              <circle cx="22" cy="22" r="18" class="drill-timer-progress" id="kc-ring-progress"/>
            </svg>
            <span class="drill-timer-num" id="kc-drill-secs">60</span>
          </div>
        </div>

        <div class="sk-card-stage" id="kc-stage" style="min-height:130px">
          <div style="text-align:center;color:var(--tr-dim);opacity:.5">♠ ♥ ♦ ♣</div>
        </div>

        <div id="kc-input-section">
          ${timerMs ? `<div id="kc-timer-bar-wrap"><div id="kc-timer-bar"></div></div>` : ''}
          <div class="count-controls">
            <button class="stepper-btn" id="kc-minus" disabled>−</button>
            <div class="count-display" id="kc-display">0</div>
            <button class="stepper-btn" id="kc-plus" disabled>+</button>
          </div>
          <div style="display:flex;justify-content:center;margin-top:1rem">
            <button class="btn-primary btn-submit" id="kc-submit" disabled>Submit Count</button>
          </div>
          <p class="keyboard-hint" style="margin-top:.5rem">or press <kbd>Enter</kbd> · <kbd>↑</kbd><kbd>↓</kbd> to adjust</p>
        </div>

      </div>
    `;

    const stageEl  = body.querySelector('#kc-stage');
    const inputSec = body.querySelector('#kc-input-section');
    const displayEl= body.querySelector('#kc-display');
    const minusBtn = body.querySelector('#kc-minus');
    const plusBtn  = body.querySelector('#kc-plus');
    const submitBtn= body.querySelector('#kc-submit');
    const timerBarEl = body.querySelector('#kc-timer-bar');
    const drillSecsEl = body.querySelector('#kc-drill-secs');
    const ringProgress = body.querySelector('#kc-ring-progress');

    // SVG circle circumference for r=18
    const CIRC = 2 * Math.PI * 18; // ≈113.1
    if (ringProgress) ringProgress.style.strokeDasharray = CIRC;

    function updateRing() {
      if (!ringProgress) return;
      const frac = drillSecondsLeft / 60;
      ringProgress.style.strokeDashoffset = CIRC * (1 - frac);
      ringProgress.style.stroke = drillSecondsLeft <= 10 ? '#f87171' : drillSecondsLeft <= 20 ? '#fb923c' : '#4ade80';
    }

    function initDeck() {
      deck = shuffle(buildDeck());
      deckIdx = 0;
      runningCount = 0;
    }
    function drawCards(n) {
      if (deckIdx + n * 4 >= deck.length) { deck = shuffle(buildDeck()); deckIdx=0; }
      return deck.slice(deckIdx, deckIdx += n);
    }

    function clearCountdown() {
      if (countdownTimer) { clearTimeout(countdownTimer); countdownTimer = null; }
      if (timerBarEl) { timerBarEl.style.transition = 'none'; timerBarEl.style.width = '100%'; }
    }

    function startCountdown() {
      if (!timerMs || !timerBarEl) return;
      clearCountdown();
      void timerBarEl.offsetWidth;
      timerBarEl.style.transition = `width ${timerMs}ms linear`;
      timerBarEl.style.width = '0%';
      countdownTimer = setTimeout(() => { submitCount(); }, timerMs);
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

    function endDrill() {
      drillActive = false;
      if (drillInterval) { clearInterval(drillInterval); drillInterval = null; }
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      clearRevealTimers();
      clearCountdown();
      phase = 'done';

      const pct = roundsTotal > 0 ? Math.round((score / roundsTotal) * 100) : 0;
      body.innerHTML = `
        <div class="kc-wrapper" style="gap:1.25rem;align-items:center;text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent)">Drill Complete</div>
          <div style="font-size:3.5rem;font-family:var(--font-serif);line-height:1;color:var(--tr-text)">${score}<span style="font-size:1.5rem;color:var(--tr-muted)"> / ${roundsTotal}</span></div>
          <div style="font-size:.9rem;color:var(--tr-muted)">${pct}% accuracy · ${roundsTotal} rounds</div>
          <button class="btn-primary" id="kc-restart" style="margin-top:.5rem">Run Again →</button>
        </div>
      `;
      body.querySelector('#kc-restart').addEventListener('click', () => {
        KeepCounting.start(body, scoreEl, skillId);
      });
    }

    function startDrillTimer() {
      drillActive = true;
      drillSecondsLeft = 60;
      updateRing();
      drillInterval = setInterval(() => {
        drillSecondsLeft--;
        if (drillSecsEl) drillSecsEl.textContent = drillSecondsLeft;
        updateRing();
        if (drillSecondsLeft <= 0) {
          clearInterval(drillInterval);
          drillInterval = null;
          endDrill();
        }
      }, 1000);
    }

    function dealRound() {
      if (!drillActive) return;
      clearRevealTimers();
      clearCountdown();
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      phase = 'dealing';
      playerCount = 0;
      updateDisplay();

      currentCards = drawCards(cardCount);
      const delta = currentCards.reduce((s,c)=>s+c.value,0);
      runningCount += delta;

      stageEl.innerHTML = '';
      minusBtn.disabled = true;
      plusBtn.disabled  = true;
      submitBtn.disabled = true;
      displayEl.style.opacity = '0.4';

      currentCards.forEach((c, i) => {
        const t = setTimeout(() => {
          const el = cardEl(c);
          el.classList.add('dealt-in');
          stageEl.appendChild(el);
          if (i === currentCards.length - 1) {
            const t2 = setTimeout(() => {
              if (!drillActive) return;
              phase = 'awaiting';
              minusBtn.disabled  = false;
              plusBtn.disabled   = false;
              submitBtn.disabled = false;
              displayEl.style.opacity = '';
              startCountdown();
            }, Math.min(delayMs, 600));
            revealTimers.push(t2);
          }
        }, i * delayMs);
        revealTimers.push(t);
      });
    }

    function submitCount() {
      if (phase !== 'awaiting') return;
      clearCountdown();
      phase = 'feedback';
      roundsTotal++;

      const isCorrect = playerCount === runningCount;
      if (isCorrect) score++;

      markScore(scoreEl, score, roundsTotal);
      Account.addResult(skillId, isCorrect);
      if (isCorrect) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'keep-counting',
          isCorrect,
          playerCount,
          correctCount: runningCount,
          cardBreakdown: currentCards.map(c => ({ rank: c.rank, value: c.value }))
        }
      }}));

      minusBtn.disabled  = true;
      plusBtn.disabled   = true;
      submitBtn.disabled = true;

      if (drillActive) {
        autoAdvanceTimer = setTimeout(() => { dealRound(); }, 900);
      }
    }

    minusBtn.addEventListener('click', ()=>{ if(phase==='awaiting'){playerCount--;updateDisplay();} });
    plusBtn.addEventListener('click',  ()=>{ if(phase==='awaiting'){playerCount++;updateDisplay();} });
    submitBtn.addEventListener('click', submitCount);

    const keyHandler = (e) => {
      if (document.getElementById('skill-trainer').classList.contains('hidden')) return;
      if (phase==='awaiting') {
        if (e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();playerCount++;updateDisplay();}
        if (e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();playerCount--;updateDisplay();}
        if (e.key==='Enter') submitCount();
      }
    };
    document.addEventListener('keydown', keyHandler);

    initDeck();
    startDrillTimer();
    dealRound();

    return () => {
      drillActive = false;
      clearRevealTimers();
      clearCountdown();
      if (drillInterval) { clearInterval(drillInterval); drillInterval = null; }
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
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
    const diff = AppState.currentDifficulty[skillId] || computeDifficulty(skillId);
    const activeDeviations = DEVIATIONS_LIST.slice(0, diff.devCount);

    const wrap = document.createElement('div');
    wrap.className = 'kc-wrapper';
    wrap.style.maxWidth = '420px';
    wrap.style.width = '100%';

    wrap.innerHTML = `
      <div class="felt-table" style="width:100%">
        <div style="position:absolute;top:.75rem;right:.85rem;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:7px;padding:.3rem .75rem;text-align:center">
          <div style="font-size:.5rem;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.3);margin-bottom:.1rem;font-weight:700">True Count</div>
          <div id="dev-tc" style="font-size:1.5rem;font-family:var(--font-serif);line-height:1">+2</div>
        </div>
        <div class="felt-dealer-zone">
          <span class="felt-zone-label">Dealer</span>
          <div class="felt-hand" id="dev-dealer-hand"></div>
        </div>
        <hr class="felt-divider">
        <div class="felt-player-zone">
          <span class="felt-zone-label">You</span>
          <div class="felt-hand" id="dev-player-hand"></div>
        </div>
      </div>

      <div class="sk-actions sk-actions-vertical" id="dev-actions"></div>
      <button class="btn-primary sk-next-btn" id="dev-next">Next Hand →</button>
    `;
    body.appendChild(wrap);

    const tcEl         = wrap.querySelector('#dev-tc');
    const basicEl      = null;
    const dealerHandEl = wrap.querySelector('#dev-dealer-hand');
    const playerHandEl = wrap.querySelector('#dev-player-hand');
    const actionsEl    = wrap.querySelector('#dev-actions');
    const nextEl       = wrap.querySelector('#dev-next');

    const ACTION_FULL = { H:'Hit', S:'Stand', D:'Double', P:'Split' };

    function cardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function renderQuestion() {
      phase = 'question';
      currentDev = activeDeviations[Math.floor(Math.random()*activeDeviations.length)];

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

      // Build cards, then deal in casino order:
      // player1 → dealer-up → player2 → dealer-hole
      dealerHandEl.innerHTML = '';
      playerHandEl.innerHTML = '';

      const dealerBack = cardBackEl();
      const ds = SUITS[Math.floor(Math.random()*4)];
      const dealerUpcard = cardEl({rank: currentDev.upcard, suit: ds.name, sym: ds.sym});

      const handStr = currentDev.hand;
      let cards = [];
      if (handStr.startsWith('A')) {
        const x = parseInt(handStr.slice(1));
        const s = shuffle([...SUITS]);
        cards = [{rank:'A', suit:s[0].name, sym:s[0].sym}, {rank:String(x), suit:s[1].name, sym:s[1].sym}];
      } else if (handStr.includes(',')) {
        const r = handStr.split(',')[0];
        const s = shuffle([...SUITS]);
        cards = [{rank:r, suit:s[0].name, sym:s[0].sym}, {rank:r, suit:s[1].name, sym:s[1].sym}];
      } else {
        const tot = parseInt(handStr);
        const lo = Math.max(2, tot - 10);
        const hi = Math.min(10, tot - 2);
        const a = lo + Math.floor(Math.random() * (hi - lo + 1));
        const b = tot - a;
        const s = shuffle([...SUITS]);
        cards = [{rank: a===10?'10':String(a), suit:s[0].name, sym:s[0].sym}, {rank: b===10?'10':String(b), suit:s[1].name, sym:s[1].sym}];
      }
      const p1 = cardEl(cards[0]);
      const p2 = cardEl(cards[1]);

      p1.classList.add('dealt-in', 'deal-stagger-1');
      dealerUpcard.classList.add('dealt-in', 'deal-stagger-2');
      p2.classList.add('dealt-in', 'deal-stagger-3');
      dealerBack.classList.add('dealt-in', 'deal-stagger-4');

      dealerHandEl.appendChild(dealerBack);
      dealerHandEl.appendChild(dealerUpcard);
      playerHandEl.appendChild(p1);
      playerHandEl.appendChild(p2);

      actionsEl.innerHTML = '';
      ['H','S','D'].forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'sk-action-btn';
        btn.textContent = ACTION_FULL[a];
        btn.dataset.action = a;
        btn.addEventListener('click', () => answer(a));
        actionsEl.appendChild(btn);
      });
      nextEl.classList.remove('visible');
    }

    function answer(chosen) {
      if (phase !== 'question') return;
      phase = 'feedback';
      total++;
      const correctAction = shouldDeviate ? currentDev.deviate : currentDev.basic;
      const isCorrect = chosen === correctAction;
      if (isCorrect) correct++;

      actionsEl.querySelectorAll('.sk-action-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.action === correctAction) b.classList.add('correct');
        if (b.dataset.action === chosen && !isCorrect) b.classList.add('wrong');
      });

      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'deviations',
          isCorrect,
          chosen,
          correctAction,
          hand: currentDev.hand,
          upcard: currentDev.upcard,
          trueCount: givenTC,
          shouldDeviate
        }
      }}));
      nextEl.classList.add('visible');
    }

    nextEl.addEventListener('click', renderQuestion);
    renderQuestion();
    return ()=>{};
  }
};

// ============================================================
// SKILL 4 — TRUE COUNT CONVERSION
// ============================================================
const TrueCount = {
  name: 'True Count',
  start(body, scoreEl, skillId) {
    let correct=0, total=0, phase='question', trueCount;
    const diff = AppState.currentDifficulty[skillId] || computeDifficulty(skillId);
    const { rcRange, deckOpts } = diff.tc;
    const SHOE_HEIGHT = 180;
    const CARD_EDGE_PX = 3;
    // 60-second drill
    let drillSecondsLeft = 60;
    let drillInterval = null;
    let drillActive = false;
    let autoAdvanceTimer = null;

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:400px;width:100%">
        <div class="drill-timer-wrap">
          <div class="drill-timer-ring">
            <svg viewBox="0 0 44 44" class="drill-timer-svg">
              <circle cx="22" cy="22" r="18" class="drill-timer-track"/>
              <circle cx="22" cy="22" r="18" class="drill-timer-progress" id="tc-ring-progress"/>
            </svg>
            <span class="drill-timer-num" id="tc-drill-secs">60</span>
          </div>
        </div>

        <div style="display:flex;align-items:flex-end;gap:1.5rem;justify-content:center;width:100%">
          <div class="shoe-visual-wrap" style="margin:0">
            <div class="shoe-outer">
              <div class="shoe-body">
                <div class="shoe-slot"></div>
                <div class="shoe-cards-stack" id="tc-stack"></div>
              </div>
              <div class="shoe-base"></div>
            </div>
          </div>

          <div style="background:var(--tr-panel);border:1px solid var(--tr-border);border-radius:12px;padding:1rem 1.5rem;text-align:center;flex:1">
            <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:var(--tr-dim);margin-bottom:.3rem">Running Count</div>
            <div style="font-size:3rem;font-family:var(--font-serif);line-height:1" id="tc-rc">+8</div>
          </div>
        </div>

        <p style="text-align:center;font-size:.82rem;color:var(--tr-muted);margin:0">RC ÷ decks remaining = true count (round to nearest 0.5)</p>

        <div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;width:100%">
          <input type="number" id="tc-input" step="0.5" inputmode="decimal"
            style="width:130px;text-align:center;font-size:2rem;font-family:var(--font-serif);background:var(--tr-panel);border:2px solid var(--tr-border);border-radius:10px;color:var(--tr-text);padding:.4rem .6rem;outline:none"
            placeholder="0">
          <button class="btn-primary" id="tc-submit">Submit</button>
        </div>
      </div>
    `;

    const rcEl      = body.querySelector('#tc-rc');
    const stackEl   = body.querySelector('#tc-stack');
    const inputEl   = body.querySelector('#tc-input');
    const drillSecsEl = body.querySelector('#tc-drill-secs');
    const ringProgress = body.querySelector('#tc-ring-progress');

    const CIRC = 2 * Math.PI * 18;
    if (ringProgress) ringProgress.style.strokeDasharray = CIRC;

    function updateRing() {
      if (!ringProgress) return;
      const frac = drillSecondsLeft / 60;
      ringProgress.style.strokeDashoffset = CIRC * (1 - frac);
      ringProgress.style.stroke = drillSecondsLeft <= 10 ? '#f87171' : drillSecondsLeft <= 20 ? '#fb923c' : '#4ade80';
    }

    function buildCardEdges(decksRemaining) {
      stackEl.innerHTML = '';
      const MAX_DECKS = 6;
      const fraction = Math.min(decksRemaining / MAX_DECKS, 1);
      const stackHeight = Math.round(fraction * SHOE_HEIGHT);
      const numEdges = Math.floor(stackHeight / CARD_EDGE_PX);
      for (let i = 0; i < numEdges; i++) {
        const edge = document.createElement('div');
        edge.className = 'shoe-card-edge';
        stackEl.appendChild(edge);
      }
      stackEl.style.height = (numEdges * CARD_EDGE_PX) + 'px';
    }

    function endDrill() {
      drillActive = false;
      if (drillInterval) { clearInterval(drillInterval); drillInterval = null; }
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
      phase = 'done';

      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      body.innerHTML = `
        <div class="kc-wrapper" style="gap:1.25rem;align-items:center;text-align:center">
          <div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.12em;color:var(--accent)">Drill Complete</div>
          <div style="font-size:3.5rem;font-family:var(--font-serif);line-height:1;color:var(--tr-text)">${correct}<span style="font-size:1.5rem;color:var(--tr-muted)"> / ${total}</span></div>
          <div style="font-size:.9rem;color:var(--tr-muted)">${pct}% accuracy · ${total} rounds</div>
          <button class="btn-primary" id="tc-restart" style="margin-top:.5rem">Run Again →</button>
        </div>
      `;
      body.querySelector('#tc-restart').addEventListener('click', () => {
        TrueCount.start(body, scoreEl, skillId);
      });
    }

    function startDrillTimer() {
      drillActive = true;
      drillSecondsLeft = 60;
      updateRing();
      drillInterval = setInterval(() => {
        drillSecondsLeft--;
        if (drillSecsEl) drillSecsEl.textContent = drillSecondsLeft;
        updateRing();
        if (drillSecondsLeft <= 0) {
          clearInterval(drillInterval);
          drillInterval = null;
          endDrill();
        }
      }, 1000);
    }

    function renderQuestion() {
      if (!drillActive) return;
      phase = 'question';
      inputEl.value = '';
      inputEl.disabled = false;

      // Build all (rc, decks) pairs where rc/decks is exactly a 0.5 multiple
      const candidates = [];
      for (const d of deckOpts) {
        for (let r = -rcRange; r <= rcRange; r++) {
          if (r === 0) continue;
          const tc = r / d;
          if (Math.abs(tc - Math.round(tc * 2) / 2) < 0.0001) {
            candidates.push({ rc: r, decks: d, tc: Math.round(tc * 2) / 2 });
          }
        }
      }
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const rc = pick.rc;
      const decks = pick.decks;
      trueCount = pick.tc;

      rcEl.textContent = rc >= 0 ? `+${rc}` : String(rc);
      rcEl.style.color = rc > 0 ? '#4ade80' : rc < 0 ? '#f87171' : 'var(--tr-text)';
      buildCardEdges(6 - decks);

      inputEl.focus();
    }

    function submitAnswer() {
      if (phase !== 'question') return;
      const val = parseFloat(inputEl.value);
      if (isNaN(val)) return;
      phase = 'feedback';
      inputEl.disabled = true;
      total++;
      const playerTC = val;
      const isCorrect = Math.abs(playerTC - trueCount) < 0.01;
      if (isCorrect) correct++;

      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'true-count',
          isCorrect,
          playerAnswer: playerTC,
          correctAnswer: trueCount
        }
      }}));

      if (drillActive) {
        autoAdvanceTimer = setTimeout(() => { renderQuestion(); }, 900);
      }
    }

    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });
    body.querySelector('#tc-submit').addEventListener('click', submitAnswer);

    startDrillTimer();
    renderQuestion();
    return () => {
      drillActive = false;
      if (drillInterval) { clearInterval(drillInterval); drillInterval = null; }
      if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); autoAdvanceTimer = null; }
    };
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
      // Persist bankroll + risk for full training
      Account.saveBankrollConfig(bankroll, risk);
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
    const TOTAL_SHOE = 312; // 6 decks
    const MINI_H = 120;
    const EDGE_PX = 2;

    // Load bankroll + bet-spread config
    const _bCfg = Account.getBankrollConfig();
    const savedBankroll = _bCfg.bankroll || 5000;
    const savedRisk     = _bCfg.risk || 'moderate';
    const SPREAD_CONFIGS = {
      conservative: { divisor:500, spread:[1,1,2,4,8]   },
      moderate:     { divisor:300, spread:[1,2,4,8,12]  },
      aggressive:   { divisor:200, spread:[1,2,6,12,20] },
    };
    const spreadCfg = SPREAD_CONFIGS[savedRisk] || SPREAD_CONFIGS.moderate;
    const minBet    = Math.max(5, Math.round(savedBankroll / spreadCfg.divisor / 5) * 5);
    const spreadBets = spreadCfg.spread.map(m => minBet * m);
    const TC_LABELS  = ['≤ 0','+1','+2','+3','+4+'];

    function buildShoe() { return shuffle(Array.from({length: 6}, buildDeck).flat()); }

    let deck = buildShoe(), deckIdx = 0;
    let runningCount = 0;
    let correct = 0;
    // Load persisted bankroll, fall back to configured starting amount
    let bankroll = _bCfg.ftBankroll || savedBankroll;
    let currentBet = 0;

    // Hand state
    let playerHands = [[]];
    let playerHandBets = [0];
    let activeHandIdx = 0;
    let dealerHandCards = [];
    let dealerUpCardObj = null;
    let dealerHoleCardObj = null;
    let firstActionCorrectPlay = null;
    let firstActionWasCorrect = false;
    let firstActionTaken = false;

    const trainerEl = document.getElementById('skill-trainer');
    if (trainerEl) trainerEl.classList.add('ft-active');

    body.innerHTML = `
      <div class="ft-table">

        <!-- Top bar: discard | shoe -->
        <div class="ft-topbar">
          <div class="ft-tray-group">
            <div class="ft-mini-case ft-tray-case">
              <div class="ft-mini-stack" id="ft-tray-stack"></div>
            </div>
            <div class="ft-mini-shoe-base ft-tray-base"></div>
            <div class="ft-mini-lbl">Discard</div>
          </div>

          <div class="ft-shoe-group">
            <div class="ft-mini-case ft-shoe-case">
              <div class="ft-mini-shoe-slot"></div>
              <div class="ft-mini-stack" id="ft-shoe-stack"></div>
            </div>
            <div class="ft-mini-shoe-base"></div>
            <div class="ft-mini-lbl">Shoe</div>
          </div>
        </div>

        <!-- Dealer zone -->
        <div class="ft-dealer-zone">
          <span class="ft-zone-lbl">Dealer</span>
          <div class="ft-dealer-cards" id="ft-dealer-cards"></div>
        </div>

        <!-- Felt arc divider -->
        <div class="ft-felt-divider"></div>

        <!-- Player zone: betting circle + cards -->
        <div class="ft-player-zone">
          <div class="ft-betting-area">
            <div class="ft-bet-circle" id="ft-bet-circle">
              <div class="ft-bet-chips" id="ft-bet-chips"></div>
              <span class="ft-bet-circle-amount">$<span id="ft-bet-amount">0</span></span>
            </div>
            <div class="ft-player-cards" id="ft-player-cards"></div>
          </div>
        </div>

        <!-- Bottom panel -->
        <div class="ft-bottom-panel">

          <!-- BET PHASE -->
          <div id="ft-phase-bet" class="ft-phase">
            <details class="ft-spread-ref">
              <summary class="ft-spread-ref-toggle">Bet Spread Reference</summary>
              <div class="ft-spread-ref-body" id="ft-spread-body"></div>
            </details>
            <div id="ft-bet-warning" class="ft-bet-warning hidden"></div>
            <div class="ft-chips" id="ft-chips">
              <button class="ft-chip ft-chip-5"   data-val="5"  ><span>$5</span></button>
              <button class="ft-chip ft-chip-25"  data-val="25" ><span>$25</span></button>
              <button class="ft-chip ft-chip-100" data-val="100"><span>$100</span></button>
              <button class="ft-chip ft-chip-500" data-val="500"><span>$500</span></button>
            </div>
            <div class="ft-bet-btns">
              <button class="ft-ghost-btn" id="ft-clear-bet">Clear</button>
              <button class="ft-deal-btn" id="ft-deal-btn" disabled>Deal →</button>
            </div>
          </div>

          <!-- PLAY PHASE -->
          <div id="ft-phase-play" class="ft-phase hidden">
            <div class="ft-phase-label" id="ft-play-label">What's your play?</div>
            <div class="ft-play-actions" id="ft-play-actions"></div>
          </div>

          <!-- RESULT PHASE -->
          <div id="ft-phase-result" class="ft-phase hidden">
            <div class="ft-result-row" id="ft-result-row"></div>
            <button class="ft-deal-btn" id="ft-next-btn">Next Hand →</button>
          </div>

          <!-- Bankroll — persistent footer -->
          <div class="ft-bankroll-footer">
            <div class="ft-bankroll-left">
              <span class="ft-bankroll-sublbl">Bankroll</span>
              <span class="ft-bankroll">$<span id="ft-bankroll">${bankroll.toLocaleString()}</span></span>
            </div>
            <button class="ft-ghost-btn ft-reset-btn" id="ft-reset-bankroll">Reset</button>
          </div>

        </div>
      </div>
    `;

    // Element refs
    const bankrollEl    = body.querySelector('#ft-bankroll');
    const dealerCardsEl = body.querySelector('#ft-dealer-cards');
    const playerCardsEl = body.querySelector('#ft-player-cards');
    const betAmountEl   = body.querySelector('#ft-bet-amount');
    const dealBtn       = body.querySelector('#ft-deal-btn');
    const clearBtn      = body.querySelector('#ft-clear-bet');
    const actionsEl     = body.querySelector('#ft-play-actions');
    const playLabelEl   = body.querySelector('#ft-play-label');
    const nextBtn       = body.querySelector('#ft-next-btn');
    const resultRow     = body.querySelector('#ft-result-row');
    const betChipsEl    = body.querySelector('#ft-bet-chips');
    const shoeStackEl   = body.querySelector('#ft-shoe-stack');
    const trayStackEl   = body.querySelector('#ft-tray-stack');
    const betWarningEl  = body.querySelector('#ft-bet-warning');
    const spreadBodyEl  = body.querySelector('#ft-spread-body');
    const resetBtn      = body.querySelector('#ft-reset-bankroll');

    const phaseBet    = body.querySelector('#ft-phase-bet');
    const phasePlay   = body.querySelector('#ft-phase-play');
    const phaseResult = body.querySelector('#ft-phase-result');

    function fmtMoney(n) { return n.toLocaleString(); }

    function showPhase(name) {
      [phaseBet, phasePlay, phaseResult].forEach(el => el.classList.add('hidden'));
      ({ bet: phaseBet, play: phasePlay, result: phaseResult })[name].classList.remove('hidden');
    }

    // ── Hand value helpers ──
    function handValue(cards) {
      let total = 0, aces = 0;
      for (const c of cards) {
        if (c.rank === 'A') { total += 11; aces++; }
        else if (['10','J','Q','K'].includes(c.rank)) total += 10;
        else total += parseInt(c.rank) || 0;
      }
      while (total > 21 && aces > 0) { total -= 10; aces--; }
      return total;
    }
    function isBusted(cards) { return handValue(cards) > 21; }
    function isNaturalBJ(cards) { return cards.length === 2 && handValue(cards) === 21; }

    // ── Bet spread reference & warning ──
    function getRecommendedBet() {
      const decksRem = Math.max(0.5, (deck.length - deckIdx) / 52);
      const tc = Math.round(runningCount / decksRem * 2) / 2;
      const idx = tc <= 0 ? 0 : tc >= 4 ? 4 : Math.min(4, Math.ceil(tc));
      return spreadBets[idx];
    }

    function updateBetWarning() {
      if (!betWarningEl || currentBet === 0) { betWarningEl.classList.add('hidden'); return; }
      const rec = getRecommendedBet();
      betWarningEl.classList.toggle('hidden', currentBet === rec);
      if (currentBet !== rec) betWarningEl.textContent = `Spread says $${rec.toLocaleString()} at current count`;
    }

    function refreshSpreadTable() {
      if (!spreadBodyEl) return;
      const decksRem = Math.max(0.5, (deck.length - deckIdx) / 52);
      const tc = Math.round(runningCount / decksRem * 2) / 2;
      const ai = tc <= 0 ? 0 : tc >= 4 ? 4 : Math.min(4, Math.ceil(tc));
      spreadBodyEl.innerHTML = `<table class="ft-spread-table">${
        TC_LABELS.map((lbl, i) => `<tr class="${i===ai?'ft-spread-active':''}">
          <td>${lbl}</td><td>$${spreadBets[i].toLocaleString()}</td>
        </tr>`).join('')
      }</table>`;
    }

    // ── Shoe / discard visual ──
    function renderMiniStack(el, count, total) {
      if (!el) return;
      const visible = Math.max(0, Math.round(Math.min(count / total, 1) * (MINI_H / EDGE_PX)));
      el.innerHTML = '';
      for (let i = 0; i < visible; i++) {
        const e = document.createElement('div');
        e.className = 'ft-card-edge';
        el.appendChild(e);
      }
      el.style.height = (visible * EDGE_PX) + 'px';
    }

    function updateShoeVisual() {
      const remaining = TOTAL_SHOE - (deckIdx % TOTAL_SHOE);
      renderMiniStack(shoeStackEl, remaining, TOTAL_SHOE);
      renderMiniStack(trayStackEl, deckIdx % TOTAL_SHOE, TOTAL_SHOE);
    }

    // ── Bet chips visual ──
    const CHIP_VALS = [[500,'ft-chip-500'],[100,'ft-chip-100'],[25,'ft-chip-25'],[5,'ft-chip-5']];
    function renderBetChips(amount) {
      if (!betChipsEl) return;
      if (amount === 0) { betChipsEl.innerHTML = ''; return; }
      let rem = amount;
      const chips = [];
      for (const [v, cls] of CHIP_VALS) { while (rem >= v) { chips.push(cls); rem -= v; } }
      betChipsEl.innerHTML = chips.slice(0, 6).map((cls, i) =>
        `<div class="ft-bet-chip-token ${cls}" style="bottom:${i*4}px;left:${i*1.5}px"></div>`
      ).join('');
    }

    function drawCards(n = 1) {
      if (deckIdx + n + 4 >= deck.length) { deck = buildShoe(); deckIdx = 0; }
      const cards = deck.slice(deckIdx, deckIdx += n);
      updateShoeVisual();
      return cards;
    }

    function cardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function updateBankrollDisplay() {
      bankrollEl.textContent = fmtMoney(bankroll);
      Account.saveFtBankroll(bankroll);
    }

    // Render a hand's cards with optional value badge
    function renderHand(cards, container, showValue = true) {
      container.innerHTML = '';
      cards.forEach((c, i) => {
        const el = cardEl(c);
        el.style.animationDelay = (i * 80) + 'ms';
        el.classList.add('dealing');
        container.appendChild(el);
      });
      if (showValue && cards.length > 0) {
        const val = handValue(cards);
        const bust = val > 21;
        const bj   = isNaturalBJ(cards);
        const badge = document.createElement('div');
        badge.className = 'ft-hand-badge' + (bust ? ' ft-hand-bust' : bj ? ' ft-hand-bj' : '');
        badge.textContent = bj ? 'BJ' : val;
        container.appendChild(badge);
      }
    }

    // ── Bet phase ──
    body.querySelectorAll('.ft-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.val);
        if (currentBet + val > bankroll) return;
        currentBet += val;
        betAmountEl.textContent = fmtMoney(currentBet);
        renderBetChips(currentBet);
        dealBtn.disabled = false;
        updateBetWarning();
      });
    });

    clearBtn.addEventListener('click', () => {
      currentBet = 0;
      betAmountEl.textContent = '0';
      renderBetChips(0);
      betWarningEl.classList.add('hidden');
      dealBtn.disabled = true;
    });

    resetBtn.addEventListener('click', () => {
      bankroll = savedBankroll;
      updateBankrollDisplay();
    });

    dealBtn.addEventListener('click', dealHand);

    // ── Deal ──
    function dealHand() {
      updateBetWarning();

      const p1        = drawCards(1)[0];
      const dealerUp  = drawCards(1)[0];
      const p2        = drawCards(1)[0];
      const dealerHole = drawCards(1)[0];

      dealerUpCardObj   = dealerUp;
      dealerHoleCardObj = dealerHole;
      dealerHandCards   = [dealerHole, dealerUp]; // hole first
      playerHands       = [[p1, p2]];
      playerHandBets    = [currentBet];
      activeHandIdx     = 0;
      firstActionTaken  = false;

      // Count visible cards
      [p1, p2, dealerUp].forEach(c => { runningCount += c.value; });

      // Render dealer (hole = back, up = face)
      dealerCardsEl.innerHTML = '';
      const backEl = cardBackEl();
      backEl.classList.add('dealing');
      dealerCardsEl.appendChild(backEl);
      const upEl = cardEl(dealerUp);
      upEl.style.animationDelay = '80ms';
      upEl.classList.add('dealing');
      dealerCardsEl.appendChild(upEl);

      // Render player
      renderHand([p1, p2], playerCardsEl);

      // Natural BJ — skip to dealer reveal
      if (isNaturalBJ([p1, p2])) {
        firstActionCorrectPlay = 'S';
        firstActionWasCorrect  = true;
        firstActionTaken       = true;
        setTimeout(() => runDealerAndResolve(), 700);
        return;
      }

      firstActionCorrectPlay = calcCorrectPlay([p1, p2], dealerUp);
      buildPlayActions([p1, p2], true);
      showPhase('play');
    }

    // ── Build action buttons ──
    function buildPlayActions(hand, isFirst) {
      actionsEl.innerHTML = '';
      playLabelEl.textContent = "What's your play?";
      const isPair = isFirst && hand.length === 2 && hand[0].rank === hand[1].rank;
      const actions = isFirst ? (isPair ? ['H','S','D','P'] : ['H','S','D']) : ['H','S'];
      actions.forEach(a => {
        const b = document.createElement('button');
        b.className = 'sk-action-btn';
        b.textContent = ACTION_LABELS[a];
        b.dataset.action = a;
        b.addEventListener('click', () => choosePlay(a));
        actionsEl.appendChild(b);
      });
    }

    // ── Player action ──
    function choosePlay(action) {
      const hand = playerHands[activeHandIdx];
      const isFirst = !firstActionTaken;

      // Track correctness of first decision for training feedback
      if (isFirst) {
        firstActionWasCorrect  = (action === firstActionCorrectPlay);
        firstActionTaken = true;
        // Briefly highlight correct/wrong
        actionsEl.querySelectorAll('.sk-action-btn').forEach(b => {
          b.disabled = true;
          if (b.dataset.action === firstActionCorrectPlay) b.classList.add('correct');
          if (b.dataset.action === action && !firstActionWasCorrect) b.classList.add('wrong');
        });
        Account.addResult(skillId, firstActionWasCorrect);
        if (firstActionWasCorrect) correct++;
        if (correct >= 5) AppState.skillStatus[skillId].done = true;
        markScore(scoreEl, correct, 0);
      } else {
        actionsEl.querySelectorAll('.sk-action-btn').forEach(b => b.disabled = true);
      }

      if (action === 'S') {
        // Stand
        setTimeout(() => runDealerAndResolve(), 300);
        return;
      }

      if (action === 'D') {
        // Double down — one card, double bet
        playerHandBets[activeHandIdx] *= 2;
        const [newCard] = drawCards(1);
        runningCount += newCard.value;
        hand.push(newCard);
        renderHand(hand, playerCardsEl);
        setTimeout(() => runDealerAndResolve(), 500);
        return;
      }

      if (action === 'P') {
        // Split — draw a card for each split hand
        const [c1] = drawCards(1);
        const [c2] = drawCards(1);
        runningCount += c1.value + c2.value;
        playerHands = [[hand[0], c1], [hand[1], c2]];
        playerHandBets = [currentBet, currentBet];
        activeHandIdx = 0;
        firstActionTaken = true; // no D/P after split
        renderHand(playerHands[0], playerCardsEl);
        firstActionCorrectPlay = calcCorrectPlay(playerHands[0], dealerUpCardObj);
        buildPlayActions(playerHands[0], false);
        showPhase('play');
        return;
      }

      // Hit
      const [newCard] = drawCards(1);
      runningCount += newCard.value;
      hand.push(newCard);
      renderHand(hand, playerCardsEl);

      if (isBusted(hand)) {
        // Bust on this hand — move to next split hand or dealer
        setTimeout(() => advanceAfterBust(), 400);
        return;
      }

      if (handValue(hand) === 21) {
        // Auto-stand on 21
        setTimeout(() => advanceToNextHandOrDealer(), 400);
        return;
      }

      // Offer H/S again
      buildPlayActions(hand, false);
    }

    function advanceAfterBust() {
      if (activeHandIdx < playerHands.length - 1) {
        activeHandIdx++;
        renderHand(playerHands[activeHandIdx], playerCardsEl);
        buildPlayActions(playerHands[activeHandIdx], false);
        showPhase('play');
      } else {
        runDealerAndResolve();
      }
    }

    function advanceToNextHandOrDealer() {
      if (activeHandIdx < playerHands.length - 1) {
        activeHandIdx++;
        renderHand(playerHands[activeHandIdx], playerCardsEl);
        buildPlayActions(playerHands[activeHandIdx], false);
        showPhase('play');
      } else {
        runDealerAndResolve();
      }
    }

    // ── Dealer plays ──
    function runDealerAndResolve() {
      // Disable play buttons, show dealer turn label
      actionsEl.innerHTML = '';
      playLabelEl.textContent = "Dealer's turn...";
      showPhase('play');

      // Reveal hole card
      const backEl = dealerCardsEl.querySelector('.card-back');
      if (backEl) {
        runningCount += dealerHoleCardObj.value;
        const faceEl = cardEl(dealerHoleCardObj);
        faceEl.classList.add('dealing');
        backEl.replaceWith(faceEl);
      }

      // Dealer draws to 17 with delay
      function dealerDrawNext() {
        const dv = handValue(dealerHandCards);
        if (dv >= 17) { setTimeout(resolveResult, 400); return; }
        setTimeout(() => {
          const [card] = drawCards(1);
          runningCount += card.value;
          dealerHandCards.push(card);
          const el = cardEl(card);
          el.classList.add('dealing');
          dealerCardsEl.appendChild(el);
          dealerDrawNext();
        }, 420);
      }
      setTimeout(dealerDrawNext, 350);
    }

    // ── Resolve and pay out ──
    function resolveResult() {
      const dv  = handValue(dealerHandCards);
      const dBJ = isNaturalBJ(dealerHandCards);

      let totalDelta = 0;
      const outcomes = playerHands.map((hand, i) => {
        const pv  = handValue(hand);
        const pBJ = isNaturalBJ(hand) && playerHands.length === 1;
        const bet = playerHandBets[i];

        if (pv > 21)       return { label: `Bust (${pv})`, delta: -bet };
        if (pBJ && dBJ)    return { label: 'Push — both Blackjack', delta: 0 };
        if (pBJ)           return { label: 'Blackjack! (3:2)', delta: Math.floor(bet * 1.5) };
        if (dBJ)           return { label: 'Dealer Blackjack', delta: -bet };
        if (dv > 21)       return { label: `Win — Dealer bust (${dv})`, delta: bet };
        if (pv > dv)       return { label: `Win (${pv} vs ${dv})`, delta: bet };
        if (pv === dv)     return { label: `Push (${pv})`, delta: 0 };
        return               { label: `Lose (${pv} vs ${dv})`, delta: -bet };
      });

      outcomes.forEach(o => { totalDelta += o.delta; });
      bankroll += totalDelta;
      if (bankroll < 0) bankroll = 0;
      updateBankrollDisplay();

      const bsCorrect = firstActionWasCorrect;
      const bsLabel   = bsCorrect ? '✓ Correct play' : `✗ Should: ${ACTION_LABELS[firstActionCorrectPlay]}`;

      resultRow.innerHTML = `
        <div class="ft-outcomes">
          ${outcomes.map(o => `
            <span class="ft-outcome-amount ${o.delta > 0 ? 'ft-outcome-win' : o.delta < 0 ? 'ft-outcome-lose' : 'ft-outcome-push'}">${o.delta >= 0 ? '+' : ''}$${Math.abs(o.delta).toLocaleString()}</span>
          `).join('')}
          <div class="ft-bs-verdict ${bsCorrect ? 'ft-bs-ok' : 'ft-bs-wrong'}">${bsLabel}</div>
        </div>
      `;

      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: { skillId: 'full-training', isCorrect: bsCorrect, playWasCorrect: bsCorrect,
                   correctPlay: firstActionCorrectPlay, runningCount, bankroll }
      }}));

      showPhase('result');
    }

    function calcCorrectPlay(pCards, dCard) {
      const pTotal = pCards.reduce((s, c) => {
        const v = c.rank==='A' ? 11 : (['10','J','Q','K'].includes(c.rank)) ? 10 : parseInt(c.rank)||0;
        return s + v;
      }, 0);
      const isAce  = pCards.some(c => c.rank === 'A');
      const isPair = pCards[0].rank === pCards[1].rank;
      const dLabel = (['10','J','Q','K'].includes(dCard.rank)) ? '10' : dCard.rank;
      const dI = Math.max(0, DEALER_LABELS.indexOf(dLabel));
      if (isPair) {
        const r   = pCards[0].rank;
        const key = (['10','J','Q','K'].includes(r)) ? 'TT' : (r+r);
        return (BS_PAIRS[key]||'SSSSSSSSSS')[dI] || 'S';
      }
      if (isAce && pTotal <= 21) {
        const soft = pTotal > 21 ? pTotal - 10 : pTotal;
        return (BS_SOFT[Math.min(20, Math.max(13, soft))]||'SSSSSSSSSS')[dI] || 'S';
      }
      const hard = pTotal > 21 ? pTotal - 10 : pTotal;
      if (hard >= 17) return 'S';
      return (BS_HARD[Math.min(16, Math.max(8, hard))]||'SSSSSSSSSS')[dI] || 'H';
    }

    nextBtn.addEventListener('click', () => {
      if (bankroll <= 0) { bankroll = savedBankroll; updateBankrollDisplay(); }
      currentBet = 0;
      betAmountEl.textContent = '0';
      renderBetChips(0);
      dealBtn.disabled = true;
      dealerCardsEl.innerHTML = '';
      playerCardsEl.innerHTML = '';
      refreshSpreadTable();
      betWarningEl.classList.add('hidden');
      showPhase('bet');
    });

    refreshSpreadTable();
    updateShoeVisual();
    showPhase('bet');
    return () => {
      if (trainerEl) trainerEl.classList.remove('ft-active');
    };
  }
};

// ============================================================
// LOADING SPINNER
// ============================================================
window.addEventListener('load', () => {
  const spinner = document.getElementById('page-spinner');
  if (spinner) spinner.classList.add('spinner-hidden');
  initPipelineHotspots();
  preloadPipelineFrames();
  window.addEventListener('resize', resizePipelineCanvas, { passive: true });
});

// ============================================================
// WOW.JS — landing page elements outside snap sections
// ============================================================
if (typeof WOW !== 'undefined') {
  new WOW({ offset: 60, mobile: false }).init();
}

// ============================================================
// SNAP SECTION REVEAL — animate .snap-reveal when section enters view
// ============================================================
(function () {
  const snap = document.getElementById('landing-snap');
  if (!snap) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const reveals = entry.target.querySelectorAll('.snap-reveal');
      if (entry.isIntersecting) {
        reveals.forEach(el => el.classList.add('snap-visible'));
      } else {
        // Reset so the spring fires again when scrolling back
        reveals.forEach(el => el.classList.remove('snap-visible'));
      }
    });
  }, { root: snap, threshold: 0.3 });

  snap.querySelectorAll('.ls').forEach(section => observer.observe(section));
})();

// Skills tab switching
document.querySelectorAll('.sk-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const sk = tab.dataset.sk;
    document.querySelectorAll('.sk-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sk-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sk-visual').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.querySelector(`.sk-panel[data-panel="${sk}"]`);
    const visual = document.querySelector(`.sk-visual[data-visual="${sk}"]`);
    if (panel) panel.classList.add('active');
    if (visual) visual.classList.add('active');
  });
});

// Skill CTA buttons → launch trainer
document.querySelectorAll('.sk-cta[data-skill]').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.skill;
    if (Account.currentUser()) goSkill(skill);
    else openAuthModal('signup');
  });
});

// ============================================================
// TYPING ANIMATION (hero subtitle)
// ============================================================
(function () {
  const el = document.getElementById('hero-typing-text');
  if (!el) return;
  const text = 'LEARN · PRACTICE · WIN';
  let i = 0;
  function type() {
    if (i < text.length) {
      el.textContent += text[i++];
      setTimeout(type, 75);
    }
  }
  // Start right after hero-line-2 finishes (2.1s delay + 0.55s anim = ~2.65s)
  setTimeout(type, 2700);
})();

// ============================================================
// HAMBURGER SIDEBAR NAV
// ============================================================
(function () {
  // Inject backdrop element
  const backdrop = document.createElement('div');
  backdrop.id = 'sidebar-backdrop';
  document.body.appendChild(backdrop);

  const sidebar  = document.getElementById('nav-sidebar');
  const hamburger = document.getElementById('nav-hamburger');
  const closeBtn  = document.getElementById('sidebar-close');
  const sidebarTrainBtn = document.getElementById('sidebar-train-btn');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('sidebar-open');
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('sidebar-open');
    backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (hamburger) hamburger.addEventListener('click', openSidebar);
  if (closeBtn)  closeBtn.addEventListener('click', closeSidebar);
  backdrop.addEventListener('click', closeSidebar);

  // Close on any sidebar link click
  if (sidebar) {
    sidebar.querySelectorAll('a:not(#sidebar-train-btn)').forEach(a => {
      a.addEventListener('click', closeSidebar);
    });
  }

  if (sidebarTrainBtn) {
    sidebarTrainBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSidebar();
      startTraining();
    });
  }
})();

// ============================================================
// NAVIGATION WIRING
// ============================================================

// ============================================================
// LEARN-MORE CHAPTER TOUR
// ============================================================
// The three "chapters" are the existing landing content sections,
// moved out of #landing-snap into #tour-pages at init time.
const TOUR_PAGE_IDS = ['info-sections', 'info-counting', 'feat-anchor'];
let tourIndex = 0;
let tourAnimating = false;
let tourInitialized = false;
let tourGeneration = 0; // incremented on every abort so stale callbacks self-cancel

function initTourPages() {
  if (tourInitialized) return;
  const pagesContainer = document.getElementById('tour-pages');
  if (!pagesContainer) return;
  TOUR_PAGE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement !== pagesContainer) {
      pagesContainer.appendChild(el);
    }
  });
  tourInitialized = true;
}

function renderTourProgress(index) {
  const prog = document.getElementById('tour-progress');
  if (!prog) return;
  prog.innerHTML = TOUR_PAGE_IDS.map((_, i) => {
    const cls = i === index ? 'active' : (i < index ? 'done' : '');
    return `<span class="tour-dot ${cls}"></span>`;
  }).join('');
}

function showTourPage(index) {
  const pagesContainer = document.getElementById('tour-pages');
  if (!pagesContainer) return;
  TOUR_PAGE_IDS.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (i === index) {
      el.classList.add('tour-page-active');
    } else {
      el.classList.remove('tour-page-active', 'zoom-in', 'zoom-out');
    }
  });
  // Scroll new page back to top
  pagesContainer.scrollTop = 0;
  renderTourProgress(index);
  updateSideArrows();
}

// ── Camera pan helper: move hero ring from its spot to screen center ──
function panHeroRingToCenter() {
  const wrap = document.querySelector('.hero-card-ring-wrap');
  if (!wrap) return 0;
  const rect = wrap.getBoundingClientRect();
  const dx = (window.innerWidth / 2) - (rect.left + rect.width / 2);
  const dy = (window.innerHeight / 2) - (rect.top + rect.height / 2);
  wrap.classList.add('panning');
  // translateY(-50%) is the element's base (top:50% centering); add our delta on top.
  wrap.style.transform = `translateY(-50%) translate(${dx}px, ${dy}px) scale(1.25)`;
  return { wrap, dx, dy };
}

function zoomHeroRingThrough(pan) {
  if (!pan || !pan.wrap) return;
  const { wrap, dx, dy } = pan;
  wrap.style.transform = `translateY(-50%) translate(${dx}px, ${dy}px) scale(7)`;
  wrap.classList.add('zoom-through');
}

function resetHeroRing() {
  const wrap = document.querySelector('.hero-card-ring-wrap');
  if (!wrap) return;
  wrap.classList.remove('panning', 'zoom-through', 'diving');
  wrap.style.transform = '';

  // Hide before the snap so the position jump is invisible
  wrap.style.transition = 'none';
  wrap.style.opacity = '0';

  const ring = document.querySelector('.hero-card-ring');
  if (ring) {
    ring.getAnimations().forEach(a => a.cancel());
    ring.style.transform = '';
    // Clear then force-reflow so the browser treats this as a fresh start,
    // but use 0s delay so the spin resumes immediately instead of waiting 4.2s.
    ring.style.animation = 'none';
    void ring.offsetWidth;
    ring.style.animation = 'cardRingSpin 40s linear 0s infinite';
  }

  // Fade back in after the snap settles (ring wrap is inside #landing so
  // it's invisible while the tour stage is open anyway)
  setTimeout(() => {
    wrap.style.transition = 'opacity 0.5s ease';
    void wrap.offsetHeight;
    wrap.style.opacity = '';
    setTimeout(() => { if (wrap) wrap.style.transition = ''; }, 600);
  }, 60);
}

// Build a flip-card overlay. The overlay is a fixed-size wrapper positioned on
// a full-viewport background (so the card is clearly visible), with the real
// tour page DOM moved into its back face. The BG div fades in during grow so
// the card sits on the same color as the final tour page — "zooming into card".
function buildFlipOverlay(tourSource) {
  const overlay = document.createElement('div');
  overlay.className = 'ace-flip-overlay';
  overlay.innerHTML = `
    <div class="ace-flip-bg"></div>
    <div class="ace-flip-wrap">
      <div class="ace-flip-inner">
        <div class="ace-flip-front">
          <span class="ace-rank-tl">A</span>
          <span class="ace-suit">♠</span>
          <span class="ace-rank-br">A</span>
        </div>
        <div class="ace-flip-back">
          <div class="ace-flip-back-rotator"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const rotator = overlay.querySelector('.ace-flip-back-rotator');
  rotator.appendChild(tourSource);
  tourSource.classList.add('tour-page-active');
  tourSource.classList.remove('zoom-in', 'zoom-out');
  return overlay;
}

// Helper: snap the back-content rotator to a given size + 2D rotation.
// The rotator is always absolutely positioned and centered via translate(-50%).
function setRotatorState(rotator, w, h, angleDeg) {
  rotator.style.width = w + 'px';
  rotator.style.height = h + 'px';
  rotator.style.transform = 'translate(-50%, -50%) rotate(' + angleDeg + 'deg)';
}

// Cinematic reveal: ring Ace → grow portrait card → flip to reveal vertical
// text on the back → turn card horizontal (text rotates upright with it) →
// seamless zoom to fullscreen. The real tour page DOM lives inside the back
// rotator the whole time, so the final handoff is an invisible same-node
// restore.
function flipAceIntoContent() {
  return new Promise(resolve => {
    const aceEl = document.querySelector('.hero-card-ring .rc-card:nth-child(1)');
    const ringWrap = document.querySelector('.hero-card-ring-wrap');
    const source = document.getElementById('info-sections');
    if (!aceEl || !ringWrap || !source) { resolve(null); return; }

    const aceRect = aceEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Remember where the tour page lives so we can put it back later
    const sourceParent = source.parentNode;
    const sourceNext = source.nextSibling;

    // Portrait "card viewing size" for flip phase, landscape = swapped dims
    // so the rotator naturally fits inside both orientations (w×h rotated
    // 90° ⇔ h×w, so a 476×340 rotator fits perfectly inside both a 340×476
    // portrait card and a 476×340 landscape card).
    const CARD_W = 340;
    const CARD_H = 476;
    const LAND_W = CARD_H; // 476
    const LAND_H = CARD_W; // 340

    const overlay = buildFlipOverlay(source);
    const bg = overlay.querySelector('.ace-flip-bg');
    const wrap = overlay.querySelector('.ace-flip-wrap');
    const inner = overlay.querySelector('.ace-flip-inner');
    const rotator = overlay.querySelector('.ace-flip-back-rotator');

    // Start: wrap sized & positioned exactly over the Ace
    wrap.style.width = aceRect.width + 'px';
    wrap.style.height = aceRect.height + 'px';
    wrap.style.left = aceRect.left + 'px';
    wrap.style.top = aceRect.top + 'px';
    inner.style.transform = 'rotateY(0deg)';
    bg.style.opacity = '0';

    // Rotator pre-set to the "vertical text inside portrait card" state.
    // The back face has backface-visibility: hidden, so the rotator isn't
    // actually visible yet during phase A (rotY=0 shows front only).
    setRotatorState(rotator, LAND_W, LAND_H, -90);

    // Hide the real hero ring now that the overlay has replaced it
    ringWrap.style.opacity = '0';

    void wrap.offsetWidth;

    // PHASE A — Grow: Ace rect → centered portrait card (500ms)
    const portX = (vw - CARD_W) / 2;
    const portY = (vh - CARD_H) / 2;
    wrap.style.transition = 'left 500ms cubic-bezier(0.22,1,0.36,1), top 500ms cubic-bezier(0.22,1,0.36,1), width 500ms cubic-bezier(0.22,1,0.36,1), height 500ms cubic-bezier(0.22,1,0.36,1)';
    bg.style.transition = 'opacity 500ms ease';
    requestAnimationFrame(() => {
      wrap.style.left = portX + 'px';
      wrap.style.top = portY + 'px';
      wrap.style.width = CARD_W + 'px';
      wrap.style.height = CARD_H + 'px';
      bg.style.opacity = '1';
    });

    setTimeout(() => {
      // PHASE B — Flip rotY 0 → 180 at portrait size (720ms)
      // User now sees: vertical text (rotator rotated -90°) on a portrait card.
      const flipAnim = inner.animate(
        [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(90deg)' },
          { transform: 'rotateY(180deg)' }
        ],
        { duration: 720, fill: 'forwards', easing: 'cubic-bezier(.5,.1,.3,1)' }
      );
      flipAnim.onfinish = () => {
        inner.style.transform = 'rotateY(180deg)';
        try { flipAnim.cancel(); } catch (e) { /* ignore */ }

        // PHASE C — Turn horizontal (700ms):
        //   wrap dims portrait 340×476 → landscape 476×340  AND
        //   rotator rotate(-90°) → rotate(0°)
        // Combined, the card appears to physically rotate 90° clockwise: it
        // widens into landscape while the text inside unwinds to upright.
        const landX = (vw - LAND_W) / 2;
        const landY = (vh - LAND_H) / 2;
        wrap.style.transition = 'left 700ms cubic-bezier(0.22,1,0.36,1), top 700ms cubic-bezier(0.22,1,0.36,1), width 700ms cubic-bezier(0.22,1,0.36,1), height 700ms cubic-bezier(0.22,1,0.36,1)';
        rotator.style.transition = 'transform 700ms cubic-bezier(0.22,1,0.36,1)';
        requestAnimationFrame(() => {
          wrap.style.left = landX + 'px';
          wrap.style.top = landY + 'px';
          wrap.style.width = LAND_W + 'px';
          wrap.style.height = LAND_H + 'px';
          rotator.style.transform = 'translate(-50%, -50%) rotate(0deg)';
        });

        setTimeout(() => {
          // PHASE D — Seamless zoom landscape → fullscreen (700ms). The
          // rotator grows with the wrap so the content fills the viewport.
          wrap.style.transition = 'left 700ms cubic-bezier(0.2,0,0.1,1), top 700ms cubic-bezier(0.2,0,0.1,1), width 700ms cubic-bezier(0.2,0,0.1,1), height 700ms cubic-bezier(0.2,0,0.1,1)';
          rotator.style.transition = 'width 700ms cubic-bezier(0.2,0,0.1,1), height 700ms cubic-bezier(0.2,0,0.1,1)';
          requestAnimationFrame(() => {
            wrap.style.left = '0px';
            wrap.style.top = '0px';
            wrap.style.width = vw + 'px';
            wrap.style.height = vh + 'px';
            rotator.style.width = vw + 'px';
            rotator.style.height = vh + 'px';
          });

          setTimeout(() => {
            // Restore tour page to its original slot — same DOM node, no flicker
            if (sourceNext) sourceParent.insertBefore(source, sourceNext);
            else sourceParent.appendChild(source);
            resolve(overlay);
          }, 730);
        }, 720);
      };
    }, 530);
  });
}

// Generic spin: bring the ring card at `cardIndex` to the front-facing position.
// cardIndex 0 = Ace (same as spinRingToAce), 1 = K♥, 2 = Q♠, etc.
function spinRingToCard(ring, cardIndex) {
  return new Promise(resolve => {
    const computedTransform = getComputedStyle(ring).transform;
    const matrix = new DOMMatrix(computedTransform);
    let currentAngle = Math.atan2(matrix.m13, matrix.m11) * 180 / Math.PI;
    if (currentAngle < 0) currentAngle += 360;

    ring.getAnimations().forEach(a => a.cancel());
    ring.style.animation = 'none';
    void ring.offsetWidth;

    // Card i sits at rotateY(i*45deg) on the ring.
    // For card i to face front the ring must be at -(i*45) mod 360.
    const cardDeg   = (cardIndex * 45) % 360;
    const targetMod = (360 - cardDeg) % 360;
    const gap       = ((targetMod - (currentAngle % 360)) + 360) % 360;
    const targetAngle = currentAngle + gap + 720; // ≥2 extra full spins

    const anim = ring.animate([
      { transform: `rotateX(14deg) rotateY(${currentAngle}deg)` },
      { transform: `rotateX(14deg) rotateY(${targetAngle}deg)` }
    ], {
      duration: 950,
      easing: 'cubic-bezier(0.1, 0, 0.3, 1)',
      fill: 'forwards'
    });

    anim.onfinish = () => resolve();
  });
}

// Spin ring from current position to Ace of Spades using Web Animations API
// (preserves live 3D spin continuity — no snap to 0deg)
function spinRingToAce(ring) {
  return new Promise(resolve => {
    // Read current Y angle from the running animation's computed matrix
    const computedTransform = getComputedStyle(ring).transform;
    const matrix = new DOMMatrix(computedTransform);
    // For rotateX(14deg)*rotateY(θ): m11=cos(θ), m13=sin(θ)
    let currentAngle = Math.atan2(matrix.m13, matrix.m11) * 180 / Math.PI;
    if (currentAngle < 0) currentAngle += 360;

    // Cancel CSS animation, freeze at current visual position
    ring.getAnimations().forEach(a => a.cancel());
    ring.style.animation = 'none';
    void ring.offsetWidth;

    // Target: nearest multiple-of-360 + 2 extra full spins (ends at Ace facing front)
    const gap = (360 - (currentAngle % 360)) % 360;
    const targetAngle = currentAngle + gap + 720; // 2 extra full rotations

    const anim = ring.animate([
      { transform: `rotateX(14deg) rotateY(${currentAngle}deg)` },
      { transform: `rotateX(14deg) rotateY(${targetAngle}deg)` }
    ], {
      duration: 950,
      easing: 'cubic-bezier(0.1, 0, 0.3, 1)', // fast start, dramatic deceleration to stop
      fill: 'forwards'
    });

    anim.onfinish = () => resolve();
  });
}

// Entry point: "Learn More" clicked on landing.
//
// Ring spin → card zooms fullscreen (no flip, no turn).
function startLearnMore() {
  initTourPages();
  const landing = document.getElementById('landing');
  const hero = document.querySelector('.ls-hero');
  const ring = document.querySelector('.hero-card-ring');
  const stage = document.getElementById('tour-stage');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tourIndex = 0;
    showTourPage(0);
    if (landing) landing.classList.add('hidden');
    if (stage) { stage.classList.remove('hidden'); stage.classList.add('active'); }
    updateSideArrows();
    return;
  }

  // Snap all ring cards to their final drop positions
  document.querySelectorAll('.hero-card-ring .rc-card').forEach((card, i) => {
    card.style.animation = 'none';
    card.style.transform = `rotateY(${i * 45}deg) translateZ(210px) translateY(0px)`;
  });

  // Fade hero text, pan ring to center, spin to Ace
  if (hero) hero.classList.add('tour-pending');
  const pan = panHeroRingToCenter();

  if (!ring) return;
  spinRingToAce(ring).then(() => {
    // Brief pause to let the spin settle visually
    setTimeout(() => {
      // Prepare tour stage behind landing (invisible)
      tourIndex = 0;
      if (stage) {
        stage.classList.remove('hidden');
        stage.classList.add('active');
        stage.style.opacity = '0';
      }
      showTourPage(0);

      const FADE_MS = TOUR_ZOOM_MS;
      if (landing) {
        landing.style.transformOrigin = '50% 40%';
        landing.style.transition = `transform ${FADE_MS}ms cubic-bezier(0.25, 0, 0.6, 1), opacity ${FADE_MS * 0.2}ms ease-in ${FADE_MS * 0.75}ms`;
        landing.style.opacity = '0';
        landing.style.transform = 'scale(45)';
      }
      if (stage) {
        stage.style.transform = 'scale(0.92)';
        void stage.offsetWidth;
        stage.style.transition = `opacity ${FADE_MS * 0.5}ms ease ${FADE_MS * 0.35}ms, transform ${FADE_MS}ms ease`;
        stage.style.opacity = '1';
        stage.style.transform = 'scale(1)';
      }

      // Cleanup after fade completes
      setTimeout(() => {
        if (landing) {
          landing.classList.add('hidden');
          landing.style.transition = '';
          landing.style.opacity = '';
          landing.style.transform = '';
          landing.style.transformOrigin = '';
        }
        if (stage) {
          stage.style.transition = '';
          stage.style.opacity = '';
          stage.style.transform = '';
        }
        if (hero) hero.classList.remove('tour-pending');
        resetHeroRing();
        updateSideArrows();
      }, FADE_MS + 40);
    }, 350);
  });
}

// Each tour page maps to a card: page0→Ace♠(0), page1→King♥(1), page2→Queen♠(2)
const TOUR_TARGET_CARD = [0, 1, 2];
// Shared zoom duration for all card-to-page transitions (startLearnMore + goTourCard)
const TOUR_ZOOM_MS = 1800;
// Transform origin for zooming INTO each card — targets the suit symbol
const CARD_ZOOM_ORIGIN = ['50% 42%', '50% 47%', '50% 42%'];

function goTourCard(nextIndex) {
  if (tourAnimating) return;
  if (nextIndex < 0 || nextIndex >= TOUR_PAGE_IDS.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tourIndex = nextIndex;
    showTourPage(nextIndex);
    return;
  }

  tourAnimating = true;
  const myGen = ++tourGeneration; // snapshot — stale if startTraining increments this
  const alive = () => myGen === tourGeneration;

  const ZOOM_MS     = TOUR_ZOOM_MS;
  const ZOOM_OUT_MS = 1200;
  const targetCard  = TOUR_TARGET_CARD[nextIndex] || 0;

  const currentEl = document.getElementById(TOUR_PAGE_IDS[tourIndex]);
  const wrap = document.querySelector('.hero-card-ring-wrap');
  const ring = document.querySelector('.hero-card-ring');

  if (!wrap || !ring) {
    tourIndex = nextIndex;
    showTourPage(nextIndex);
    tourAnimating = false;
    return;
  }

  // ── 1. Fade OUT current page — mirrors startLearnMore landing exit (scale up + fade) ──
  if (currentEl) {
    currentEl.style.transition = 'none';
    currentEl.style.transform = 'scale(1)';
    currentEl.style.opacity = '1';
    void currentEl.offsetWidth;
    currentEl.style.transition = `opacity ${ZOOM_OUT_MS * 0.4}ms ease-in, transform ${ZOOM_OUT_MS}ms cubic-bezier(0.25, 0, 0.6, 1)`;
    currentEl.style.opacity = '0';
    currentEl.style.transform = 'scale(1.08)';
  }

  // ── 2. After zoom-out, show hero ring centered on CURRENT card, then spin to target ──
  setTimeout(() => {
    if (!alive()) { // aborted — clean up and bail
      if (currentEl) { currentEl.classList.remove('tour-page-active'); currentEl.style.cssText = ''; }
      wrap.style.cssText = ''; resetHeroRing();
      return;
    }
    if (currentEl) {
      currentEl.classList.remove('tour-page-active');
      currentEl.style.transition = '';
      currentEl.style.transform = '';
      currentEl.style.opacity = '';
    }

    // Move hero ring to body, center it on screen
    document.body.appendChild(wrap);
    wrap.classList.remove('panning', 'zoom-through', 'diving');

    // Snap ring to the CURRENT card facing front so user sees it before spinning
    ring.getAnimations().forEach(a => a.cancel());
    ring.style.animation = 'none';
    const currentCardIndex = TOUR_TARGET_CARD[tourIndex];
    const snapAngle = (360 - (currentCardIndex * 45) % 360) % 360;
    ring.style.transform = `rotateX(14deg) rotateY(${snapAngle}deg)`;
    void ring.offsetWidth;

    wrap.style.cssText = `
      position: fixed; left: 50%; top: 50%;
      right: auto; transform: none;
      margin-left: -130px; margin-top: -170px;
      width: 260px; height: 340px;
      perspective: 900px; z-index: 501;
      opacity: 1; animation: none; transition: none;
    `;

    // Pause so user sees the current card, then spin to target
    setTimeout(() => {
    if (!alive()) { wrap.style.cssText = ''; resetHeroRing(); return; }
    spinRingToCard(ring, targetCard).then(() => {
      if (!alive()) { wrap.style.cssText = ''; resetHeroRing(); return; }

      // Measure the actual suit-symbol position now that the target card faces front
      const cards = ring.querySelectorAll('.rc-card');
      const frontCard = cards[targetCard];
      const sym = frontCard ? frontCard.querySelector('.suit-sym') : null;
      let origin = '50% 42%';
      if (sym) {
        const wrapRect = wrap.getBoundingClientRect();
        const symRect  = sym.getBoundingClientRect();
        const ox = ((symRect.left + symRect.width  / 2 - wrapRect.left) / wrapRect.width  * 100).toFixed(1);
        const oy = ((symRect.top  + symRect.height / 2 - wrapRect.top)  / wrapRect.height * 100).toFixed(1);
        origin = `${ox}% ${oy}%`;
      }

      // Update index + clean up old page — do NOT make new page visible yet
      tourIndex = nextIndex;
      const pages = document.getElementById('tour-pages');
      TOUR_PAGE_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (i !== nextIndex) el.classList.remove('tour-page-active', 'zoom-in', 'zoom-out');
      });
      if (pages) pages.scrollTop = 0;
      renderTourProgress(nextIndex);

      // Brief pause to see the card, then zoom in through the measured suit symbol
      setTimeout(() => {
        if (!alive()) { wrap.style.cssText = ''; resetHeroRing(); return; }
        wrap.style.transformOrigin = origin;
        wrap.style.transition = `transform ${ZOOM_MS}ms cubic-bezier(0.25, 0, 0.6, 1), opacity ${ZOOM_MS * 0.2}ms ease-in ${ZOOM_MS * 0.75}ms`;
        wrap.style.transform = 'scale(45)';
        wrap.style.opacity = '0';

        const newEl = document.getElementById(TOUR_PAGE_IDS[nextIndex]);

        // Start page fade-in at 35% of zoom — same proportion as startLearnMore
        setTimeout(() => {
          if (!alive()) return;
          if (newEl) {
            newEl.style.opacity = '0';
            newEl.style.transform = 'scale(0.92)';
            newEl.classList.add('tour-page-active');
            void newEl.offsetWidth;
            newEl.style.transition = `opacity ${ZOOM_MS * 0.5}ms ease, transform ${ZOOM_MS}ms ease`;
            newEl.style.opacity = '1';
            newEl.style.transform = 'scale(1)';
          }
        }, ZOOM_MS * 0.35);

        // Clean up ring after zoom fully completes
        setTimeout(() => {
          if (!alive()) { wrap.style.cssText = ''; resetHeroRing(); return; }
          const lsHero = document.querySelector('.ls-hero');
          const landing = document.getElementById('landing');
          const pipelineActive = !document.getElementById('pipeline')?.classList.contains('hidden');
          if (!pipelineActive) {
            if (lsHero) lsHero.appendChild(wrap);
            else if (landing) landing.appendChild(wrap);
          }
          wrap.style.cssText = '';
          resetHeroRing();

          if (newEl) {
            newEl.style.transition = '';
            newEl.style.opacity = '';
            newEl.style.transform = '';
          }
          tourAnimating = false;
          updateSideArrows();
        }, ZOOM_MS + 40);
      }, 400);
    });
    }, 450); // pause on current card before spinning

  }, ZOOM_OUT_MS + 10);
}

function tourNext() {
  if (tourIndex < TOUR_PAGE_IDS.length - 1) {
    goTourCard(tourIndex + 1, 'next');
  }
}

function tourPrev() {
  if (tourIndex > 0) {
    goTourCard(tourIndex - 1, 'prev');
  } else {
    exitTourToLanding();
  }
}

function exitTourToLanding() {
  const stage = document.getElementById('tour-stage');
  const landing = document.getElementById('landing');
  if (!stage) return;

  // Clear any active page state
  TOUR_PAGE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('tour-page-active', 'zoom-in', 'zoom-out');
  });

  const isPipelineActive = () => !document.getElementById('pipeline')?.classList.contains('hidden');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.classList.add('hidden');
    stage.classList.remove('active');
    if (landing && !isPipelineActive()) landing.classList.remove('hidden');
    updateSideArrows();
    return;
  }
  // Fade the stage out
  stage.style.transition = 'opacity 380ms ease';
  stage.style.opacity = '0';
  setTimeout(() => {
    stage.classList.add('hidden');
    stage.classList.remove('active');
    stage.style.opacity = '';
    stage.style.transition = '';
    if (landing && !isPipelineActive()) landing.classList.remove('hidden');
    // Restore the ring Ace that was hidden during the zoom-in reveal
    const aceEl = document.querySelector('.hero-card-ring .rc-card:nth-child(1)');
    if (aceEl) aceEl.style.opacity = '';
    resetHeroRing();
    updateSideArrows();
  }, 400);
}

// "Start Training" — fast-path straight to the pipeline (skips the tour).
// Used by the top-right nav button for returning users who already know the app.
function startTraining() {
  // Abort any in-flight tour animation and immediately hide the ring if it was moved to body
  tourAnimating = false;
  tourGeneration++;
  const wrap = document.querySelector('.hero-card-ring-wrap');
  if (wrap && wrap.parentElement === document.body) {
    wrap.style.cssText = '';
    resetHeroRing();
    const lsHero = document.querySelector('.ls-hero');
    const landing = document.getElementById('landing');
    if (lsHero) lsHero.appendChild(wrap);
    else if (landing) landing.appendChild(wrap);
  }
  const stage = document.getElementById('tour-stage');
  if (stage && !stage.classList.contains('hidden')) {
    stage.classList.add('hidden');
    stage.classList.remove('active', 'entering', 'leaving');
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    goPipeline();
    return;
  }
  const landing = document.getElementById('landing');
  if (!landing || landing.classList.contains('hidden')) { goPipeline(); return; }
  landing.classList.add('leaving');
  setTimeout(() => {
    landing.classList.remove('leaving');
    goPipeline();
  }, 280);
}

// ── Side arrow visibility + wiring ──────────────────────────
function updateSideArrows() {
  const left = document.getElementById('side-arrow-left');
  const right = document.getElementById('side-arrow-right');
  if (!left || !right) return;

  const stage = document.getElementById('tour-stage');
  const onTour = stage && !stage.classList.contains('hidden');

  // Default: hide both
  left.classList.add('hidden');
  right.classList.add('hidden');

  if (onTour) {
    // Left arrow always visible during the tour — on first page it exits to landing.
    left.classList.remove('hidden');
    // Right arrow hidden on final page — the 5 Skills page is the destination.
    if (tourIndex < TOUR_PAGE_IDS.length - 1) right.classList.remove('hidden');
  }
  // Landing, pipeline, skill-trainer, dashboard → no side arrows
}

// Wire up button clicks
const sideLeftBtn = document.getElementById('side-arrow-left');
const sideRightBtn = document.getElementById('side-arrow-right');
if (sideLeftBtn) sideLeftBtn.addEventListener('click', () => {
  const stage = document.getElementById('tour-stage');
  if (stage && !stage.classList.contains('hidden')) tourPrev();
});
if (sideRightBtn) sideRightBtn.addEventListener('click', () => {
  const stage = document.getElementById('tour-stage');
  if (stage && !stage.classList.contains('hidden')) tourNext();
});

// Keyboard nav for tour
document.addEventListener('keydown', (e) => {
  const stage = document.getElementById('tour-stage');
  if (!stage || stage.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight') tourNext();
  else if (e.key === 'ArrowLeft') tourPrev();
  else if (e.key === 'Escape') exitTourToLanding();
});

// Tour home button
const tourHome = document.getElementById('tour-home');
if (tourHome) tourHome.addEventListener('click', exitTourToLanding);

const heroCta = document.getElementById('hero-cta');
if (heroCta) heroCta.addEventListener('click', startLearnMore);


const navCta = document.getElementById('nav-cta');
if (navCta) navCta.addEventListener('click', startLearnMore);


const featuresCta = document.getElementById('features-cta');
if (featuresCta) featuresCta.addEventListener('click', startLearnMore);

const navStartBtn = document.getElementById('nav-start-btn');
if (navStartBtn) navStartBtn.addEventListener('click', startTraining);

const readyCta = document.getElementById('ready-cta');
if (readyCta) readyCta.addEventListener('click', startLearnMore);

const learnMoreBtn = document.getElementById('hero-explore-btn');
if (learnMoreBtn) learnMoreBtn.addEventListener('click', startLearnMore);

// Move the landing content sections into the tour stage as soon as possible
// so the landing only shows the hero and the tour pages are ready to display.
initTourPages();



// ── Per-card mouse repulsion (proximity-based, no ring tilt) ─
(function initCardRepulsion() {
  const cards   = document.querySelectorAll('.rc-card');
  const hero    = document.querySelector('.ls-hero');
  if (!hero || !cards.length) return;

  const INFLUENCE = 140; // screen-px radius to affect a card
  const MAX_PUSH  = 65;  // px to push card in Y
  const LERP      = 0.08;

  let mx = -9999, my = -9999;

  const state = Array.from(cards).map((_card, i) => ({
    ry: i * 45, targetY: 0, curY: 0, ready: false,
  }));

  cards.forEach((card, i) => {
    card.addEventListener('animationend', e => {
      if (e.target !== card) return; // ignore child animation events
      // Set final transform BEFORE killing animation to prevent snap
      card.style.transform = `rotateY(${state[i].ry}deg) translateZ(210px) translateY(0px)`;
      card.style.animation = 'none';
      state[i].ready = true;
    });
  });

  hero.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  hero.addEventListener('mouseleave', () => { mx = -9999; my = -9999; });

  function tick() {
    cards.forEach((card, i) => {
      const s = state[i];
      if (!s.ready) return;

      const rect = card.getBoundingClientRect();
      const cx   = rect.left + rect.width  / 2;
      const cy   = rect.top  + rect.height / 2;
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);

      if (dist < INFLUENCE) {
        const strength = (1 - dist / INFLUENCE) ** 2;
        // push up if mouse below card center, push down if mouse above
        s.targetY = (my > cy ? -1 : 1) * strength * MAX_PUSH;
      } else {
        s.targetY = 0;
      }

      s.curY += (s.targetY - s.curY) * LERP;
      card.style.transform = `rotateY(${s.ry}deg) translateZ(210px) translateY(${s.curY.toFixed(2)}px)`;
    });
    requestAnimationFrame(tick);
  }
  tick();
})();

// ── Per-letter hero headline drop ──────────────────────────
(function splitHeroLetters() {
  const LINE_DELAY  = 0.15; // gap between line 1 and line 2
  const CHAR_DELAY  = 0.035;
  const START       = 1.0;

  function split(el, startDelay) {
    const text = el.textContent;
    el.textContent = '';
    let d = startDelay;
    for (const ch of text) {
      const s = document.createElement('span');
      s.className = 'hero-char';
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.animationDelay = d.toFixed(3) + 's';
      el.appendChild(s);
      d += CHAR_DELAY;
    }
    return d;
  }

  const line1 = document.querySelector('.hero-line-1');
  const line2 = document.querySelector('.hero-line-2');
  if (line1 && line2) {
    const after1 = split(line1, START);
    split(line2, after1 + LINE_DELAY);
  }
})();

// ── Hero grid background ────────────────────────────────────
(function initHeroGrid() {
  const canvas = document.getElementById('hero-grid-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, mx = -999, my = -999;
  const SPACING = 28;
  const GLOW_R  = 55;

  // Offscreen canvas for the spotlight bright layer
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');

  function resize() {
    W = canvas.width  = off.width  = canvas.offsetWidth;
    H = canvas.height = off.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function drawGrid(c, color, lineW) {
    c.strokeStyle = color;
    c.lineWidth   = lineW;
    c.beginPath();
    for (let x = 0; x <= W; x += SPACING) {
      c.moveTo(x, 0); c.lineTo(x, H);
    }
    for (let y = 0; y <= H; y += SPACING) {
      c.moveTo(0, y); c.lineTo(W, y);
    }
    c.stroke();
  }

  function tick() {
    ctx.clearRect(0, 0, W, H);

    // Dim base grid
    drawGrid(ctx, 'rgba(170,145,120,0.08)', 0.4);

    // Bright spotlight grid — drawn to offscreen then masked
    offCtx.clearRect(0, 0, W, H);
    drawGrid(offCtx, 'rgba(140,100,55,0.35)', 0.8);

    // Mask the bright grid with a radial gradient
    offCtx.globalCompositeOperation = 'destination-in';
    const grad = offCtx.createRadialGradient(mx, my, 0, mx, my, GLOW_R);
    grad.addColorStop(0,   'rgba(0,0,0,1)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    offCtx.fillStyle = grad;
    offCtx.fillRect(0, 0, W, H);
    offCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(off, 0, 0);
    requestAnimationFrame(tick);
  }
  tick();

  let overButton = false;
  document.querySelectorAll('button, a, .hero-explore').forEach(el => {
    el.addEventListener('mouseenter', () => { overButton = true; });
    el.addEventListener('mouseleave', () => { overButton = false; });
  });

  const hero = document.querySelector('.ls-hero');
  if (hero) {
    hero.addEventListener('mousemove', e => {
      if (overButton) { mx = -999; my = -999; return; }
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    });
    hero.addEventListener('mouseleave', () => { mx = -999; my = -999; });
  }
})();

// Info popups (Blackjack / Card Counting)
function openInfoModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeInfoModal(id) {
  document.getElementById(id).classList.add('hidden');
}
['bj-modal', 'cc-modal'].forEach(id => {
  const overlay = document.getElementById(id);
  if (!overlay) return; // modals removed; skip
  overlay.addEventListener('click', e => { if (e.target === overlay) closeInfoModal(id); });
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfoModal(id); });
});
// Modal nav buttons removed; info sections are now inline on the landing page

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

// Nav link smooth scroll within landing-snap
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    const snap = document.getElementById('landing-snap');
    if (target && snap && snap.contains(target)) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Back buttons
const pipelineBack = document.getElementById('pipeline-back');
if (pipelineBack) pipelineBack.addEventListener('click', goLanding);

document.getElementById('skill-back').addEventListener('click', phaseOutTrainer);

const dashBack = document.getElementById('dashboard-back');
if (dashBack) dashBack.addEventListener('click', goPipeline);

// Clickable brand logos — always go home (landing), from any state
function forceGoHome() {
  // Cancel any in-flight tour animation so guards don't block cleanup
  tourAnimating = false;

  // Remove any ace-flip overlay that's still in the DOM (mid-animation)
  document.querySelectorAll('.ace-flip-overlay').forEach(el => el.remove());

  const stage = document.getElementById('tour-stage');
  const stageWasOpen = stage && !stage.classList.contains('hidden');

  if (stageWasOpen) {
    // Close tour stage synchronously and reset the ring — only needed when
    // coming FROM the tour. Calling resetHeroRing from landing would cancel
    // the live CSS spin animation and cause a visible snap+restart.
    TOUR_PAGE_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('tour-page-active', 'zoom-in', 'zoom-out');
    });
    stage.style.opacity = '';
    stage.style.transition = '';
    stage.classList.add('hidden');
    stage.classList.remove('active');
    // Restore ring Ace hidden during the zoom-in reveal
    const aceEl = document.querySelector('.hero-card-ring .rc-card:nth-child(1)');
    if (aceEl) aceEl.style.opacity = '';
    resetHeroRing(); // hides, snaps, then fades ring back in
  }

  goLanding();
}

['nav-brand-home', 'pipe-brand-home'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.reload();
  });
});

// ============================================================
// AUTH MODAL
// ============================================================
function openAuthModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  setTimeout(() => { const el = document.getElementById('auth-username'); if (el) el.focus(); }, 50);
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
  const errEl = document.getElementById('auth-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.add('hidden'); }
  ['auth-username', 'auth-pin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

const authModal = document.getElementById('auth-modal');
if (authModal) {
  authModal.addEventListener('click', e => { if (e.target === authModal) closeAuthModal(); });
  document.getElementById('auth-close').addEventListener('click', closeAuthModal);

  document.getElementById('auth-submit-btn').addEventListener('click', () => {
    const username = document.getElementById('auth-username').value.trim();
    const pin      = document.getElementById('auth-pin').value.trim();
    const errEl    = document.getElementById('auth-error');
    errEl.classList.add('hidden');
    if (!username || !pin) { errEl.textContent = 'Please enter a username and PIN.'; errEl.classList.remove('hidden'); return; }
    if (!/^\d{4}$/.test(pin)) { errEl.textContent = 'PIN must be exactly 4 digits.'; errEl.classList.remove('hidden'); return; }
    // Try sign in first, create account if user doesn't exist
    let result = Account.signIn(username, pin);
    if (result.error) {
      result = Account.signUp(username, pin);
      if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); return; }
    }
    syncAuthUI();
    closeAuthModal();
    goPipeline();
  });

  authModal.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuthModal(); });
}

// Pipeline nav account button + dropdown
const pipeNavAccount = document.getElementById('pipe-nav-account');
const pipeAccountDropdown = document.getElementById('pipe-account-dropdown');

if (pipeNavAccount) {
  pipeNavAccount.addEventListener('click', () => {
    if (Account.currentUser()) {
      pipeAccountDropdown.classList.toggle('hidden');
    } else {
      openAuthModal();
    }
  });
}

document.getElementById('pipe-dd-insights')?.addEventListener('click', () => {
  pipeAccountDropdown.classList.add('hidden');
  goDashboard();
});

document.getElementById('pipe-dd-signout')?.addEventListener('click', () => {
  pipeAccountDropdown.classList.add('hidden');
  Account.signOut();
  syncAuthUI();
  goLanding();
});

document.addEventListener('click', e => {
  if (pipeAccountDropdown && !pipeAccountDropdown.classList.contains('hidden')) {
    if (!document.getElementById('pipe-account-wrap').contains(e.target)) {
      pipeAccountDropdown.classList.add('hidden');
    }
  }
});

// Init auth UI on load
syncAuthUI();
