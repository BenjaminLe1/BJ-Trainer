(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────
  const COLIN_API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001/colin'
    : '/colin';

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
      <!-- Suit jacket + white shirt + tie -->
      <path d="M8 64 Q8 52 18 48 L24 46 L32 52 L40 46 L46 48 Q56 52 56 64Z" fill="#1a1a2e"/>
      <path d="M24 46 L28 54 L32 50 L36 54 L40 46 L32 52Z" fill="#f0ece0"/>
      <!-- Tie -->
      <path d="M30 50 L32 58 L34 50 L32 47Z" fill="#8b1a1a"/>
      <!-- Neck -->
      <rect x="28" y="43" width="8" height="6" rx="2" fill="#d4956a"/>
      <!-- Head — sharper jaw -->
      <path d="M17 28 C17 14 47 14 47 28 C47 38 42 46 32 46 C22 46 17 38 17 28Z" fill="#d4956a"/>
      <!-- Slick hair — swept back -->
      <path d="M16 26 C15 10 49 10 48 26 C46 14 40 8 32 8 C24 8 18 14 16 26Z" fill="#0d0d0d"/>
      <path d="M16 26 C17 18 22 12 30 10 Q24 14 22 22Z" fill="#1a1a1a"/>
      <!-- Hair shine -->
      <path d="M22 13 Q28 10 34 11" stroke="#2a2a2a" stroke-width="1.5" stroke-linecap="round" fill="none"/>
      <!-- Ears -->
      <ellipse cx="17" cy="30" rx="2.2" ry="3" fill="#c4855a"/>
      <ellipse cx="47" cy="30" rx="2.2" ry="3" fill="#c4855a"/>
      <!-- Sharp eyebrows -->
      <path d="M20 23 L28 21" stroke="#0d0d0d" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M36 21 L44 23" stroke="#0d0d0d" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <!-- Sunglasses frame -->
      <rect x="19" y="25" width="10" height="7" rx="3" fill="#0d0d0d"/>
      <rect x="35" y="25" width="10" height="7" rx="3" fill="#0d0d0d"/>
      <line x1="29" y1="28" x2="35" y2="28" stroke="#0d0d0d" stroke-width="1.8"/>
      <line x1="19" y1="28" x2="17" y2="27" stroke="#0d0d0d" stroke-width="1.5"/>
      <line x1="45" y1="28" x2="47" y2="27" stroke="#0d0d0d" stroke-width="1.5"/>
      <!-- Lens shine -->
      <path d="M21 26.5 Q23 26 24 27" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-linecap="round" fill="none"/>
      <path d="M37 26.5 Q39 26 40 27" stroke="rgba(255,255,255,0.25)" stroke-width="1" stroke-linecap="round" fill="none"/>
      <!-- Nose -->
      <path d="M30.5 34 Q32 36.5 33.5 34" stroke="#b06040" stroke-width="1.3" stroke-linecap="round" fill="none"/>
      <!-- Smirk -->
      <path d="M26 40 Q30 43 36 41" stroke="#8a4a28" stroke-width="1.8" stroke-linecap="round" fill="none"/>
      <!-- Jaw definition -->
      <path d="M20 36 Q18 40 20 44" stroke="#c07850" stroke-width="0.8" stroke-linecap="round" opacity="0.4" fill="none"/>
      <path d="M44 36 Q46 40 44 44" stroke="#c07850" stroke-width="0.8" stroke-linecap="round" opacity="0.4" fill="none"/>
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
