// "Find the best time" for hosts: suggests start times in the next week when
// the most people likely to be interested in the activity are free.
//
// POST body: { sport: string, title?: string, description?: string,
//              durationMinutes?: number, timeZone?: string }
//
// Interest is decided by listed interests plus meaning-based similarity from
// Supabase's built-in gte-small model. Busy times come from everyone's synced
// calendars and blocked-out times, read with the service role, but only
// aggregate counts are returned, and counts under 3 are hidden.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as R from '../_shared/recommend.js';
import * as F from '../_shared/find-time.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MAX_NEW_EMBEDDINGS = 25;
const embedder = new Supabase.ai.Session('gte-small');
const embed = async (text: string) => Array.from(await embedder.run(text, { mean_pool: true, normalize: true }) as number[]);

async function sha(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ error: 'Sign in to find a time.' }, 401);

  const body = await req.json().catch(() => ({}));
  const sport = String(body.sport || '').trim().slice(0, 80);
  if (!sport) return json({ error: 'Pick an activity type first, then we can find a time.' }, 400);
  const activity = {
    sport,
    title: String(body.title || '').trim().slice(0, 100) || sport,
    description: String(body.description || '').trim().slice(0, 500),
    venue: 'Cal Poly'
  };
  const durationMinutes = Math.min(240, Math.max(30, Number(body.durationMinutes) || 90));
  let timeZone = 'America/Los_Angeles';
  try { if (body.timeZone) { new Intl.DateTimeFormat('en-US', { timeZone: body.timeZone }); timeZone = body.timeZone; } } catch { /* keep default */ }
  const now = new Date();
  const until = new Date(now.getTime() + 8 * 86400000).toISOString();

  const [people, busyRows, weeklyRows, stored] = await Promise.all([
    admin.from('profiles').select('id, interests, goals').not('onboarded_at', 'is', null).limit(1000),
    admin.from('busy_blocks').select('user_id, starts_at, ends_at').gt('ends_at', now.toISOString()).lt('starts_at', until),
    admin.from('weekly_busy').select('user_id, weekday, start_time, end_time'),
    admin.from('profile_embeddings').select('user_id, content_hash, embedding')
  ]);
  const failed = [people, busyRows, weeklyRows, stored].find(r => r.error);
  if (failed) { console.error(failed.error); return json({ error: 'Couldn’t check times right now.' }, 500); }

  // Everyone's busy times, grouped by person (weekly times in the host's zone; campus is one zone).
  const busyByPerson = new Map<string, { start: number; end: number }[]>();
  const add = (id: string, blocks: { start: number; end: number }[]) => busyByPerson.set(id, [...(busyByPerson.get(id) || []), ...blocks]);
  for (const r of busyRows.data ?? []) add(r.user_id, R.toBlocks([r]));
  const weeklyByPerson = new Map<string, unknown[]>();
  for (const r of weeklyRows.data ?? []) weeklyByPerson.set(r.user_id, [...(weeklyByPerson.get(r.user_id) || []), r]);
  for (const [id, entries] of weeklyByPerson) add(id, R.expandWeekly(entries, { from: now, days: 8, timeZone }));
  const hostBusy = busyByPerson.get(user.id) || [];

  // Meaning-based interest: compare the activity with each person's interests and goals.
  const others = (people.data ?? []).filter(p => p.id !== user.id && (p.interests?.length || p.goals?.length));
  const activityVector = await embed(R.activityText(activity));
  const cache = new Map((stored.data ?? []).map(r => [r.user_id, r]));
  const similarity = new Map<string, number>();
  const toSave = [];
  for (const p of others) {
    const text = R.profileText(p);
    const hash = await sha(text);
    let vector = cache.get(p.id)?.content_hash === hash ? cache.get(p.id)!.embedding : null;
    if (!vector && toSave.length < MAX_NEW_EMBEDDINGS) {
      vector = await embed(text);
      toSave.push({ user_id: p.id, content_hash: hash, embedding: vector, updated_at: now.toISOString() });
    }
    if (vector) similarity.set(p.id, R.cosine(activityVector, vector));
  }
  if (toSave.length) await admin.from('profile_embeddings').upsert(toSave);

  const interested = F.interestedPeople(others, activity, { similarity });
  if (interested.length < F.MIN_SHOWN) {
    return json({
      interested: null,
      suggestions: [],
      message: `Only a few people have shown interest in ${sport.toLowerCase()} so far, so any time that works for you is a good start.`
    });
  }

  const slots = F.candidateSlots({ now, days: 7, timeZone, durationMinutes });
  const picks = F.bestSlots(slots, interested, busyByPerson, { hostBusy });
  return json({
    interested: interested.length,
    suggestions: picks.map(p => F.describeSlot(p, interested.length, timeZone)),
    message: picks.length ? null : 'No time this week works for most interested people. Try a different length or next week.'
  });
});
