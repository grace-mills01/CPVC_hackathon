// Pure logic for AI recommendations, shared by the `recommend` edge function
// (Deno) and unit tests (Node). No imports, no network.
//
// Pipeline: hard filters (schedule, capacity, already joined, dismissed) →
// semantic score from gte-small embeddings + interest/goal signals →
// top candidates go to an LLM that re-ranks and writes a one-line reason →
// if the LLM is unavailable, rule-based reasons are used instead.

const MINUTE = 60000;
const DAY_MS = 86400000;
const DEFAULT_LENGTH_MS = 90 * MINUTE;
const BUFFER_MS = 15 * MINUTE;

export const GOAL_LABELS = Object.freeze({
  meet_people: 'meet new people',
  stay_active: 'stay active',
  try_new: 'try something new',
  study: 'study with others',
  unwind: 'unwind and destress',
  compete: 'get competitive'
});

const SOCIAL = new Set(['study group', 'coffee', 'food and dining', 'downtown hangout', 'arts and culture', 'other social']);
const norm = s => String(s || '').trim().toLowerCase();

// ---------- Time zones ----------

function tzOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs));
  const v = Object.fromEntries(parts.map(p => [p.type, Number(p.value)]));
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - utcMs;
}

/** Local wall-clock time in `timeZone` → epoch ms. */
export function zonedInstant(y, m, d, h, mi, timeZone) {
  const naive = Date.UTC(y, m - 1, d, h, mi);
  let guess = naive - tzOffsetMs(naive, timeZone);
  return naive - tzOffsetMs(guess, timeZone);
}

function localDate(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(new Date(ms));
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { y: +v.year, m: +v.month, d: +v.day, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v.weekday) };
}

export const formatWhen = (ms, timeZone) =>
  new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
const formatTime = (ms, timeZone) =>
  new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));

/** Weekly entries ({weekday, start_time, end_time, label}) → dated busy blocks in the user's zone. */
export function expandWeekly(entries = [], { from = new Date(), days = 21, timeZone = 'America/Los_Angeles' } = {}) {
  const blocks = [];
  for (let i = -1; i <= days; i++) {
    const day = localDate(from.getTime() + i * DAY_MS, timeZone);
    for (const e of entries) {
      if (e.weekday !== day.weekday) continue;
      const [sh, sm] = e.start_time.split(':').map(Number);
      const [eh, em] = e.end_time.split(':').map(Number);
      blocks.push({ start: zonedInstant(day.y, day.m, day.d, sh, sm, timeZone), end: zonedInstant(day.y, day.m, day.d, eh, em, timeZone), label: e.label || null });
    }
  }
  return blocks;
}

/** busy_blocks rows → {start, end, label} in ms. */
export const toBlocks = rows => rows.map(r => ({ start: new Date(r.starts_at).getTime(), end: new Date(r.ends_at).getTime(), label: r.label || null }));

export function conflicts(start, end, blocks) {
  return blocks.some(b => start < b.end + BUFFER_MS && end > b.start - BUFFER_MS);
}

// ---------- Candidates ----------

export const activityWindow = game => {
  const start = new Date(game.starts_at).getTime();
  return { start, end: game.ends_at ? new Date(game.ends_at).getTime() : start + DEFAULT_LENGTH_MS };
};

/**
 * Activities this user could actually join: upcoming, open, not full, not
 * theirs, not already joined, not dismissed, and not clashing with busy times.
 */
export function eligibleActivities(games, { userId, roster = [], dismissed = new Set(), busy = [], now = new Date(), horizonDays = 21 }) {
  const limit = now.getTime() + horizonDays * DAY_MS;
  return games.flatMap(game => {
    const { start, end } = activityWindow(game);
    if (game.status !== 'scheduled' || start <= now.getTime() || start > limit) return [];
    if (game.host_id === userId || dismissed.has(game.id)) return [];
    const members = roster.filter(r => r.game_id === game.id);
    if (members.some(r => r.user_id === userId)) return [];
    const openSpots = game.capacity - members.length;
    if (openSpots <= 0 || conflicts(start, end, busy)) return [];
    return [{ game, start, end, openSpots, count: members.length }];
  });
}

