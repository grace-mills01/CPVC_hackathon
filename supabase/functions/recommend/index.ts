// Personalized "For you" picks with AI-written reasons, plus in-app notifications.
//
// POST body: { timeZone?: string, force?: boolean }
//
// 1. Reads the signed-in user's interests, goals, and busy times (under RLS).
// 2. Filters activities they can actually make (schedule, capacity, joined, dismissed).
// 3. Scores the rest by meaning with Supabase's built-in gte-small embedding
//    model (no external API), plus interest/goal signals.
// 4. Sends the top few to an LLM on Groq (if GROQ_API_KEY is set) to re-rank and
//    write a one-line reason each; falls back to rule-based reasons otherwise.
// 5. Caches the picks for 30 minutes unless inputs change, and creates
//    notifications for strong new matches and nearly-full activities.
//
// The LLM sees interests, goals, first name, and activity details. It never sees
// calendar events (ToGo doesn't store them) or other users' data.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as R from '../_shared/recommend.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CACHE_MS = 30 * 60000;
const SHORTLIST = 8;
const MAX_NEW_EMBEDDINGS = 12; // keeps each request well within edge CPU limits
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile';

// Loaded once per function instance; runs on Supabase's servers.
const embedder = new Supabase.ai.Session('gte-small');
const embed = async (text: string) => Array.from(await embedder.run(text, { mean_pool: true, normalize: true }) as number[]);

