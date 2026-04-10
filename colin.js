(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  const COLIN_API = 'http://localhost:3001/colin';

  // ── Session identity ──────────────────────────────────────────
  let sessionId = sessionStorage.getItem('colin_session');
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
    sessionStorage.setItem('colin_session', sessionId);
  }

  // ── State ─────────────────────────────────────────────────────
  let isPanelOpen = false;
  let isAwaitingResponse = false;
  let answersSinceLastMessage = 0;
  let hasGreetedThisLoad = false; // reset on every page load, not per session
  const ANSWERS_THROTTLE = 5; // fire Colin every N correct answers

  // ── Colin face SVG ────────────────────────────────────────────
  function colinFaceSVG(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Neck + shoulders -->
      <path d="M20 52 Q20 58 32 58 Q44 58 44 52 L42 44 Q37 47 32 47 Q27 47 22 44Z" fill="#e8b48a"/>
      <!-- Head -->
      <ellipse cx="32" cy="30" rx="16" ry="18" fill="#f0c090"/>
      <!-- Hair — flat dark cap, clean shape -->
      <path d="M16 28 C16 14 48 14 48 28 C46 18 38 11 32 11 C26 11 18 18 16 28Z" fill="#2c2420"/>
      <!-- Side burns -->
      <rect x="16" y="26" width="3" height="7" rx="1.5" fill="#2c2420"/>
      <rect x="45" y="26" width="3" height="7" rx="1.5" fill="#2c2420"/>
      <!-- Ears -->
      <ellipse cx="16" cy="32" rx="3" ry="4" fill="#e0a070"/>
      <ellipse cx="48" cy="32" rx="3" ry="4" fill="#e0a070"/>
      <!-- Eyebrows — thick, slight arch -->
      <path d="M21 23 Q25 21 29 23" stroke="#2c2420" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M35 23 Q39 21 43 23" stroke="#2c2420" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <!-- Eyes — simple circles, friendly -->
      <circle cx="25" cy="29" r="4" fill="#fff"/>
      <circle cx="39" cy="29" r="4" fill="#fff"/>
      <circle cx="25.5" cy="29.5" r="2.5" fill="#3a2a18"/>
      <circle cx="39.5" cy="29.5" r="2.5" fill="#3a2a18"/>
      <circle cx="26.2" cy="28.4" r="0.8" fill="#fff"/>
      <circle cx="40.2" cy="28.4" r="0.8" fill="#fff"/>
      <!-- Nose — small button -->
      <ellipse cx="32" cy="35" rx="2" ry="1.2" fill="#d4956a" opacity="0.7"/>
      <!-- Smile — friendly curved line -->
      <path d="M25 42 Q32 47 39 42" stroke="#c07040" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Light stubble suggestion — just two short strokes -->
      <path d="M22 40 Q24 41 23 43" stroke="#c08860" stroke-width="1" stroke-linecap="round" opacity="0.4" fill="none"/>
      <path d="M42 40 Q40 41 41 43" stroke="#c08860" stroke-width="1" stroke-linecap="round" opacity="0.4" fill="none"/>
    </svg>`;
  }

  // ── Widget HTML ───────────────────────────────────────────────
  function injectWidget() {
    const widget = document.createElement('div');
    widget.id = 'colin-widget';
    widget.className = 'colin-hidden';
    widget.innerHTML = `
      <button id="colin-bubble" aria-label="Chat with Colin">
        <span class="colin-bubble-avatar">${colinFaceSVG(64)}</span>
        <span class="colin-bubble-badge hidden" id="colin-unread">1</span>
      </button>
      <div id="colin-panel" class="colin-panel-closed">
        <div class="colin-panel-header">
          <div class="colin-header-left">
            <div class="colin-header-avatar">${colinFaceSVG(22)}</div>
            <div>
              <div class="colin-header-name">Colin</div>
              <div class="colin-header-sub">AI Blackjack Coach</div>
            </div>
          </div>
          <button class="colin-close-btn" id="colin-close">✕</button>
        </div>
        <div class="colin-messages" id="colin-messages"></div>
        <div class="colin-input-row">
          <input type="text" class="colin-input" id="colin-input" placeholder="Ask Colin..." autocomplete="off">
          <button class="colin-send-btn" id="colin-send">→</button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);

    document.getElementById('colin-bubble').addEventListener('click', togglePanel);
    document.getElementById('colin-close').addEventListener('click', closePanel);
    document.getElementById('colin-send').addEventListener('click', handleUserSend);
    document.getElementById('colin-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') handleUserSend();
    });
  }

  // ── Panel open/close ──────────────────────────────────────────
  function togglePanel() {
    isPanelOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    isPanelOpen = true;
    const panel = document.getElementById('colin-panel');
    if (panel) panel.classList.remove('colin-panel-closed');
    clearUnread();
    scrollMessages();
  }

  function closePanel() {
    isPanelOpen = false;
    const panel = document.getElementById('colin-panel');
    if (panel) panel.classList.add('colin-panel-closed');
  }

  // ── Unread badge ──────────────────────────────────────────────
  function incrementUnread() {
    if (isPanelOpen) return;
    const badge = document.getElementById('colin-unread');
    if (!badge) return;
    const current = parseInt(badge.textContent) || 0;
    badge.textContent = current + 1;
    badge.classList.remove('hidden');
  }

  function clearUnread() {
    const badge = document.getElementById('colin-unread');
    if (badge) { badge.textContent = '1'; badge.classList.add('hidden'); }
  }

  // ── Message rendering ─────────────────────────────────────────
  function appendMessage(text, role) {
    const messages = document.getElementById('colin-messages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = `colin-msg colin-msg-${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'colin-msg-text';
    bubble.textContent = text;
    msg.appendChild(bubble);
    messages.appendChild(msg);
    scrollMessages();
  }

  function appendActionChip(action) {
    const messages = document.getElementById('colin-messages');
    if (!messages || !action || action.type !== 'redirect') return;

    const LABELS = {
      'pipeline':       'Back to Pipeline',
      'dashboard':      'View Dashboard',
      'basic-strategy': 'Train Basic Strategy',
      'keep-counting':  'Train Running Count',
      'deviations':     'Train Deviations',
      'true-count':     'Train True Count',
      'bet-spread':     'Configure Bet Spread',
      'full-training':  'Full Training Session',
    };

    const chip = document.createElement('div');
    chip.className = 'colin-action-chip';
    chip.textContent = '→ ' + (LABELS[action.target] || action.target);
    chip.dataset.target = action.target;
    chip.addEventListener('click', () => handleRedirect(action.target));
    messages.appendChild(chip);
    scrollMessages();
  }

  function showTyping() {
    const messages = document.getElementById('colin-messages');
    if (!messages || document.getElementById('colin-typing-indicator')) return;
    const indicator = document.createElement('div');
    indicator.id = 'colin-typing-indicator';
    indicator.className = 'colin-msg colin-msg-colin';
    indicator.innerHTML = `<div class="colin-typing-dots"><span></span><span></span><span></span></div>`;
    messages.appendChild(indicator);
    scrollMessages();
  }

  function hideTyping() {
    const el = document.getElementById('colin-typing-indicator');
    if (el) el.remove();
  }

  function scrollMessages() {
    const messages = document.getElementById('colin-messages');
    if (messages) setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 50);
  }

  // ── Server call ───────────────────────────────────────────────
  async function sendToServer(event, payload, userMessage = null) {
    if (isAwaitingResponse) return;
    isAwaitingResponse = true;
    showTyping();

    try {
      const res = await fetch(COLIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, event, payload, message: userMessage })
      });

      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();

      hideTyping();
      appendMessage(data.reply, 'colin');
      if (data.action) appendActionChip(data.action);

      if (!isPanelOpen) incrementUnread();
    } catch (e) {
      hideTyping();
      // Colin is non-critical — fail silently
    }

    isAwaitingResponse = false;
  }

  // ── User input send ───────────────────────────────────────────
  function handleUserSend() {
    const input = document.getElementById('colin-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMessage(text, 'user');
    sendToServer('user_message', {}, text);
  }

  // ── Redirect handler ──────────────────────────────────────────
  function handleRedirect(target) {
    const REDIRECT_MAP = {
      'pipeline':       () => typeof window.goPipeline === 'function' && window.goPipeline(),
      'dashboard':      () => typeof window.goDashboard === 'function' && window.goDashboard(),
      'basic-strategy': () => typeof window.goSkill === 'function' && window.goSkill('basic-strategy'),
      'keep-counting':  () => typeof window.goSkill === 'function' && window.goSkill('keep-counting'),
      'deviations':     () => typeof window.goSkill === 'function' && window.goSkill('deviations'),
      'true-count':     () => typeof window.goSkill === 'function' && window.goSkill('true-count'),
      'bet-spread':     () => typeof window.goSkill === 'function' && window.goSkill('bet-spread'),
      'full-training':  () => typeof window.goSkill === 'function' && window.goSkill('full-training'),
    };
    const fn = REDIRECT_MAP[target];
    if (fn) { closePanel(); fn(); }
  }

  // ── View visibility sync ──────────────────────────────────────
  const COLIN_ACTIVE_VIEWS = ['pipeline', 'skill-trainer', 'dashboard'];

  function syncWidgetVisibility() {
    const widget = document.getElementById('colin-widget');
    if (!widget) return;
    const isActive = COLIN_ACTIVE_VIEWS.some(viewId => {
      const el = document.getElementById(viewId);
      return el && !el.classList.contains('hidden') && el.style.display !== 'none';
    });
    if (isActive) widget.classList.remove('colin-hidden');
    else widget.classList.add('colin-hidden');
  }

  // ── Colin event listener ──────────────────────────────────────
  window.addEventListener('colin:event', (e) => {
    const { event, payload } = e.detail;

    // Always sync visibility on any event
    setTimeout(syncWidgetVisibility, 50);

    if (event === 'view_change' && payload.view === 'pipeline') {
      // Greet once per page load — refresh resets this, so Colin always says hi
      // to a fresh visitor but doesn't nag if they bounce between views.
      if (!hasGreetedThisLoad) {
        hasGreetedThisLoad = true;
        setTimeout(() => {
          openPanel();
          sendToServer(event, payload);
        }, 1600); // slightly after the 900ms table entrance settles
      }
      return;
    }

    if (event === 'dashboard_load') {
      setTimeout(() => {
        openPanel();
        sendToServer(event, payload);
      }, 700);
      return;
    }

    if (event === 'trainer_enter') {
      sendToServer(event, payload);
      return;
    }

    if (event === 'trainer_answer') {
      openPanel();
      sendToServer(event, payload);
      return;
    }
  });

  // ── Init ──────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectWidget();
    syncWidgetVisibility();

    // Re-sync when landing nav buttons are clicked (they call showView)
    // Use a MutationObserver to detect view switches
    const observer = new MutationObserver(() => syncWidgetVisibility());
    COLIN_ACTIVE_VIEWS.concat(['landing']).forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
    });
  }

})();
