// Scores upcoming activities for a user from their interests, goals, and busy
// times. This rule-based scorer runs in the browser; an AI ranker can replace or
// re-rank its output later without changing the callers.
import { SOCIAL_INTERESTS } from './catalog.js';

const DEFAULT_LENGTH_MS = 90 * 60000; // games don't store an end time yet
const BUFFER_MS = 15 * 60000; // time to get there between commitments

const norm = s => String(s || '').trim().toLowerCase();

/** True when [start, end) overlaps any busy block, including a travel buffer. */
export function conflictsWithBusy(start, end, busyBlocks = []) {
  return busyBlocks.some(b => {
    const bs = new Date(b.starts_at).getTime() - BUFFER_MS;
    const be = new Date(b.ends_at).getTime() + BUFFER_MS;
    return start < be && end > bs;
  });
}

/**
 * @param {object} game         Row from public.games (sport, starts_at, capacity, ...).
 * @param {object} user         { interests: string[], goals: string[], id?: string }
 * @param {object} [context]    { busyBlocks, count (roster size), joined, now }
 * @returns {{eligible: boolean, score: number, fitsSchedule: boolean | null, reasons: string[]}}
 */
export function scoreActivity(game, user, { busyBlocks = [], count = 0, joined = false, now = new Date() } = {}) {
  const start = new Date(game.starts_at).getTime();
  const end = game.ends_at ? new Date(game.ends_at).getTime() : start + DEFAULT_LENGTH_MS;
  const result = { eligible: false, score: 0, fitsSchedule: null, reasons: [] };
  if (game.status !== 'scheduled' || start <= now.getTime() || joined || game.host_id === user.id) return result;
  if (count >= game.capacity) return result;

  const interests = new Set((user.interests || []).map(norm));
  const goals = new Set(user.goals || []);
  const sport = norm(game.sport);
  const text = `${sport} ${norm(game.title)} ${norm(game.description)}`;
  const isSocial = [...SOCIAL_INTERESTS].some(s => norm(s) === sport);
  const openSpots = game.capacity - count;
  let score = 0;

  if (interests.has(sport)) { score += 50; result.reasons.push(`You’re into ${game.sport.toLowerCase()}`); }
  else if ([...interests].some(i => i && text.includes(i))) { score += 30; result.reasons.push('Related to your interests'); }
  else if (goals.has('try_new')) { score += 15; result.reasons.push('Something new to try'); }

  if (goals.has('stay_active') && !isSocial) { score += 10; result.reasons.push('Keeps you active'); }
  if (goals.has('study') && /study/.test(text)) { score += 15; result.reasons.push('Study with others'); }
  if (goals.has('unwind') && (isSocial || /chill|casual|relax|all levels|sunset/.test(text))) { score += 10; result.reasons.push('A relaxed way to unwind'); }
  if (goals.has('compete') && /compet|tournament|league|advanced|intense/.test(text)) { score += 10; result.reasons.push('Some friendly competition'); }
  if (goals.has('meet_people') && openSpots >= 3) { score += 8; result.reasons.push(`${openSpots} spots open to meet new people`); }

  if (busyBlocks.length) {
    result.fitsSchedule = !conflictsWithBusy(start, end, busyBlocks);
    if (!result.fitsSchedule) return { ...result, score: 0, reasons: ['Conflicts with your calendar'] };
    score += 20;
    result.reasons.unshift('Fits your schedule');
  }

  // Sooner activities rank slightly higher (up to +10 within the next week).
  const daysAway = (start - now.getTime()) / 86400000;
  score += Math.max(0, 10 - Math.floor(daysAway * 10 / 7));

  return { ...result, eligible: score > 10, score, reasons: result.reasons.slice(0, 3) };
}

/** Returns eligible games sorted best-first, each with its match details. */
export function rankActivities(games, user, { busyBlocks = [], roster = [], now = new Date(), limit = 10 } = {}) {
  return games
    .map(game => {
      const members = roster.filter(r => r.game_id === game.id);
      const match = scoreActivity(game, user, {
        busyBlocks, now, count: members.length, joined: members.some(r => r.user_id === user.id)
      });
      return { game, ...match };
    })
    .filter(m => m.eligible)
    .sort((a, b) => b.score - a.score || new Date(a.game.starts_at) - new Date(b.game.starts_at))
    .slice(0, limit);
}
