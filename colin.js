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
  // feedbackToastTimer removed — bubbles now persist until next answer

  // ── Colin face SVG ────────────────────────────────────────────
  function colinFaceSVG(size) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Shoulders -->
      <path d="M10 64 Q10 54 20 51 Q26 49 32 49 Q38 49 44 51 Q54 54 54 64Z" fill="#3a5a8a"/>
      <!-- Neck -->
      <rect x="27" y="44" width="10" height="8" rx="3" fill="#e8b080"/>
      <!-- Head -->
      <ellipse cx="32" cy="29" rx="15" ry="17" fill="#f2c188"/>
      <!-- Hair — short clean cut with side part -->
      <path d="M17 26 C17 12 47 12 47 26 C45 15 38 9 32 9 C26 9 19 15 17 26Z" fill="#1a1208"/>
      <path d="M17 22 C18 16 24 11 32 11 C32 11 28 14 27 20Z" fill="#2a1e10"/>
      <!-- Ears -->
      <ellipse cx="17" cy="30" rx="2.5" ry="3.5" fill="#dda060"/>
      <ellipse cx="47" cy="30" rx="2.5" ry="3.5" fill="#dda060"/>
      <!-- Eyebrows — clean, slightly tapered -->
      <path d="M21 22 Q25 20 28 21.5" stroke="#1a1208" stroke-width="2" stroke-linecap="round" fill="none"/>
      <path d="M36 21.5 Q39 20 43 22" stroke="#1a1208" stroke-width="2" stroke-linecap="round" fill="none"/>
      <!-- Eyes -->
      <ellipse cx="25" cy="28" rx="3.8" ry="3.2" fill="#fff"/>
      <ellipse cx="39" cy="28" rx="3.8" ry="3.2" fill="#fff"/>
      <circle cx="25.5" cy="28.5" r="2.2" fill="#2e1a0a"/>
      <circle cx="39.5" cy="28.5" r="2.2" fill="#2e1a0a"/>
      <circle cx="26.2" cy="27.6" r="0.7" fill="#fff"/>
      <circle cx="40.2" cy="27.6" r="0.7" fill="#fff"/>
      <!-- Nose -->
      <path d="M30 33 Q32 36 34 33" stroke="#c4845a" stroke-width="1.4" stroke-linecap="round" fill="none"/>
      <!-- Mouth — confident smile -->
      <path d="M25 39 Q32 44 39 39" stroke="#b06030" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <path d="M25 39 Q25.5 40.5 26.5 40.5" stroke="#b06030" stroke-width="1.2" stroke-linecap="round" fill="none"/>
      <path d="M39 39 Q38.5 40.5 37.5 40.5" stroke="#b06030" stroke-width="1.2" stroke-linecap="round" fill="none"/>
    </svg>`;
  }

  // ── Widget HTML ───────────────────────────────────────────────
  function injectWidget() {
    const widget = document.createElement('div');
    widget.id = 'colin-widget';
    widget.className = 'colin-hidden';
    widget.innerHTML = `
      <div id="colin-feedback-toast" class="colin-feedback-toast colin-toast-hidden" aria-live="polite"></div>
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

    // Close panel when clicking outside the widget
    document.addEventListener('click', e => {
      if (isPanelOpen && !document.getElementById('colin-widget').contains(e.target)) {
        closePanel();
      }
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
    const widget = document.getElementById('colin-widget');
    if (widget) widget.classList.add('colin-panel-is-open');
    clearUnread();
    scrollMessages();
  }

  function closePanel() {
    isPanelOpen = false;
    const panel = document.getElementById('colin-panel');
    if (panel) panel.classList.add('colin-panel-closed');
    const widget = document.getElementById('colin-widget');
    if (widget) widget.classList.remove('colin-panel-is-open');
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

  // ── Feedback toast (inline verdict, no panel needed) ─────────
  function showFeedbackToast(text) {
    const toast = document.getElementById('colin-feedback-toast');
    if (!toast) return;
    // Detect correct vs wrong for styling
    const isWrong = /^wrong/i.test(text.trim());
    toast.className = 'colin-feedback-toast' + (isWrong ? ' colin-toast-wrong' : ' colin-toast-correct');
    toast.textContent = text;
    // No auto-hide — bubble stays until the next answer replaces it
  }

  function hideFeedbackToast() {
    const toast = document.getElementById('colin-feedback-toast');
    if (toast) toast.classList.add('colin-toast-hidden');
  }

  // ── Server call ───────────────────────────────────────────────
  // showAsToast: true  → feedback appears inline (drill answers)
  //             false → append to chat panel (greetings, manual questions)
  async function sendToServer(event, payload, userMessage = null, showAsToast = false) {
    if (isAwaitingResponse) return;
    isAwaitingResponse = true;
    if (!showAsToast) showTyping();

    try {
      const res = await fetch(COLIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, event, payload, message: userMessage })
      });

      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();

      hideTyping();

      if (showAsToast) {
        // Show verdict inline on screen; also save to chat history silently
        showFeedbackToast(data.reply);
        appendMessage(data.reply, 'colin'); // keeps history for when panel is opened
        if (data.action) appendActionChip(data.action);
        // Show unread badge so user knows there's a message waiting in the panel
        if (!isPanelOpen) incrementUnread();
      } else {
        appendMessage(data.reply, 'colin');
        if (data.action) appendActionChip(data.action);
        if (!isPanelOpen) incrementUnread();
      }
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

  // ── View visibility + position sync ──────────────────────────
  const COLIN_ACTIVE_VIEWS = ['pipeline', 'skill-trainer', 'dashboard'];

  function isViewVisible(id) {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden') && el.style.display !== 'none';
  }

  function syncWidgetVisibility() {
    const widget = document.getElementById('colin-widget');
    if (!widget) return;
    const isActive = COLIN_ACTIVE_VIEWS.some(isViewVisible);
    if (isActive) widget.classList.remove('colin-hidden');
    else widget.classList.add('colin-hidden');
    syncWidgetPosition();
  }

  // Trainer mode: icon moves to top-left with speech bubble layout.
  // Lobby mode (pipeline/dashboard): icon stays bottom-right with chat panel.
  function syncWidgetPosition() {
    const widget = document.getElementById('colin-widget');
    if (!widget) return;

    const goTrainer = isViewVisible('skill-trainer');
    const isTrainer  = widget.classList.contains('colin-trainer-mode');
    if (goTrainer === isTrainer) return; // already correct, nothing to do

    // ── FLIP animation: bottom-right ↔ top-left ──────────────────
    // Capture where the widget is RIGHT NOW (before any class change).
    const first = widget.getBoundingClientRect();

    // Apply the class — layout changes instantly (no visual effect yet because
    // we'll invert it with a transform in the next step).
    if (goTrainer) widget.classList.add('colin-trainer-mode');
    else           widget.classList.remove('colin-trainer-mode');

    // Force reflow so the browser computes the new layout before we read it.
    void widget.offsetWidth;

    // Capture the destination rect (where CSS wants the widget after the change).
    const last = widget.getBoundingClientRect();

    // Invert: shift by the difference so the widget appears at its OLD position.
    const dx = first.left - last.left;
    const dy = first.top  - last.top;
    widget.style.transition = 'none';
    widget.style.transform  = `translate(${dx}px, ${dy}px)`;

    // Force reflow so the browser commits the inverted position.
    void widget.offsetWidth;

    // Play: clear the offset and let the transition carry it to translate(0,0).
    widget.style.transition = 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)';
    widget.style.transform  = '';

    // Clean up inline styles once animation is done.
    setTimeout(() => {
      widget.style.transition = '';
      widget.style.transform  = '';
    }, 720);
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
          sendToServer(event, payload, null, true);
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
      closePanel(); // always close chat panel when entering a trainer
      hideFeedbackToast();
      sendToServer(event, payload, null, true /* showAsToast = speech bubble */);
      return;
    }

    if (event === 'trainer_answer') {
      hideFeedbackToast(); // clear previous so the new verdict feels fresh
      sendToServer(event, payload, null, true /* showAsToast */);
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
