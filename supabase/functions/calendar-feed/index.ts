// Serves a user's ToGo activities as a subscribable calendar (.ics).
//
// GET /functions/v1/calendar-feed?token=<secret>
//
// Calendar apps can't send a login, so this is public (JWT verification off)
// and authorized only by the long random token in calendar_feed_tokens. It
// returns activities the token's owner has joined or is hosting, from the last
// 14 days onward, including canceled ones (marked cancelled) so they disappear.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildCalendar } from '../_shared/ics-export.js';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const SITE_URL = Deno.env.get('SITE_URL') || 'https://togo-social-calpoly.cometherring2.chatgpt.site';

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async req => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return text('Method not allowed', 405);
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{48}$/.test(token)) return text('Not found', 404);

  const { data: owner } = await admin.from('calendar_feed_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!owner) return text('Not found', 404);

  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const [joined, hosted] = await Promise.all([
    admin.from('game_participants').select('game_id').eq('user_id', owner.user_id),
    admin.from('games').select('id').eq('host_id', owner.user_id)
  ]);
  const ids = [...new Set([...(joined.data ?? []).map(r => r.game_id), ...(hosted.data ?? []).map(r => r.id)])];
  const { data: games, error } = ids.length
    ? await admin.from('games').select('id, title, sport, venue, description, starts_at, status').in('id', ids).gte('starts_at', since).order('starts_at')
    : { data: [], error: null };
  if (error) { console.error(error); return text('Calendar unavailable', 500); }

  const body = buildCalendar(games ?? [], { name: 'ToGo', siteUrl: SITE_URL });
  return new Response(req.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="togo.ics"',
      'Cache-Control': 'private, max-age=300'
    }
  });
});
