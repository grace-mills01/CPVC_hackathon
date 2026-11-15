// Database and auth calls for onboarding and matching. UI components call these
// instead of talking to Supabase directly.
import { supabase } from '../../lib/supabase.js';
import { GOOGLE_SCOPES, fetchGoogleBusy } from './availability.js';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

export async function loadOwnProfile(userId) {
  return check(await supabase.from('profiles').select('*').eq('id', userId).maybeSingle());
}

/** Saves name, interests and goals. Pass complete=true on the final step. */
export async function saveOnboarding(userId, { displayName, interests, goals }, complete = false) {
  return check(await supabase.from('profiles').upsert({
    id: userId,
    display_name: displayName.trim(),
    interests,
    goals,
    ...(complete ? { onboarded_at: new Date().toISOString() } : {})
  }).select().single());
}

// ---- Manual weekly availability ----

export async function loadWeeklyBusy() {
  return check(await supabase.from('weekly_busy').select('id, weekday, start_time, end_time, label').order('weekday').order('start_time'));
}

/** Adds one row per selected weekday. */
export async function addWeeklyBusy(userId, { weekdays, start_time, end_time, label }) {
  const rows = weekdays.map(weekday => ({ user_id: userId, weekday, start_time, end_time, label: label?.trim() || null }));
  return check(await supabase.from('weekly_busy').insert(rows).select('id, weekday, start_time, end_time, label'));
}

export async function deleteWeeklyBusy(id) {
  check(await supabase.from('weekly_busy').delete().eq('id', id));
}

// ---- Google Calendar ----

const RETURN_KEY = 'togo:onboarding-return';

/**
 * Sends the user to Google to share free/busy access. The first time, it links
 * Google to the current ToGo account. Once Google is linked, it signs in with
 * that Google identity instead (same ToGo account) to get a fresh access token;
 * linking again would fail with "identity already exists".
 */
export async function connectGoogleCalendar() {
  try { localStorage.setItem(RETURN_KEY, 'calendar'); } catch { /* storage unavailable */ }
  const options = {
    scopes: GOOGLE_SCOPES,
    redirectTo: window.location.origin + window.location.pathname,
    queryParams: { prompt: 'consent', include_granted_scopes: 'true' }
  };
  const { data } = await supabase.auth.getUserIdentities();
  const alreadyLinked = data?.identities?.some(i => i.provider === 'google');
  const { error } = alreadyLinked
    ? await supabase.auth.signInWithOAuth({ provider: 'google', options })
    : await supabase.auth.linkIdentity({ provider: 'google', options });
  if (error) throw error;
}

/**
 * Reads an auth error Supabase put in the URL after a Google redirect, removes
 * it from the address bar, and returns a friendly message (or '').
 */
export function consumeAuthRedirectError() {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.slice(1));
  const code = params.get('error_code') || params.get('error');
  if (!code) return '';
  window.history.replaceState(null, '', window.location.pathname);
  if (code === 'identity_already_exists') return 'That Google account is already linked to ToGo. Tap Connect again to refresh your calendar.';
  if (code === 'manual_linking_disabled') return 'Google linking is turned off in Supabase. Turn on “Allow manual linking” in Authentication settings.';
  if (code === 'access_denied') return 'Google access wasn’t granted. Tap Connect and allow calendar access.';
  return params.get('error_description')?.replace(/\+/g, ' ') || 'Google sign-in didn’t finish. Try connecting again.';
}

/** True once, right after returning from the Google redirect. */
export function consumeGoogleReturn() {
  try {
    const value = localStorage.getItem(RETURN_KEY);
    localStorage.removeItem(RETURN_KEY);
    return value === 'calendar';
  } catch { return false; }
}

/** Pulls busy times from Google and replaces the previously synced set. */
export async function syncGoogleBusy(userId, providerToken) {
  const { blocks, calendars } = await fetchGoogleBusy(providerToken);
  check(await supabase.from('busy_blocks').delete().eq('user_id', userId).eq('source', 'google'));
  if (blocks.length) check(await supabase.from('busy_blocks').insert(blocks.map(b => ({ ...b, user_id: userId, source: 'google' }))));
  return { blocks, calendars };
}

// ---- Busy blocks (Google, calendar link, and one-off manual blocks) ----

export async function loadBusyBlocks() {
  return check(await supabase.from('busy_blocks').select('id, starts_at, ends_at, source, label').gt('ends_at', new Date().toISOString()).order('starts_at'));
}

export async function addManualBlock(userId, { starts_at, ends_at, label }) {
  return check(await supabase.from('busy_blocks').insert({ user_id: userId, starts_at, ends_at, label: label?.trim() || null, source: 'manual' }).select('id, starts_at, ends_at, source, label').single());
}

export async function deleteBusyBlock(id) {
  check(await supabase.from('busy_blocks').delete().eq('id', id));
}

// ---- Calendar link (Apple iCloud, Google, Outlook) ----

export async function loadCalendarFeed() {
  return check(await supabase.from('calendar_feeds').select('provider, last_synced_at, last_error').maybeSingle());
}

/**
 * Calls the sync-calendar-feed function. Pass {url} to save a new link,
 * {remove: true} to disconnect, or nothing to re-sync the saved link.
 */
export async function syncCalendarFeed(body = {}) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.functions.invoke('sync-calendar-feed', { body: { ...body, timeZone } });
  if (error) {
    let message = 'Calendar sync failed. Try again.';
    try { message = (await error.context.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return data;
}

/** Re-syncs a saved calendar link if it's older than `maxAgeHours`. Never throws. */
export async function refreshCalendarFeedIfStale(maxAgeHours = 6) {
  try {
    const feed = await loadCalendarFeed();
    if (!feed) return;
    const age = Date.now() - new Date(feed.last_synced_at || 0).getTime();
    if (age > maxAgeHours * 3600000) await syncCalendarFeed();
  } catch { /* background refresh; errors show on the availability screen */ }
}

// ---- Matching inputs ----

export async function loadMatchInputs() {
  const [games, roster] = await Promise.all([
    supabase.from('games').select('*').eq('status', 'scheduled').gt('starts_at', new Date().toISOString()).order('starts_at'),
    supabase.from('game_participants').select('game_id, user_id')
  ]);
  return { games: check(games), roster: check(roster) };
}
