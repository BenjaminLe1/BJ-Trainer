const Anthropic = require('@anthropic-ai/sdk');
const { readFileSync } = require('fs');
const { join } = require('path');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SYSTEM_PROMPT = readFileSync(join(process.cwd(), 'agent/colin-guidelines.md'), 'utf-8');

// In-memory sessions (per warm instance — acceptable for MVP)
const sessions = new Map();

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { messages: [], lastActive: Date.now() });
  const s = sessions.get(id);
  s.lastActive = Date.now();
  return s;
}

const FOCUS = {
  'basic-strategy': ['','hard totals only — focus on when to hit vs stand','hard and soft hands — watch the ace','all hand types — pairs are the new challenge','all hands, prioritize edge cases like 12-16 vs dealer 4-6','full range — razor-sharp on every cell of the chart'],
  'keep-counting':  ['','one card at a time — build the habit','two cards — start tracking the delta','three cards with a countdown — stay calm under pressure','four cards, 6 seconds — maintain pace and accuracy','five cards, 4 seconds — casino speed'],
  'deviations':     ['','the two most important: 16 vs 10 and 15 vs 10','top 7 deviations — the ones that matter most','top 9 — you know the basics, now drill the doubles','top 11 — the full Illustrious 18 is close','all 13 — every deviation, every count threshold'],
  'true-count':     ['','small RC, whole-number decks — nail the formula first','slightly wider range — watch for the half-deck values','mid-range RC and decks — round to nearest 0.5 precisely','wide range — speed and accuracy together','full casino range — fast and exact'],
  'full-training':  ['','play correct, count correct — one rep at a time','two skills together — play first, then confirm the count','bet sizing matters now — use the true count','stay sharp on both simultaneously','casino-speed full simulation'],
};

function buildUserMessage(event, payload, userMessage) {
  if (userMessage) return userMessage;

  if (event === 'view_change' && payload.view === 'pipeline') {
    const statsStr = payload.stats
      ? Object.entries(payload.stats).map(([k, v]) => `${k}: ${v.total > 0 ? Math.round((v.correct / v.total) * 100) : 'untrained'}%`).join(', ')
      : 'no stats yet (new user)';
    const isNew = !payload.stats || Object.values(payload.stats).every(v => v.total === 0);
    if (isNew) return `New user just arrived at the pipeline. Greet them per the guidelines (new user flow).`;
    return `Returning user "${payload.user || 'Guest'}" is back. Sessions: ${payload.sessions || 0}. Stats: ${statsStr}. Follow the returning user flow from the guidelines.`;
  }

  if (event === 'trainer_enter') {
    const s = payload.stats || { correct: 0, total: 0 };
    const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
    const statsStr = pct !== null ? `${s.correct}/${s.total} (${pct}%)` : 'no attempts yet';
    const lvl = payload.difficultyLevel || 1;
    const lvlName = payload.difficultyName || 'Beginner';
    const focusLine = (FOCUS[payload.skillId] || ['','','','','',''])[lvl] || '';
    return `User entered the ${payload.skillName} trainer at Level ${lvl}/5 (${lvlName}). Stats: ${statsStr}. Difficulty auto-set to ${lvlName}. One short sentence: energize them to start, mention the specific focus: "${focusLine}".`;
  }

  if (event === 'trainer_answer') {
    const { skillId, isCorrect } = payload;
    if (skillId === 'basic-strategy') {
      if (!isCorrect) return `Basic Strategy wrong. Hand: ${payload.handLabel} vs dealer ${payload.dealerLabel}. Chose: ${payload.chosen}. Correct: ${payload.correctAction}. Reply per guidelines.`;
      return `Basic Strategy correct. Reply per guidelines.`;
    }
    if (skillId === 'keep-counting') {
      if (!isCorrect) return `Running Count wrong. Submitted: ${payload.playerCount}. Correct: ${payload.correctCount}. Cards: ${payload.cardBreakdown ? payload.cardBreakdown.map(c => `${c.rank}(${c.value > 0 ? '+' : ''}${c.value})`).join(', ') : 'not provided'}. Reply per guidelines.`;
      return `Running Count correct. Reply per guidelines.`;
    }
    if (skillId === 'deviations') {
      if (!isCorrect) return `Deviations wrong. ${payload.hand} vs ${payload.upcard}, TC: ${payload.trueCount}. Chose: ${payload.chosen}. Correct: ${payload.correctAction} (${payload.shouldDeviate ? 'should deviate' : 'should NOT deviate'}). Reply per guidelines.`;
      return `Deviations correct. Reply per guidelines.`;
    }
    if (skillId === 'true-count') {
      if (!isCorrect) return `True Count wrong. Answered: ${payload.playerAnswer}. Correct: ${payload.correctAnswer}. Reply per guidelines.`;
      return `True Count correct. Reply per guidelines.`;
    }
    if (skillId === 'full-training') {
      const playStr  = payload.playWasCorrect  ? 'correct' : `WRONG (chose ${payload.chosenPlay}, correct ${payload.correctPlay})`;
      const countStr = payload.countWasCorrect ? 'correct' : `WRONG (submitted ${payload.playerCount}, correct ${payload.runningCount})`;
      if (!isCorrect) return `Full Training: play ${playStr}, count ${countStr}. Reply per guidelines.`;
      return `Full Training correct. Reply per guidelines.`;
    }
    if (!isCorrect) return `${skillId} wrong. Reply per guidelines.`;
    return `${skillId} correct. Reply per guidelines.`;
  }

  if (event === 'dashboard_load') {
    const weakStr   = payload.weaknesses?.length ? payload.weaknesses.join(', ') : 'none';
    const strongStr = payload.strengths?.length  ? payload.strengths.join(', ')  : 'none';
    return `User opened their Dashboard. Username: ${payload.user}. Sessions: ${payload.sessions}. Overall accuracy: ${payload.globalPct}%. Weak areas: ${weakStr}. Strengths: ${strongStr}. Reply per guidelines.`;
  }

  return 'Hello Colin.';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sessionId, event, payload = {}, message: userMessage = null } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getSession(sessionId);
  const humanText = buildUserMessage(event, payload, userMessage);
  session.messages.push({ role: 'user', content: humanText });
  if (session.messages.length > 20) session.messages = session.messages.slice(-20);

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: session.messages,
    });

    const raw = response.content[0].text;
    const actionMatch = raw.match(/\[ACTION:redirect:([a-z-]+)\]/);
    const action = actionMatch ? { type: 'redirect', target: actionMatch[1] } : null;
    const reply  = raw.replace(/\[ACTION:redirect:[a-z-]+\]/g, '').trim();
    session.messages.push({ role: 'assistant', content: raw });

    res.json({ reply, action });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: 'Failed to get response from Colin.' });
  }
};
