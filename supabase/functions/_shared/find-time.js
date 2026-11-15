// Pure logic for "Find the best time": which slots in the coming week work
// for the most people likely to be interested in an activity. Shared by the
// suggest-times edge function (Deno) and tests (Node). No network.
import { conflicts, zonedInstant, formatWhen } from './recommend.js';

const MINUTE = 60000;
const DAY_MS = 86400000;
export const MIN_SHOWN = 3; // counts below this are hidden so no one can be singled out

const norm = s => String(s || '').trim().toLowerCase();

function localParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(ms));
  const v = Object.fromEntries(parts.map(p => [p.type, Number(p.value)]));
  return { y: v.year, m: v.month, d: v.day, h: v.hour };
}

/**
 * Candidate start times every 30 minutes from 7:00 AM to 9:30 PM local, over
 * the next `days` days, starting at least `leadMinutes` from now.
 */
export function candidateSlots({ now = new Date(), days = 7, timeZone = 'America/Los_Angeles', durationMinutes = 90, leadMinutes = 120 } = {}) {
  const slots = [];
  const earliest = now.getTime() + leadMinutes * MINUTE;
  for (let i = 0; i <= days; i++) {
    const day = localParts(now.getTime() + i * DAY_MS, timeZone);
    for (let minutes = 7 * 60; minutes <= 21 * 60 + 30; minutes += 30) {
      const start = zonedInstant(day.y, day.m, day.d, Math.floor(minutes / 60), minutes % 60, timeZone);
      if (start < earliest || start > now.getTime() + days * DAY_MS) continue;
      slots.push({ start, end: start + durationMinutes * MINUTE });
    }
  }
  return slots;
}

/**
 * People likely to want this activity: they listed it as an interest, a word
 * from it appears in the activity, or the embedding model says their profile
 * is close in meaning (similarity at or above `threshold`).
 */
export function interestedPeople(people, activity, { similarity = new Map(), threshold = 0.86 } = {}) {
  const sport = norm(activity.sport);
  const text = `${sport} ${norm(activity.title)} ${norm(activity.description)}`;
  return people.filter(p => {
    const interests = (p.interests || []).map(norm);
    if (interests.includes(sport)) return true;
    if (interests.some(i => i.length > 3 && text.includes(i))) return true;
    return (similarity.get(p.id) ?? 0) >= threshold;
  });
}

/** Ranks slots by how many interested people are free, keeping picks spread out. */
export function bestSlots(slots, people, busyByPerson, { hostBusy = [], limit = 4 } = {}) {
  const scored = slots
    .filter(s => !conflicts(s.start, s.end, hostBusy))
    .map(s => ({ ...s, free: people.filter(p => !conflicts(s.start, s.end, busyByPerson.get(p.id) || [])).length }))
    .filter(s => s.free > 0)
    .sort((a, b) => b.free - a.free || a.start - b.start);
  const picks = [];
  for (const s of scored) {
    if (picks.some(p => Math.abs(p.start - s.start) < 3 * 60 * MINUTE)) continue; // at least 3 hours apart
    picks.push(s);
    if (picks.length >= limit) break;
  }
  return picks.sort((a, b) => a.start - b.start);
}

/** Privacy-safe wording for a count. */
export function countLabel(free, total) {
  if (total < MIN_SHOWN) return 'Not enough interested people yet to compare times';
  if (free < MIN_SHOWN) return `Fewer than ${MIN_SHOWN} of ${total} interested people are free`;
  return `${free} of ${total} interested people are free`;
}

export function describeSlot(slot, total, timeZone) {
  return { starts_at: new Date(slot.start).toISOString(), label: formatWhen(slot.start, timeZone), detail: countLabel(slot.free, total), free: total >= MIN_SHOWN && slot.free >= MIN_SHOWN ? slot.free : null };
}
