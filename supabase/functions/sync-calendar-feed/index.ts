// Syncs a user's calendar link (Apple iCloud, Google, Outlook) into busy_blocks.
//
// POST body (all optional):
//   { url: string }       save this link, then sync it
//   { remove: true }      forget the link and its synced busy times
//   { timeZone: string }  the user's IANA zone, for events without one
// With no url/remove, re-syncs the saved link.
//
// Runs as the signed-in user (their JWT), so row-level security applies to every
// read and write. Only start/end times are stored; event details are discarded.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkFeedUrl, parseIcsBusyBlocks } from '../_shared/ics.js';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const MAX_BYTES = 3 * 1024 * 1024;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Fetches the feed, re-checking the host on every redirect and capping size. */
async function fetchFeed(startUrl: string): Promise<string> {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10000), headers: { Accept: 'text/calendar' } });
    if (res.status >= 300 && res.status < 400) {
      const next = checkFeedUrl(new URL(res.headers.get('location') ?? '', url).toString());
      if (next.error) throw new Error('The calendar link redirected somewhere unexpected.');
      url = next.url!;
      continue;
    }
    if (res.status === 404 || res.status === 403) throw new Error('That calendar link isn’t public anymore. Share it again and paste the new link.');
    if (!res.ok) throw new Error('Couldn’t reach that calendar right now. Try again later.');
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('That calendar is too large to sync.'); }
      chunks.push(value);
    }
    const text = new TextDecoder().decode(chunks.length === 1 ? chunks[0] : new Uint8Array(await new Blob(chunks).arrayBuffer()));
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('That link isn’t a calendar feed. Copy the calendar’s share link.');
    return text;
  }
  throw new Error('The calendar link redirected too many times.');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Sign in to sync your calendar.' }, 401);

  const body = await req.json().catch(() => ({}));
  let timeZone = 'America/Los_Angeles';
  try { if (body.timeZone) { new Intl.DateTimeFormat('en-US', { timeZone: body.timeZone }); timeZone = body.timeZone; } } catch { /* keep default */ }

  if (body.remove) {
    await supabase.from('busy_blocks').delete().eq('user_id', user.id).eq('source', 'feed');
    await supabase.from('calendar_feeds').delete().eq('user_id', user.id);
    return json({ removed: true });
  }

  let feed;
  if (body.url) {
    const checked = checkFeedUrl(body.url);
    if (checked.error) return json({ error: checked.error }, 400);
    feed = { url: checked.url, provider: checked.provider };
  } else {
    const { data } = await supabase.from('calendar_feeds').select('url, provider').eq('user_id', user.id).maybeSingle();
    if (!data) return json({ error: 'No calendar link saved yet.' }, 404);
    feed = data;
  }

  try {
    const blocks = parseIcsBusyBlocks(await fetchFeed(feed.url), { timeZone });
    const syncedAt = new Date().toISOString();
    const saved = await supabase.from('calendar_feeds').upsert({ user_id: user.id, ...feed, last_synced_at: syncedAt, last_error: null });
    if (saved.error) throw new Error('Couldn’t save your calendar link.');
    await supabase.from('busy_blocks').delete().eq('user_id', user.id).eq('source', 'feed');
    if (blocks.length) {
      const inserted = await supabase.from('busy_blocks').insert(blocks.map(b => ({ ...b, user_id: user.id, source: 'feed' })));
      if (inserted.error) throw new Error('Couldn’t save your busy times.');
    }
    return json({ provider: feed.provider, count: blocks.length, last_synced_at: syncedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Calendar sync failed.';
    if (!body.url) await supabase.from('calendar_feeds').update({ last_error: message.slice(0, 300) }).eq('user_id', user.id);
    return json({ error: message }, 422);
  }
});