async function sha(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function askGroq(messages: unknown[]): Promise<string | null> {
  const key = Deno.env.get('GROQ_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.4, max_tokens: 800, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) { console.error('groq', res.status, (await res.text()).slice(0, 300)); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error('groq', e instanceof Error ? e.message : e);
    return null;
  }
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
  if (!user) return json({ error: 'Sign in to see your picks.' }, 401);

  const body = await req.json().catch(() => ({}));
  let timeZone = 'America/Los_Angeles';
  try { if (body.timeZone) { new Intl.DateTimeFormat('en-US', { timeZone: body.timeZone }); timeZone = body.timeZone; } } catch { /* keep default */ }
  const now = new Date();

  // Everything about the user is read with their own token, so RLS applies.
  const [profile, busyRows, weekly, games, roster, feedback, run] = await Promise.all([
    db.from('profiles').select('display_name, interests, goals').eq('id', user.id).maybeSingle(),
    db.from('busy_blocks').select('starts_at, ends_at, label').gt('ends_at', now.toISOString()),
    db.from('weekly_busy').select('weekday, start_time, end_time, label'),
    db.from('games').select('id, host_id, title, sport, venue, description, starts_at, capacity, status').eq('status', 'scheduled').gt('starts_at', now.toISOString()).order('starts_at').limit(300),
    db.from('game_participants').select('game_id, user_id'),
    db.from('recommendation_feedback').select('game_id'),
    admin.from('recommendation_runs').select('input_hash, computed_at').eq('user_id', user.id).maybeSingle()
  ]);
  const failed = [profile, busyRows, weekly, games, roster, feedback].find(r => r.error);
  if (failed) { console.error(failed.error); return json({ error: 'Couldn’t load your picks right now.' }, 500); }
  const me = profile.data;
  if (!me || (!me.interests?.length && !me.goals?.length)) return json({ recommendations: [], needs_preferences: true });

  const busy = [...R.toBlocks(busyRows.data ?? []), ...R.expandWeekly(weekly.data ?? [], { from: now, timeZone })];
  const dismissed = new Set((feedback.data ?? []).map(f => f.game_id));
  const candidates = R.eligibleActivities(games.data ?? [], { userId: user.id, roster: roster.data ?? [], dismissed, busy, now });

  // Re-use cached picks if nothing that matters has changed.
  const inputHash = await sha(JSON.stringify({
    tz: timeZone, i: me.interests, g: me.goals, d: [...dismissed].sort(),
    b: busy.map(b => b.start).sort().slice(0, 50), c: candidates.map(c => [c.game.id, c.openSpots, c.game.title, c.game.description])
  }));
  const fresh = run.data && run.data.input_hash === inputHash && now.getTime() - new Date(run.data.computed_at).getTime() < CACHE_MS;
  if (fresh && !body.force) {
    const { data: cached } = await db.from('recommendations').select('game_id, rank, fit, reason, source').order('rank');
    return json({ recommendations: cached ?? [], ai: (cached ?? []).some(r => r.source === 'ai'), cached: true, generated_at: run.data!.computed_at });
  }

  // Meaning-based similarity with the built-in embedding model.
  const profileVector = await embed(R.profileText(me));
  const ids = candidates.map(c => c.game.id);
  const { data: stored } = ids.length
    ? await admin.from('activity_embeddings').select('game_id, content_hash, embedding').in('game_id', ids)
    : { data: [] };
  const vectors = new Map((stored ?? []).map(r => [r.game_id, r]));
  const toSave = [];
  for (const c of candidates) {
    const text = R.activityText(c.game);
    const hash = await sha(text);
    const hit = vectors.get(c.game.id);
    if (hit?.content_hash === hash) { c.vector = hit.embedding; continue; }
    if (toSave.length >= MAX_NEW_EMBEDDINGS) continue;
    c.vector = await embed(text);
    toSave.push({ game_id: c.game.id, content_hash: hash, embedding: c.vector, updated_at: now.toISOString() });
  }
  if (toSave.length) await admin.from('activity_embeddings').upsert(toSave);

  const scored = candidates.map(c => {
    const semantic = c.vector ? R.cosine(profileVector, c.vector) : 0.8;
    const { score, signals } = R.scoreCandidate(c, me, semantic, now);
    const context = R.scheduleContext(c, busy, timeZone);
    return { ...c, score, signals, semantic, note: context.note, context: context.text };
  }).sort((a, b) => b.score - a.score || a.start - b.start);

  const shortlist = scored.slice(0, SHORTLIST).map((c, i) => ({ ...c, id: `c${i + 1}` }));
  const dismissedTitles = (games.data ?? []).filter(g => dismissed.has(g.id)).map(g => g.title);

  // Let the LLM re-rank and explain; fall back to rules if it's unavailable.
  let source: 'ai' | 'rules' = 'rules';
  let final: { c: typeof shortlist[number]; fit: number; reason: string }[] = [];
  if (shortlist.length) {
    const reply = await askGroq(R.buildPrompt(me, shortlist, { dismissedTitles }));
    const picks = reply ? R.parsePicks(reply, shortlist.map(c => c.id)) : [];
    if (picks.length) {
      source = 'ai';
      final = picks.map(p => ({ c: shortlist.find(c => c.id === p.id)!, fit: p.fit, reason: p.reason }));
    } else {
      final = shortlist.filter(c => c.score >= 35).slice(0, 5).map(c => ({ c, fit: c.score, reason: R.fallbackReason(c) }));
    }
  }

  await admin.from('recommendations').delete().eq('user_id', user.id);
  if (final.length) {
    const { error } = await admin.from('recommendations').insert(final.map((f, rank) => ({
      user_id: user.id, game_id: f.c.game.id, rank, fit: f.fit, reason: f.reason, source
    })));
    if (error) console.error('save recommendations', error);
  }
  await admin.from('recommendation_runs').upsert({ user_id: user.id, input_hash: inputHash, model: source === 'ai' ? GROQ_MODEL : 'rules', computed_at: now.toISOString() });

  const notes = R.notificationsFor(final.map(f => ({ game: f.c.game, fit: f.fit, reason: f.reason, openSpots: f.c.openSpots })), { firstRun: !run.data });
  if (notes.length) {
    const { error } = await admin.from('notifications').upsert(notes.map(n => ({ ...n, user_id: user.id })), { onConflict: 'user_id,game_id,kind', ignoreDuplicates: true });
    if (error) console.error('notifications', error);
  }

  return json({
    recommendations: final.map((f, rank) => ({ game_id: f.c.game.id, rank, fit: f.fit, reason: f.reason, source })),
    ai: source === 'ai',
    cached: false,
    generated_at: now.toISOString()
  });
});
