import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';

const app  = express();
const port = process.env.PORT || 3001;
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));

// ── Session store (in-memory) ──────────────────────────────────
const sessions = new Map(); // sessionId -> { messages: [], lastActive: number }

// Prune sessions inactive > 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.lastActive < cutoff) sessions.delete(id);
  }
}, 30 * 60 * 1000);

function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, { messages: [], lastActive: Date.now() });
  const s = sessions.get(id);
  s.lastActive = Date.now();
  return s;
}

// ── System prompt ──────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Colin, the AI coaching agent for a blackjack card counting training app called BJ Trainer.
You are concise, direct, and expert-level. Calm and encouraging — like a seasoned card counter who played professionally and now coaches.

The app has these trainers:
- basic-strategy: Drills for hit/stand/double/split decisions
- keep-counting: Hi-Lo running count tracking (2-6=+1, 7-9=0, 10-A=-1)
- deviations: Illustrious 18 count-based strategy deviations
- true-count: Converting running count to true count (RC / decks remaining, round to 0.5)
- bet-spread: Bankroll management and bet sizing by true count
- full-training: Combined simulation of all skills

Rules:
- You ARE the feedback system. There is no other feedback box — your reply IS the verdict.
- For CORRECT answers: reply with 1–3 words ONLY. No punctuation needed. Examples: "Nice", "Perfect", "Sharp", "Exactly", "Yes"
- For WRONG answers: reply "Wrong —" then the reason in 8 words or fewer. One tight line, no extra sentences.
- When suggesting a redirect, include [ACTION:redirect:trainer-id] at the END of your message on its own line. Valid IDs: basic-strategy, keep-counting, deviations, true-count, bet-spread, full-training, dashboard, pipeline
- On the dashboard, assess the weakest skill first and give one concrete next step (2 sentences max).
- A player is casino-ready when: Basic Strategy >95%, Running Count >90%, True Count within ±0.5 consistently, at least one deviation set memorized.
- Stay focused on blackjack training. You are not a general chatbot.`;

// ── Build human-turn message from event context ────────────────
function buildUserMessage(event, payload, userMessage) {
  if (userMessage) return userMessage;

  if (event === 'view_change' && payload.view === 'pipeline') {
    const statsStr = payload.stats
      ? Object.entries(payload.stats)
          .map(([k, v]) => `${k}: ${v.total > 0 ? Math.round((v.correct / v.total) * 100) : 'untrained'}%`)
          .join(', ')
      : 'no stats yet (new user)';
    const isNew = !payload.stats || Object.values(payload.stats).every(v => v.total === 0);
    if (isNew) {
      return `New user just arrived. Your reply MUST start with this exact sentence: "Hi, I'm Colin — I'll be your personal card counting coach." Then add exactly 1–2 more short sentences: mention you'll give live feedback on every question and they can ask you anything, then tell them to start with Basic Strategy. Do not deviate from this structure.`;
    }
    return `Returning user "${payload.user || 'Guest'}" is back. Sessions: ${payload.sessions || 0}. Stats: ${statsStr}. Reply in 1–2 short sentences: greet them by name if available, then tell them exactly what to work on next based on their weakest stat. Be direct, not generic.`;
  }

  if (event === 'trainer_enter') {
    const s = payload.stats || { correct: 0, total: 0 };
    const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : null;
    const statsStr = pct !== null ? `${s.correct}/${s.total} (${pct}%)` : 'no attempts yet';
    return `User entered the ${payload.skillName} trainer. Stats: ${statsStr}. One short sentence — like a coach saying "let's go" with one specific focus for this session.`;
  }

  if (event === 'trainer_answer') {
    const { skillId, isCorrect, streak } = payload;

    if (skillId === 'basic-strategy') {
      if (!isCorrect) {
        return `Basic Strategy wrong. Hand: ${payload.handLabel} vs dealer ${payload.dealerLabel}. Chose: ${payload.chosen}. Correct: ${payload.correctAction}. Reply "Wrong —" + reason in 8 words or fewer.`;
      }
      return `Basic Strategy correct. Reply 1–3 words of praise only.`;
    }

    if (skillId === 'keep-counting') {
      if (!isCorrect) {
        return `Running Count wrong. Submitted: ${payload.playerCount}. Correct: ${payload.correctCount}. Cards: ${payload.cardBreakdown ? payload.cardBreakdown.map(c => `${c.rank}(${c.value > 0 ? '+' : ''}${c.value})`).join(', ') : 'not provided'}. Reply "Wrong —" + reason in 8 words or fewer.`;
      }
      return `Running Count correct. Reply 1–3 words of praise only.`;
    }

    if (skillId === 'deviations') {
      if (!isCorrect) {
        const shouldStr = payload.shouldDeviate ? 'should deviate' : 'should NOT deviate';
        return `Deviations wrong. ${payload.hand} vs ${payload.upcard}, TC: ${payload.trueCount}. Chose: ${payload.chosen}. Correct: ${payload.correctAction} (${shouldStr}). Reply "Wrong —" + reason in 8 words or fewer.`;
      }
      return `Deviations correct. Reply 1–3 words of praise only.`;
    }

    if (skillId === 'true-count') {
      if (!isCorrect) {
        return `True Count wrong. Answered: ${payload.playerAnswer}. Correct: ${payload.correctAnswer}. Reply "Wrong —" + reason in 8 words or fewer.`;
      }
      return `True Count correct. Reply 1–3 words of praise only.`;
    }

    if (skillId === 'full-training') {
      const playStr  = payload.playWasCorrect  ? 'correct' : `WRONG (chose ${payload.chosenPlay}, correct ${payload.correctPlay})`;
      const countStr = payload.countWasCorrect ? 'correct' : `WRONG (submitted ${payload.playerCount}, correct ${payload.runningCount})`;
      if (!isCorrect) {
        return `Full Training: play ${playStr}, count ${countStr}. Reply "Wrong —" + targeted reason in 8 words or fewer.`;
      }
      return `Full Training correct. Reply 1–3 words of praise only.`;
    }

    // Generic fallback
    if (!isCorrect) return `${skillId} wrong. Reply "Wrong —" + reason in 8 words or fewer.`;
    return `${skillId} correct. Reply 1–3 words of praise only.`;
  }

  if (event === 'dashboard_load') {
    const weakStr     = payload.weaknesses?.length ? payload.weaknesses.join(', ') : 'none';
    const strongStr   = payload.strengths?.length  ? payload.strengths.join(', ')  : 'none';
    return `User opened their Dashboard. Username: ${payload.user}. Sessions: ${payload.sessions}. Overall accuracy: ${payload.globalPct}%. Weak areas: ${weakStr}. Strengths: ${strongStr}. Give a 2-sentence coaching assessment: what to focus on next and a rough estimate of how close they are to being casino-ready.`;
  }

  return 'Hello Colin.';
}

// ── Main endpoint ──────────────────────────────────────────────
app.post('/colin', async (req, res) => {
  const { sessionId, event, payload = {}, message: userMessage = null } = req.body;

  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getSession(sessionId);
  const humanText = buildUserMessage(event, payload, userMessage);

  session.messages.push({ role: 'user', content: humanText });

  // Cap history to last 20 messages
  if (session.messages.length > 20) {
    session.messages = session.messages.slice(-20);
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: session.messages,
    });

    const raw = response.content[0].text;

    // Parse optional action tag
    const actionMatch = raw.match(/\[ACTION:redirect:([a-z-]+)\]/);
    const action = actionMatch ? { type: 'redirect', target: actionMatch[1] } : null;
    const reply  = raw.replace(/\[ACTION:redirect:[a-z-]+\]/g, '').trim();

    session.messages.push({ role: 'assistant', content: raw });

    res.json({ reply, action });
  } catch (err) {
    console.error('Anthropic error:', err.message);
    res.status(500).json({ error: 'Failed to get response from Colin.' });
  }
});

app.listen(port, () => {
  console.log(`Colin agent running on http://localhost:${port}`);
});
