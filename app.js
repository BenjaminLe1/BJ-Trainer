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
  }
};

// ============================================================
// ACCOUNT SYSTEM (localStorage)
// ============================================================
const SKILL_IDS = ['basic-strategy','keep-counting','deviations','true-count','bet-spread'];
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
  }
};

// ============================================================
// VIEW ROUTER
// ============================================================
const VIEWS = ['landing', 'pipeline', 'skill-trainer', 'dashboard'];

const APP_VIEWS = ['pipeline', 'skill-trainer', 'dashboard'];

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
  if (hn) hn.classList.remove('hidden');
}
function goPipeline() {
  showView('pipeline');
  renderBJTable();
  renderPipelineStatus();
  playBJEnterAnim();
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
    const hit = itemEl.querySelector('.bj-hit') || itemEl;
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
    goPipeline();
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

let bjWired = false;
let bjResizeObserver = null;

// How each label sits relative to its SVG item.
// dx/dy are fractions of the item's bbox size:
//   dy: -0.5 puts label top of item, +0.5 puts label below it
//   dx: 0 = centered horizontally
const BJ_LABEL_ANCHORS = {
  'bj-discard':    { dx: 0,   dy:  0.85 }, // top-left item → label below it
  'bj-dealerhand': { dx: 0,   dy:  0.95 }, // top-center → below dealer's hand
  'bj-shoe':       { dx: 0,   dy:  0.85 }, // top-right → below shoe
  'bj-playerhand': { dx: 0,   dy: -0.75 }, // bottom → label above
  'bj-chipstack':  { dx: 0,   dy: -0.85 }, // bottom → label above
};

function renderBJTable() {
  const svg = document.getElementById('bj-svg');
  const scene = document.getElementById('bj-scene');
  if (!svg || !scene) return;

  if (!bjWired) {
    // Delegated click — phase into the clicked item, then navigate to trainer
    svg.addEventListener('click', (e) => {
      const group = e.target.closest('.bj-item');
      if (!group) return;
      const skill = group.dataset.skill;
      if (skill) phaseIntoTrainer(skill, group);
    });

    // Also let the HTML labels act as click targets (pointer-events enabled per-label)
    const labelsEl = document.getElementById('bj-labels');
    if (labelsEl) {
      labelsEl.addEventListener('click', (e) => {
        const label = e.target.closest('.bj-label');
        if (!label) return;
        const itemId = label.dataset.for;
        const item = document.getElementById(itemId);
        if (!item) return;
        const skill = item.dataset.skill;
        if (skill) phaseIntoTrainer(skill, item);
      });
    }

    // Reposition labels whenever the scene resizes
    if ('ResizeObserver' in window) {
      bjResizeObserver = new ResizeObserver(() => positionBJLabels());
      bjResizeObserver.observe(scene);
    }
    window.addEventListener('resize', positionBJLabels, { passive: true });

    bjWired = true;
  }

  // Position labels now, and again once the SVG has laid out.
  positionBJLabels();
  requestAnimationFrame(positionBJLabels);
  setTimeout(positionBJLabels, 100);
  setTimeout(positionBJLabels, 500);
}

function positionBJLabels() {
  const scene = document.getElementById('bj-scene');
  const labelsEl = document.getElementById('bj-labels');
  if (!scene || !labelsEl) return;

  const sRect = scene.getBoundingClientRect();
  if (sRect.width === 0) return;

  labelsEl.querySelectorAll('.bj-label').forEach(label => {
    const itemId = label.dataset.for;
    const item = document.getElementById(itemId);
    if (!item) return;

    // Use the visible hitbox if present (it's the authoritative clickable bounds),
    // otherwise fall back to the group itself.
    const hit = item.querySelector('.bj-hit') || item;
    const iRect = hit.getBoundingClientRect();
    if (iRect.width === 0) return;

    const anchor = BJ_LABEL_ANCHORS[itemId] || { dx: 0, dy: -0.75 };
    const cx = iRect.left + iRect.width / 2 - sRect.left + anchor.dx * iRect.width;
    const cy = iRect.top  + iRect.height / 2 - sRect.top  + anchor.dy * iRect.height;

    label.style.left = `${cx}px`;
    label.style.top  = `${cy}px`;

    // Enable click targets on the labels themselves
    label.style.pointerEvents = 'auto';
    label.classList.add('visible');

    // Sync done state from AppState
    const skillId = item.dataset.skill;
    const done = AppState.skillStatus && AppState.skillStatus[skillId] && AppState.skillStatus[skillId].done;
    label.classList.toggle('done', !!done);
  });
}

function renderPipelineStatus() {
  const svg = document.getElementById('bj-svg');
  const statusLayer = document.getElementById('bj-status');
  if (!svg || !statusLayer) return;

  // Clear all previous status marks and done classes
  statusLayer.innerHTML = '';
  svg.querySelectorAll('.bj-item.done').forEach(g => g.classList.remove('done'));

  Object.entries(AppState.skillStatus).forEach(([id, status]) => {
    if (status && status.done) markBJItemDone(id);
  });

  // Re-sync HTML label done states
  positionBJLabels();
}

function markBJItemDone(skillId) {
  const svg = document.getElementById('bj-svg');
  const statusLayer = document.getElementById('bj-status');
  if (!svg || !statusLayer) return;
  const group = svg.querySelector(`.bj-item[data-skill="${skillId}"]`);
  if (!group) return;

  group.classList.add('done');

  // bbox of the item in SVG user coordinates — draw a ring + check around it
  let bb;
  try { bb = group.getBBox(); } catch { return; }

  const cx = bb.x + bb.width / 2;
  const cy = bb.y + bb.height / 2;
  const r  = Math.max(bb.width, bb.height) / 2 + 10;

  // Remove existing mark for this id, then append fresh
  const existing = statusLayer.querySelector(`[data-for="${skillId}"]`);
  if (existing) existing.remove();

  const mark = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  mark.setAttribute('class', 'bj-done-mark');
  mark.setAttribute('data-for', skillId);

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', cx);
  ring.setAttribute('cy', cy);
  ring.setAttribute('r',  r);
  mark.appendChild(ring);

  // Small check badge in top-right of the ring
  const checkCx = cx + r * 0.72;
  const checkCy = cy - r * 0.72;
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', checkCx);
  bg.setAttribute('cy', checkCy);
  bg.setAttribute('r',  11);
  bg.setAttribute('fill', '#0a2815');
  bg.setAttribute('stroke', '#16a34a');
  bg.setAttribute('stroke-width', '2');
  mark.appendChild(bg);

  const check = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  check.setAttribute('d', `M ${checkCx - 5} ${checkCy} L ${checkCx - 1} ${checkCy + 4} L ${checkCx + 5} ${checkCy - 4}`);
  mark.appendChild(check);

  statusLayer.appendChild(mark);
}

function playBJEnterAnim() {
  const scene = document.getElementById('bj-scene');
  if (!scene) return;
  scene.classList.remove('entering');
  // Force reflow so the animation can replay
  void scene.offsetWidth;
  scene.classList.add('entering');
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
            'A wrong answer resets your streak — keep going until decisions feel automatic.',
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

function showSkillIntro(skillId, bodyEl, scoreEl, skill) {
  const intro = SKILL_INTROS[skillId];
  if (!intro) {
    activeSkillCleanup = skill.start(bodyEl, scoreEl, skillId);
    return;
  }

  bodyEl.innerHTML = `
    <div class="skill-intro-wrap">
      <div class="skill-intro-icon">${intro.icon}</div>
      <h2 class="skill-intro-headline">${intro.headline}</h2>
      <button class="skill-intro-start" id="skill-intro-start-btn">${intro.startLabel || 'Start Training →'}</button>
    </div>
  `;

  const data = Account.getStats();
  const skillStats = data ? (data.stats[skillId] || { correct: 0, total: 0 }) : { correct: 0, total: 0 };
  window.dispatchEvent(new CustomEvent('colin:event', { detail: {
    event: 'trainer_enter',
    payload: { skillId, skillName: skill.name, stats: skillStats }
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
    let correct=0, total=0, streak=0, phase='question', hand, dealerIdx, correctAction;

    const wrap = document.createElement('div');
    wrap.className = 'kc-wrapper';
    wrap.style.maxWidth = '420px';
    wrap.style.width = '100%';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--tr-muted)">
        <span>Streak</span>
        <span class="sk-score-num" id="bs-streak" style="font-size:1.5rem;font-family:var(--font-serif);color:var(--accent);line-height:1">0</span>
        <span id="bs-fire" style="font-size:1rem;opacity:0;transition:opacity .2s">🔥</span>
      </div>

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
    const streakEl     = wrap.querySelector('#bs-streak');
    const fireEl       = wrap.querySelector('#bs-fire');

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
      if (isCorrect) { correct++; streak++; } else { streak = 0; }

      streakEl.textContent = streak;
      fireEl.style.opacity = streak >= 3 ? '1' : '0';

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
          streak,
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
    let score=0, streak=0;
    let phase='dealing', revealTimers=[], currentCards=[];

    body.innerHTML = `
      <div class="kc-wrapper">
        <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--tr-muted)">
          <span>Streak</span>
          <span id="kc-streak" style="font-size:1.5rem;font-family:var(--font-serif);color:var(--accent);line-height:1">0</span>
          <span id="kc-fire" style="font-size:1rem;opacity:0;transition:opacity .2s">🔥</span>
        </div>

        <div class="kc-speed-wrap">
          <span class="kc-speed-label">Slow</span>
          <input type="range" id="kc-speed" min="400" max="3000" step="200" value="1800">
          <span class="kc-speed-label">Fast</span>
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

        <button class="btn-primary sk-next-btn" id="kc-next">Next Round →</button>

      </div>
    `;

    const strkEl   = body.querySelector('#kc-streak');
    const fireEl   = body.querySelector('#kc-fire');
    const stageEl  = body.querySelector('#kc-stage');
    const inputSec = body.querySelector('#kc-input-section');
    const displayEl= body.querySelector('#kc-display');
    const nextEl   = body.querySelector('#kc-next');
    const minusBtn = body.querySelector('#kc-minus');
    const plusBtn  = body.querySelector('#kc-plus');
    const submitBtn= body.querySelector('#kc-submit');
    const speedSlider = body.querySelector('#kc-speed');

    // Slider left = slow (large delay), right = fast (small delay)
    function getSpeedMs() { return 3400 - parseInt(speedSlider.value); }

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
      nextEl.classList.remove('visible');

      const ms = getSpeedMs();
      currentCards.forEach((c, i) => {
        const t = setTimeout(() => {
          const el = cardEl(c);
          el.classList.add('dealt-in');
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

      strkEl.textContent = streak;
      fireEl.style.opacity = streak >= 3 ? '1' : '0';
      markScore(scoreEl, score, score + (AppState.skillStatus[skillId].total||0));
      Account.addResult(skillId, isCorrect);
      if (isCorrect) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'keep-counting',
          isCorrect,
          playerCount,
          correctCount: runningCount,
          cardBreakdown: currentCards.map(c => ({ rank: c.rank, value: c.value })),
          streak
        }
      }}));

      inputSec.classList.add('hidden');
      nextEl.classList.add('visible');
    }

    minusBtn.addEventListener('click', ()=>{ if(phase==='awaiting'){playerCount--;updateDisplay();} });
    plusBtn.addEventListener('click',  ()=>{ if(phase==='awaiting'){playerCount++;updateDisplay();} });
    submitBtn.addEventListener('click', submitCount);
    nextEl.addEventListener('click', ()=>{ dealRound(); });

    const keyHandler = (e) => {
      if (document.getElementById('skill-trainer').classList.contains('hidden')) return;
      if (phase==='awaiting') {
        if (e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();playerCount++;updateDisplay();}
        if (e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();playerCount--;updateDisplay();}
        if (e.key==='Enter') submitCount();
      } else if (phase==='feedback') {
        if (e.key==='Enter'||e.key===' '){e.preventDefault();dealRound();}
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
    let correct=0, total=0, streak=0, phase='question', currentDev, givenTC, shouldDeviate;

    const wrap = document.createElement('div');
    wrap.className = 'kc-wrapper';
    wrap.style.maxWidth = '420px';
    wrap.style.width = '100%';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--tr-muted)">
        <span>Streak</span>
        <span id="dev-streak" style="font-size:1.5rem;font-family:var(--font-serif);color:var(--accent);line-height:1">0</span>
        <span id="dev-fire" style="font-size:1rem;opacity:0;transition:opacity .2s">🔥</span>
      </div>

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
        <div class="felt-basic-note">Basic strategy: <strong id="dev-basic">Hit</strong></div>
      </div>

      <div class="sk-actions sk-actions-vertical" id="dev-actions"></div>
      <button class="btn-primary sk-next-btn" id="dev-next">Next Hand →</button>
    `;
    body.appendChild(wrap);

    const tcEl         = wrap.querySelector('#dev-tc');
    const basicEl      = wrap.querySelector('#dev-basic');
    const dealerHandEl = wrap.querySelector('#dev-dealer-hand');
    const playerHandEl = wrap.querySelector('#dev-player-hand');
    const actionsEl    = wrap.querySelector('#dev-actions');
    const nextEl       = wrap.querySelector('#dev-next');
    const streakEl     = wrap.querySelector('#dev-streak');
    const fireEl       = wrap.querySelector('#dev-fire');

    const ACTION_FULL = { H:'Hit', S:'Stand', D:'Double', P:'Split' };

    function cardBackEl() {
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
      basicEl.textContent = ACTION_FULL[currentDev.basic] || currentDev.basic;

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
      if (isCorrect) { correct++; streak++; } else { streak = 0; }

      streakEl.textContent = streak;
      fireEl.style.opacity = streak >= 3 ? '1' : '0';

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
          shouldDeviate,
          streak
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
    let correct=0, total=0, streak=0, phase='question', trueCount;
    const SHOE_HEIGHT = 180;
    const CARD_EDGE_PX = 3;

    body.innerHTML = `
      <div class="kc-wrapper" style="max-width:400px;width:100%">
        <div style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:var(--tr-muted)">
          <span>Streak</span>
          <span id="tc-streak" style="font-size:1.5rem;font-family:var(--font-serif);color:var(--accent);line-height:1">0</span>
          <span id="tc-fire" style="font-size:1rem;opacity:0;transition:opacity .2s">🔥</span>
        </div>

        <div class="shoe-visual-wrap">
          <div class="shoe-outer">
            <div class="shoe-body">
              <div class="shoe-slot"></div>
              <div class="shoe-cards-stack" id="tc-stack"></div>
            </div>
            <div class="shoe-base"></div>
          </div>
          <div style="text-align:center;margin-top:.5rem;font-size:.78rem;color:var(--tr-muted)">
            <strong id="tc-decks-label" style="color:var(--tr-text);font-size:1rem">3</strong> decks remaining
          </div>
        </div>

        <div style="background:var(--tr-panel);border:1px solid var(--tr-border);border-radius:12px;padding:1rem 1.5rem;text-align:center;width:100%">
          <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:.1em;color:var(--tr-dim);margin-bottom:.3rem">Running Count</div>
          <div style="font-size:3rem;font-family:var(--font-serif);line-height:1" id="tc-rc">+8</div>
        </div>

        <p style="text-align:center;font-size:.82rem;color:var(--tr-muted);margin:0">RC ÷ decks remaining = true count (round to nearest 0.5)</p>

        <div style="display:flex;flex-direction:column;align-items:center;gap:.75rem;width:100%">
          <input type="number" id="tc-input" step="0.5" inputmode="decimal"
            style="width:130px;text-align:center;font-size:2rem;font-family:var(--font-serif);background:var(--tr-panel);border:2px solid var(--tr-border);border-radius:10px;color:var(--tr-text);padding:.4rem .6rem;outline:none"
            placeholder="0">
          <button class="btn-primary" id="tc-submit">Submit</button>
        </div>
        <button class="btn-primary sk-next-btn" id="tc-next">Next →</button>
      </div>
    `;

    const rcEl      = body.querySelector('#tc-rc');
    const stackEl   = body.querySelector('#tc-stack');
    const decksLbl  = body.querySelector('#tc-decks-label');
    const inputEl   = body.querySelector('#tc-input');
    const nextEl    = body.querySelector('#tc-next');
    const streakEl  = body.querySelector('#tc-streak');
    const fireEl    = body.querySelector('#tc-fire');

    function buildCardEdges(remaining) {
      stackEl.innerHTML = '';
      const maxVisible = Math.min(remaining, SHOE_HEIGHT / CARD_EDGE_PX);
      for (let i = 0; i < maxVisible; i++) {
        const edge = document.createElement('div');
        edge.className = 'shoe-card-edge';
        stackEl.appendChild(edge);
      }
      stackEl.style.height = Math.min(SHOE_HEIGHT, maxVisible * CARD_EDGE_PX) + 'px';
    }

    function renderQuestion() {
      phase = 'question';
      inputEl.value = '';
      inputEl.disabled = false;

      const rc = Math.floor(Math.random()*25) - 12;
      const decksOpts = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      const decks = decksOpts[Math.floor(Math.random()*decksOpts.length)];
      trueCount = Math.round(rc / decks * 2) / 2;

      rcEl.textContent = rc >= 0 ? `+${rc}` : String(rc);
      rcEl.style.color = rc > 0 ? '#4ade80' : rc < 0 ? '#f87171' : 'var(--tr-text)';
      decksLbl.textContent = decks % 1 === 0 ? String(decks) : decks.toFixed(1);
      buildCardEdges(Math.round(decks * 52));

      nextEl.classList.remove('visible');
      inputEl.focus();
    }

    function submitAnswer() {
      if (phase !== 'question') return;
      const val = parseFloat(inputEl.value);
      if (isNaN(val)) return;
      phase = 'feedback';
      inputEl.disabled = true;
      total++;
      const playerTC = Math.round(val * 2) / 2;
      const isCorrect = playerTC === trueCount;
      if (isCorrect) { correct++; streak++; } else { streak = 0; }

      streakEl.textContent = streak;
      fireEl.style.opacity = streak >= 3 ? '1' : '0';

      markScore(scoreEl, correct, total);
      Account.addResult(skillId, isCorrect);
      if (correct >= 5) AppState.skillStatus[skillId].done = true;
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'true-count',
          isCorrect,
          playerAnswer: playerTC,
          correctAnswer: trueCount,
          streak
        }
      }}));
      nextEl.classList.add('visible');
    }

    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitAnswer(); });
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
    // Session state
    let deck = shuffle(buildDeck()), deckIdx = 0;
    let runningCount = 0, playerCount = 0;
    let streak = 0;
    let bankroll = 1000, currentBet = 0;
    let phase = 'bet'; // 'bet' | 'play' | 'count' | 'feedback'
    let correctPlay, playWasCorrect;
    let visibleCards = []; // all cards shown this round (for count tracking)

    // Activate full-table layout on the skill-trainer wrapper
    const trainerEl = document.getElementById('skill-trainer');
    if (trainerEl) trainerEl.classList.add('ft-active');

    body.innerHTML = `
      <div class="ft-table">

        <!-- Top bar: bankroll + streak -->
        <div class="ft-topbar">
          <div class="ft-bankroll">$<span id="ft-bankroll">1,000</span></div>
          <div class="ft-streak-bar">
            <span class="ft-streak-label">Streak</span>
            <span id="ft-streak" class="ft-streak-num">0</span>
            <span id="ft-fire" class="ft-streak-fire">🔥</span>
          </div>
        </div>

        <!-- Dealer zone -->
        <div class="ft-dealer-zone">
          <span class="ft-zone-lbl">Dealer</span>
          <div class="ft-dealer-cards" id="ft-dealer-cards"></div>
        </div>

        <!-- Player zone -->
        <div class="ft-player-zone">
          <div class="ft-player-cards" id="ft-player-cards"></div>
        </div>

        <!-- Bottom panel — swaps between phases -->
        <div class="ft-bottom-panel">

          <!-- BET PHASE -->
          <div id="ft-phase-bet" class="ft-phase">
            <div class="ft-bet-row">
              <span class="ft-bet-lbl">Place your bet</span>
              <span class="ft-bet-amount">$<span id="ft-bet-amount">0</span></span>
            </div>
            <div class="ft-chips" id="ft-chips">
              <button class="ft-chip ft-chip-10"  data-val="10">$10</button>
              <button class="ft-chip ft-chip-25"  data-val="25">$25</button>
              <button class="ft-chip ft-chip-50"  data-val="50">$50</button>
              <button class="ft-chip ft-chip-100" data-val="100">$100</button>
            </div>
            <div class="ft-bet-btns">
              <button class="ft-ghost-btn" id="ft-clear-bet">Clear</button>
              <button class="ft-deal-btn" id="ft-deal-btn" disabled>Deal →</button>
            </div>
          </div>

          <!-- PLAY PHASE -->
          <div id="ft-phase-play" class="ft-phase hidden">
            <div class="ft-phase-label">What's your play?</div>
            <div class="ft-play-actions" id="ft-play-actions"></div>
          </div>

          <!-- COUNT PHASE -->
          <div id="ft-phase-count" class="ft-phase hidden">
            <div class="ft-phase-label">Running count of all visible cards?</div>
            <div class="count-controls">
              <button class="stepper-btn" id="ft-minus">−</button>
              <div class="count-display" id="ft-display">0</div>
              <button class="stepper-btn" id="ft-plus">+</button>
            </div>
            <div style="display:flex;justify-content:center;margin-top:.85rem">
              <button class="btn-primary" id="ft-count-submit">Submit Count</button>
            </div>
          </div>

          <!-- FEEDBACK PHASE -->
          <div id="ft-phase-feedback" class="ft-phase hidden">
            <div class="ft-result-row" id="ft-result-row"></div>
            <button class="ft-deal-btn" id="ft-next-btn">Next Hand →</button>
          </div>

        </div><!-- end ft-bottom-panel -->
      </div><!-- end ft-table -->
    `;

    // Element refs
    const bankrollEl  = body.querySelector('#ft-bankroll');
    const streakEl    = body.querySelector('#ft-streak');
    const fireEl      = body.querySelector('#ft-fire');
    const dealerCards = body.querySelector('#ft-dealer-cards');
    const playerCards = body.querySelector('#ft-player-cards');
    const betAmountEl = body.querySelector('#ft-bet-amount');
    const dealBtn     = body.querySelector('#ft-deal-btn');
    const clearBtn    = body.querySelector('#ft-clear-bet');
    const actionsEl   = body.querySelector('#ft-play-actions');
    const displayEl   = body.querySelector('#ft-display');
    const nextBtn     = body.querySelector('#ft-next-btn');
    const resultRow   = body.querySelector('#ft-result-row');

    const phaseBet      = body.querySelector('#ft-phase-bet');
    const phasePlay     = body.querySelector('#ft-phase-play');
    const phaseCount    = body.querySelector('#ft-phase-count');
    const phaseFeedback = body.querySelector('#ft-phase-feedback');

    function fmtMoney(n) { return n.toLocaleString(); }

    function showPhase(name) {
      [phaseBet, phasePlay, phaseCount, phaseFeedback].forEach(el => el.classList.add('hidden'));
      ({ bet: phaseBet, play: phasePlay, count: phaseCount, feedback: phaseFeedback })[name].classList.remove('hidden');
      phase = name;
    }

    function draw(n = 1) {
      if (deckIdx + n + 4 >= deck.length) { deck = shuffle(buildDeck()); deckIdx = 0; }
      return deck.slice(deckIdx, deckIdx += n);
    }

    function cardBackEl() {
      const el = document.createElement('div');
      el.className = 'card card-back';
      return el;
    }

    function updateCountDisplay() {
      displayEl.textContent = playerCount > 0 ? `+${playerCount}` : String(playerCount);
      displayEl.classList.toggle('positive', playerCount > 0);
      displayEl.classList.toggle('negative', playerCount < 0);
    }

    function updateBankrollDisplay() {
      bankrollEl.textContent = fmtMoney(bankroll);
    }

    // ── BET PHASE ──
    body.querySelectorAll('.ft-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const val = parseInt(chip.dataset.val);
        if (currentBet + val > bankroll) return;
        currentBet += val;
        betAmountEl.textContent = fmtMoney(currentBet);
        dealBtn.disabled = false;
      });
    });
    clearBtn.addEventListener('click', () => {
      currentBet = 0;
      betAmountEl.textContent = '0';
      dealBtn.disabled = true;
    });

    dealBtn.addEventListener('click', dealHand);

    function dealHand() {
      visibleCards = [];
      playerCount = 0;
      updateCountDisplay();

      // Deal: dealer back + upcard; player 2 cards
      const dealerUp = draw(1)[0];
      const p1 = draw(1)[0];
      const p2 = draw(1)[0];

      visibleCards = [dealerUp, p1, p2]; // hole card hidden — not counted
      const delta = visibleCards.reduce((s, c) => s + c.value, 0);
      runningCount += delta;

      // Render dealer
      dealerCards.innerHTML = '';
      const backEl = cardBackEl();
      backEl.classList.add('dealing');
      dealerCards.appendChild(backEl);
      const upEl = cardEl(dealerUp);
      upEl.style.animationDelay = '80ms';
      upEl.classList.add('dealing');
      dealerCards.appendChild(upEl);

      // Render player (overlapping)
      playerCards.innerHTML = '';
      [p1, p2].forEach((c, i) => {
        const el = cardEl(c);
        el.style.animationDelay = (160 + i * 100) + 'ms';
        el.classList.add('dealing');
        playerCards.appendChild(el);
      });

      // Determine correct BS play
      correctPlay = calcCorrectPlay([p1, p2], dealerUp);

      // Build play buttons
      actionsEl.innerHTML = '';
      const isPair = p1.rank === p2.rank;
      (isPair ? ['H','S','D','P'] : ['H','S','D']).forEach(a => {
        const b = document.createElement('button');
        b.className = 'sk-action-btn';
        b.textContent = ACTION_LABELS[a];
        b.dataset.action = a;
        b.addEventListener('click', () => choosePlay(a));
        actionsEl.appendChild(b);
      });

      showPhase('play');
    }

    function calcCorrectPlay(pCards, dCard) {
      const pTotal = pCards.reduce((s, c) => {
        const v = c.rank==='A' ? 11 : (c.rank==='10'||c.rank==='J'||c.rank==='Q'||c.rank==='K') ? 10 : parseInt(c.rank)||10;
        return s + v;
      }, 0);
      const isAce = pCards.some(c => c.rank === 'A');
      const isPair = pCards[0].rank === pCards[1].rank;
      const dLabel = (dCard.rank==='10'||dCard.rank==='J'||dCard.rank==='Q'||dCard.rank==='K') ? '10' : dCard.rank;
      const dI = Math.max(0, DEALER_LABELS.indexOf(dLabel));
      if (isPair) {
        const r = pCards[0].rank;
        const key = (r==='10'||r==='J'||r==='Q'||r==='K') ? 'TT' : (r+r);
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

    function choosePlay(action) {
      playWasCorrect = (action === correctPlay);
      actionsEl.querySelectorAll('.sk-action-btn').forEach(b => {
        b.disabled = true;
        if (b.dataset.action === correctPlay) b.classList.add('correct');
        if (b.dataset.action === action && !playWasCorrect) b.classList.add('wrong');
      });
      showPhase('count');
    }

    function submitCount() {
      if (phase !== 'count') return;
      const countIsCorrect = playerCount === runningCount;
      const bothCorrect = playWasCorrect && countIsCorrect;

      // Update streak
      if (bothCorrect) { streak++; } else { streak = 0; }
      streakEl.textContent = streak;
      fireEl.style.opacity = streak >= 3 ? '1' : '0';

      // Update bankroll
      if (playWasCorrect) { bankroll += currentBet; }
      else                { bankroll -= currentBet; }
      if (bankroll < 0) bankroll = 0;
      updateBankrollDisplay();

      // Build result row
      const rcStr = runningCount >= 0 ? `+${runningCount}` : String(runningCount);
      const guessStr = playerCount >= 0 ? `+${playerCount}` : String(playerCount);
      const betChange = playWasCorrect ? `+$${fmtMoney(currentBet)}` : `-$${fmtMoney(currentBet)}`;
      const betColor  = playWasCorrect ? '#4ade80' : '#f87171';
      resultRow.innerHTML = `
        <div class="ft-result-item ${playWasCorrect?'ft-result-good':'ft-result-bad'}">
          <span class="ft-result-icon">${playWasCorrect?'✓':'✗'}</span>
          <span>${playWasCorrect ? 'Correct play' : `Should ${ACTION_LABELS[correctPlay]}`}</span>
        </div>
        <div class="ft-result-item ${countIsCorrect?'ft-result-good':'ft-result-bad'}">
          <span class="ft-result-icon">${countIsCorrect?'✓':'✗'}</span>
          <span>${countIsCorrect ? `Count ${rcStr}` : `Count: ${rcStr}, you said ${guessStr}`}</span>
        </div>
        <div class="ft-result-bet" style="color:${betColor}">${betChange}</div>
      `;

      Account.addResult(skillId, bothCorrect);
      if (streak >= 5) AppState.skillStatus[skillId].done = true;
      markScore(scoreEl, streak, 0);
      window.dispatchEvent(new CustomEvent('colin:event', { detail: {
        event: 'trainer_answer',
        payload: {
          skillId: 'full-training',
          isCorrect: bothCorrect,
          playWasCorrect,
          countWasCorrect: countIsCorrect,
          correctPlay,
          chosenPlay: playWasCorrect ? correctPlay : (actionsEl.querySelector('.wrong') ? actionsEl.querySelector('.wrong').dataset.action : '?'),
          runningCount,
          playerCount,
          streak,
          bankroll
        }
      }}));

      currentBet = 0;
      showPhase('feedback');
    }

    nextBtn.addEventListener('click', () => {
      betAmountEl.textContent = '0';
      dealBtn.disabled = true;
      dealerCards.innerHTML = '';
      playerCards.innerHTML = '';
      showPhase('bet');
    });

    body.querySelector('#ft-minus').addEventListener('click', () => { if(phase==='count'){playerCount--;updateCountDisplay();} });
    body.querySelector('#ft-plus').addEventListener('click',  () => { if(phase==='count'){playerCount++;updateCountDisplay();} });
    body.querySelector('#ft-count-submit').addEventListener('click', submitCount);
    function ftKey(e) { if (phase === 'count' && e.key === 'Enter') submitCount(); }
    document.addEventListener('keydown', ftKey);

    showPhase('bet');
    return () => {
      if (trainerEl) trainerEl.classList.remove('ft-active');
      document.removeEventListener('keydown', ftKey);
    };
  }
};

// ============================================================
// LOADING SPINNER
// ============================================================
window.addEventListener('load', () => {
  const spinner = document.getElementById('page-spinner');
  if (spinner) spinner.classList.add('spinner-hidden');
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
  wrap.style.opacity = '';
  const ring = document.querySelector('.hero-card-ring');
  if (ring) {
    ring.getAnimations().forEach(a => a.cancel());
    ring.style.transform = '';
    ring.style.animation = '';
  }
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
        <div class="ace-flip-back"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const back = overlay.querySelector('.ace-flip-back');
  back.appendChild(tourSource);
  tourSource.classList.add('tour-page-active');
  tourSource.classList.remove('zoom-in', 'zoom-out');
  return overlay;
}

// Cinematic reveal: ring Ace → grow card → flip → pause → zoom to fullscreen.
// The real tour page DOM lives on the back of the card the whole time, so the
// final handoff to the tour stage is an invisible same-node restore.
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

    // Fixed "card viewing size" for the flip phase — big enough that the flip
    // rotation is clearly visible.
    const CARD_W = 340;
    const CARD_H = 476;

    const overlay = buildFlipOverlay(source);
    const bg = overlay.querySelector('.ace-flip-bg');
    const wrap = overlay.querySelector('.ace-flip-wrap');
    const inner = overlay.querySelector('.ace-flip-inner');

    // Start: wrap sized & positioned exactly over the Ace
    wrap.style.width = aceRect.width + 'px';
    wrap.style.height = aceRect.height + 'px';
    wrap.style.left = aceRect.left + 'px';
    wrap.style.top = aceRect.top + 'px';
    inner.style.transform = 'rotateY(0deg)';
    bg.style.opacity = '0';

    // Hide the real hero ring now that the overlay has replaced it
    ringWrap.style.opacity = '0';

    void wrap.offsetWidth;

    // PHASE A — Grow: shift from Ace rect to a centered card-size (550ms)
    const growCenterX = (vw - CARD_W) / 2;
    const growCenterY = (vh - CARD_H) / 2;
    wrap.style.transition = 'left 550ms cubic-bezier(.4,0,.2,1), top 550ms cubic-bezier(.4,0,.2,1), width 550ms cubic-bezier(.4,0,.2,1), height 550ms cubic-bezier(.4,0,.2,1)';
    bg.style.transition = 'opacity 550ms ease';
    requestAnimationFrame(() => {
      wrap.style.left = growCenterX + 'px';
      wrap.style.top = growCenterY + 'px';
      wrap.style.width = CARD_W + 'px';
      wrap.style.height = CARD_H + 'px';
      bg.style.opacity = '1';
    });

    setTimeout(() => {
      // PHASE B — Flip: rotY 0 → 90 → 180 at center-card size (850ms)
      // Three keyframes force the browser to interpolate explicitly along Y
      // instead of decomposing the 180° matrix into an ambiguous axis.
      const flipAnim = inner.animate(
        [
          { transform: 'rotateY(0deg)' },
          { transform: 'rotateY(90deg)' },
          { transform: 'rotateY(180deg)' }
        ],
        { duration: 850, fill: 'forwards', easing: 'cubic-bezier(.5,.1,.3,1)' }
      );
      flipAnim.onfinish = () => {
        // Bake the end state into inline style so nothing snaps back
        inner.style.transform = 'rotateY(180deg)';
        try { flipAnim.cancel(); } catch (e) { /* ignore */ }

        // PHASE C — Pause on flipped card
        setTimeout(() => {
          // PHASE D — Zoom the card frame out to fullscreen (850ms).
          // We morph the wrap's position/size, not transform — so the tour page
          // content inside reflows to viewport dimensions naturally.
          wrap.style.transition = 'left 850ms cubic-bezier(.3,0,.2,1), top 850ms cubic-bezier(.3,0,.2,1), width 850ms cubic-bezier(.3,0,.2,1), height 850ms cubic-bezier(.3,0,.2,1)';
          wrap.style.left = '0px';
          wrap.style.top = '0px';
          wrap.style.width = vw + 'px';
          wrap.style.height = vh + 'px';

          setTimeout(() => {
            // Restore tour page to its original slot — same DOM node, no flicker
            if (sourceNext) sourceParent.insertBefore(source, sourceNext);
            else sourceParent.appendChild(source);
            resolve(overlay);
          }, 870);
        }, 550);
      };
    }, 580);
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

// Entry point: "Learn More" clicked on landing
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
    if (stage) {
      stage.classList.remove('hidden');
      stage.classList.add('active');
    }
    updateSideArrows();
    return;
  }

  // Phase 1: fade hero body, pan ring to center
  if (hero) hero.classList.add('tour-pending');
  panHeroRingToCenter();

  // Phase 2: spin ring to Ace of Spades from current position
  if (ring) {
    spinRingToAce(ring).then(() => {
      // Ace is facing front — brief pause before the flip
      setTimeout(() => {
        // Phase 3: flip the Ace (with the real tour page on its back), pause, then
        // zoom it to fill the viewport. The overlay contains the real tour DOM which
        // is restored to #tour-pages when the zoom finishes — so the swap is invisible.
        // Pre-activate the tour stage (but hidden) so restored DOM lands in the right place.
        tourIndex = 0;
        if (stage) {
          stage.classList.remove('hidden');
          stage.classList.add('active');
          stage.style.opacity = '0';
        }
        showTourPage(0);

        flipAceIntoContent().then((overlay) => {
          if (landing) landing.classList.add('hidden');
          const activeEl = document.getElementById(TOUR_PAGE_IDS[0]);
          if (activeEl) activeEl.classList.remove('zoom-in', 'zoom-out');
          if (hero) hero.classList.remove('tour-pending');
          resetHeroRing();

          // Reveal the real stage under the overlay, then remove the overlay
          if (stage) stage.style.opacity = '';
          if (overlay) overlay.remove();
        });
      }, 450);
    });
  }
}

// ── Tour transition ring (between chapters) ──
function playTourRingTransition(onMid, onDone) {
  const wrap = document.getElementById('tour-ring-wrap');
  const ring = document.getElementById('tour-ring');
  if (!wrap || !ring) { onMid && onMid(); onDone && onDone(); return; }

  // Reset any prior state
  wrap.classList.remove('hidden', 'enter', 'zoom-through');
  ring.classList.remove('fast-spin');
  void wrap.offsetWidth;

  // Phase A: ring fades in at center
  wrap.classList.add('enter');
  setTimeout(() => {
    // Phase B: slow spin
    ring.classList.add('fast-spin');
  }, 400);

  // Mid-point: swap page content (at ~halfway through spin)
  setTimeout(() => { if (onMid) onMid(); }, 1400);

  // Phase C: ring zooms through (after spin completes)
  setTimeout(() => {
    wrap.classList.add('zoom-through');
  }, 2300);

  // Phase D: cleanup
  setTimeout(() => {
    wrap.classList.add('hidden');
    wrap.classList.remove('enter', 'zoom-through');
    ring.classList.remove('fast-spin');
    if (onDone) onDone();
  }, 3200);
}

// Navigate to a different chapter: zoom out of current → flip → zoom into new.
// Uses the same flip-overlay as the reveal, but starts from fullscreen and the
// card back swaps its content during the flip's edge-on moment.
function goTourCard(nextIndex /*, direction */) {
  if (tourAnimating) return;
  if (nextIndex < 0 || nextIndex >= TOUR_PAGE_IDS.length) return;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tourIndex = nextIndex;
    showTourPage(nextIndex);
    return;
  }

  const currentId = TOUR_PAGE_IDS[tourIndex];
  const nextId = TOUR_PAGE_IDS[nextIndex];
  const currentSource = document.getElementById(currentId);
  const nextSource = document.getElementById(nextId);
  const stage = document.getElementById('tour-stage');
  if (!currentSource || !nextSource || !stage) return;

  tourAnimating = true;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const CARD_W = 340;
  const CARD_H = 476;
  const centerX = (vw - CARD_W) / 2;
  const centerY = (vh - CARD_H) / 2;

  // Remember source positions so we can restore them
  const curParent = currentSource.parentNode;
  const curNext = currentSource.nextSibling;
  const nxtParent = nextSource.parentNode;
  const nxtNext = nextSource.nextSibling;

  const overlay = buildFlipOverlay(currentSource);
  const bg = overlay.querySelector('.ace-flip-bg');
  const wrap = overlay.querySelector('.ace-flip-wrap');
  const inner = overlay.querySelector('.ace-flip-inner');

  // Start: current page fills the viewport (same as tour-stage), back-facing
  wrap.style.left = '0px';
  wrap.style.top = '0px';
  wrap.style.width = vw + 'px';
  wrap.style.height = vh + 'px';
  inner.style.transform = 'rotateY(180deg)';
  bg.style.opacity = '1';
  stage.style.opacity = '0';

  void wrap.offsetWidth;

  // PHASE A — Zoom out: fullscreen → centered card (550ms), rotY locked at 180
  wrap.style.transition = 'left 550ms cubic-bezier(.4,0,.2,1), top 550ms cubic-bezier(.4,0,.2,1), width 550ms cubic-bezier(.4,0,.2,1), height 550ms cubic-bezier(.4,0,.2,1)';
  requestAnimationFrame(() => {
    wrap.style.left = centerX + 'px';
    wrap.style.top = centerY + 'px';
    wrap.style.width = CARD_W + 'px';
    wrap.style.height = CARD_H + 'px';
  });

  setTimeout(() => {
    // PHASE B — Flip: rotY 180 → 360 (visually the front appears, then rotates
    // back around to 540 = back facing us again). Swap the back content at
    // rotY=360 (back hidden, front facing) — the user only ever sees the
    // front face during the content swap.
    const flip = inner.animate(
      [
        { transform: 'rotateY(180deg)' },
        { transform: 'rotateY(270deg)' },
        { transform: 'rotateY(360deg)' },
        { transform: 'rotateY(450deg)' },
        { transform: 'rotateY(540deg)' }
      ],
      { duration: 1100, fill: 'forwards', easing: 'cubic-bezier(.35,.05,.25,1)' }
    );

    // Swap back content at ~40% through (rotY ≈ 324°, back is hidden, front shows)
    setTimeout(() => {
      const back = overlay.querySelector('.ace-flip-back');
      if (back.contains(currentSource)) back.removeChild(currentSource);
      currentSource.classList.remove('tour-page-active');
      back.appendChild(nextSource);
      nextSource.classList.add('tour-page-active');
      nextSource.classList.remove('zoom-in', 'zoom-out');
    }, 440);

    flip.onfinish = () => {
      inner.style.transform = 'rotateY(540deg)';
      try { flip.cancel(); } catch (e) { /* ignore */ }

      // PHASE C — brief pause on the new back
      setTimeout(() => {
        // PHASE D — zoom the card back out to fullscreen
        wrap.style.transition = 'left 750ms cubic-bezier(.3,0,.2,1), top 750ms cubic-bezier(.3,0,.2,1), width 750ms cubic-bezier(.3,0,.2,1), height 750ms cubic-bezier(.3,0,.2,1)';
        wrap.style.left = '0px';
        wrap.style.top = '0px';
        wrap.style.width = vw + 'px';
        wrap.style.height = vh + 'px';

        setTimeout(() => {
          // Restore both pages to their original DOM positions
          tourIndex = nextIndex;
          const back = overlay.querySelector('.ace-flip-back');
          if (back.contains(nextSource)) back.removeChild(nextSource);
          if (curNext) curParent.insertBefore(currentSource, curNext);
          else curParent.appendChild(currentSource);
          if (nxtNext) nxtParent.insertBefore(nextSource, nxtNext);
          else nxtParent.appendChild(nextSource);

          showTourPage(nextIndex);
          stage.style.opacity = '';
          overlay.remove();
          tourAnimating = false;
        }, 770);
      }, 400);
    };
  }, 580);
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

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.classList.add('hidden');
    stage.classList.remove('active');
    if (landing) landing.classList.remove('hidden');
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
    if (landing) landing.classList.remove('hidden');
    resetHeroRing();
    updateSideArrows();
  }, 400);
}

// "Start Training" — fast-path straight to the pipeline (skips the tour).
// Used by the top-right nav button for returning users who already know the app.
function startTraining() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    goPipeline();
    return;
  }
  const landing = document.getElementById('landing');
  if (!landing) { goPipeline(); return; }
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
if (dashBack) dashBack.addEventListener('click', goLanding);

// Clickable brand logos — always go home (landing)
['nav-brand-home', 'pipe-brand-home'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', (e) => {
    e.preventDefault();
    goLanding();
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