// ---------- Text for the embedding model ----------

export function profileText(profile) {
  const interests = (profile.interests || []).join(', ') || 'open to anything';
  const goals = (profile.goals || []).map(g => GOAL_LABELS[g] || g).join(', ') || 'have fun';
  return `A college student who enjoys ${interests} and wants to ${goals}.`;
}

export function activityText(game) {
  const description = String(game.description || '').trim();
  const sentence = description && !/[.!?]$/.test(description) ? `${description}.` : description;
  return [`${game.sport} activity: ${game.title}.`, sentence, `At ${game.venue}.`].filter(Boolean).join(' ').slice(0, 1000);
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// ---------- Scoring ----------

/**
 * Combines meaning-based similarity with explicit signals. `semantic` is the
 * cosine similarity between the profile and activity embeddings.
 */
export function scoreCandidate(candidate, profile, semantic, now = new Date()) {
  const { game, openSpots, start } = candidate;
  const interests = new Set((profile.interests || []).map(norm));
  const goals = new Set(profile.goals || []);
  const text = `${norm(game.sport)} ${norm(game.title)} ${norm(game.description)}`;
  const sport = norm(game.sport);
  const signals = [];
  // gte-small similarities for related short texts mostly fall between 0.72 and 0.92.
  let score = Math.max(0, Math.min(1, (semantic - 0.72) / 0.2)) * 50;
  if (interests.has(sport)) { score += 25; signals.push(`you’re into ${sport}`); }
  else if ([...interests].some(i => i && text.includes(i))) { score += 15; signals.push('it’s related to your interests'); }
  else if (goals.has('try_new')) { score += 8; signals.push('it’s something new to try'); }
  if (goals.has('study') && /study|homework|exam|midterm/.test(text)) { score += 10; signals.push('you wanted to study with others'); }
  if (goals.has('stay_active') && !SOCIAL.has(sport)) { score += 6; signals.push('it keeps you active'); }
  if (goals.has('unwind') && (SOCIAL.has(sport) || /chill|casual|relax|all levels|sunset/.test(text))) { score += 6; signals.push('it’s a relaxed way to unwind'); }
  if (goals.has('compete') && /compet|tournament|league|advanced|intense/.test(text)) { score += 6; signals.push('you like some competition'); }
  if (goals.has('meet_people') && openSpots >= 3) { score += 5; signals.push(`${openSpots} open spots to meet new people`); }
  const daysAway = (start - now.getTime()) / DAY_MS;
  score += Math.max(0, 8 - daysAway);
  return { score: Math.round(Math.min(100, score)), signals };
}

/**
 * When the activity falls in the user's day. Returns {when, note, text}:
 * note is e.g. "after your PHYS 132 (ends 2:30 PM)" or '' when nothing useful.
 */
export function scheduleContext(candidate, busy, timeZone) {
  const { start, end } = candidate;
  const when = formatWhen(start, timeZone);
  const day = localDate(start, timeZone);
  const sameDay = busy.filter(b => { const d = localDate(b.start, timeZone); return d.y === day.y && d.m === day.m && d.d === day.d; });
  const before = sameDay.filter(b => b.end <= start && start - b.end <= 3 * 3600000).sort((a, b) => b.end - a.end)[0];
  const after = sameDay.filter(b => b.start >= end && b.start - end <= 3 * 3600000).sort((a, b) => a.start - b.start)[0];
  let note = '';
  if (before?.label) note = `after your ${before.label} (ends ${formatTime(before.end, timeZone)})`;
  else if (after?.label) note = `before your ${after.label} (starts ${formatTime(after.start, timeZone)})`;
  else if (before && after) note = 'in a gap between things on your calendar';
  else if (busy.length) note = 'when your calendar is free';
  return { when, note, text: note ? `${when}, ${note}` : when };
}

// ---------- LLM prompt and response ----------

/** Chat messages asking the model to re-rank candidates and explain each pick. */
export function buildPrompt(profile, candidates, { dismissedTitles = [], maxPicks = 5 } = {}) {
  const goals = (profile.goals || []).map(g => GOAL_LABELS[g] || g);
  const user = {
    first_name: (profile.display_name || '').split(/\s+/)[0] || null,
    interests: profile.interests || [],
    goals,
    passed_on: dismissedTitles.slice(0, 10)
  };
  const options = candidates.map(c => ({
    id: c.id,
    type: c.game.sport,
    title: c.game.title,
    details: (c.game.description || '').slice(0, 280),
    place: c.game.venue,
    when: c.context,
    open_spots: c.openSpots,
    prefilter_score: c.score
  }));
  return [
    {
      role: 'system',
      content: [
        'You are ToGo’s matchmaker. ToGo helps Cal Poly SLO students find activities to join.',
        `Pick up to ${maxPicks} activities from OPTIONS that best fit the USER, best first. Skip any that are a poor fit.`,
        'Weigh what the user said they enjoy and want, the activity details, and timing. Treat "passed_on" as things they did not want; avoid close repeats.',
        'For each pick write one friendly sentence (max 22 words) addressed to the user as "you" that says specifically why it fits them.',
        'Mention their interests, goals, or the timing from "when" when relevant. Use only facts given; never invent details, people, or prices.',
        'Respond with JSON only: {"picks":[{"id":"c1","fit":0-100,"reason":"..."}]}'
      ].join(' ')
    },
    { role: 'user', content: JSON.stringify({ USER: user, OPTIONS: options }) }
  ];
}

/** Validates the model's JSON. Returns [] if it can't be trusted. */
export function parsePicks(text, candidateIds, maxPicks = 5) {
  let data;
  try { data = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return []; }
  const seen = new Set();
  const picks = [];
  for (const p of Array.isArray(data?.picks) ? data.picks : []) {
    if (!p || !candidateIds.includes(p.id) || seen.has(p.id)) continue;
    const reason = String(p.reason || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    if (reason.length < 8) continue;
    const fit = Math.max(0, Math.min(100, Math.round(Number(p.fit) || 0)));
    seen.add(p.id);
    picks.push({ id: p.id, fit, reason });
    if (picks.length >= maxPicks) break;
  }
  return picks;
}

/** One-line reason without the LLM, from the scoring signals and schedule context. */
export function fallbackReason(candidate) {
  const first = candidate.signals[0];
  const parts = [first ? `Picked because ${first}` : 'Picked from what you told us you like'];
  if (candidate.note) parts.push(candidate.note);
  return parts.join(', ') + '.';
}

// ---------- Choosing a Groq model ----------

/** Preferred chat models, best first. Groq retires models, so this is only a starting list. */
export const PREFERRED_MODELS = Object.freeze(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3-32b']);
const NOT_CHAT = /whisper|tts|orpheus|guard|compound|allam|embed|vision|playai/i;

/**
 * Models to try, in order: an explicit override, the preferred list, then any
 * other chat model Groq currently lists (from GET /openai/v1/models).
 */
export function modelCandidates(override, listed = []) {
  const available = listed.map(m => m.id || m).filter(id => id && !NOT_CHAT.test(id));
  const ordered = [override, ...PREFERRED_MODELS.filter(id => !listed.length || available.includes(id)), ...available];
  return [...new Set(ordered.filter(Boolean))];
}

// ---------- Notifications ----------

/** Notifications to create for these picks (duplicates are ignored by the database). */
export function notificationsFor(picks, { firstRun = false } = {}) {
  const out = [];
  const newMatchLimit = firstRun ? 1 : 3;
  for (const p of picks) {
    if (p.fit >= 70 && out.filter(n => n.kind === 'new_match').length < newMatchLimit) {
      out.push({ kind: 'new_match', game_id: p.game.id, title: `New pick for you: ${p.game.title}`.slice(0, 120), body: p.reason });
    }
    if (p.openSpots <= 2 && p.fit >= 60) {
      const spots = p.openSpots === 1 ? 'Only 1 spot left' : `Only ${p.openSpots} spots left`;
      out.push({ kind: 'filling_up', game_id: p.game.id, title: `${spots}: ${p.game.title}`.slice(0, 120), body: p.reason });
    }
  }
  return out;
}
