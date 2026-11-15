// Calls for AI picks ("For you"), "Not for me" feedback, and in-app notifications.
import { supabase } from '../../lib/supabase.js';

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Runs (or reuses) the user's AI picks. Returns { recommendations, ai, needs_preferences }. */
export async function fetchRecommendations({ force = false } = {}) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, error } = await supabase.functions.invoke('recommend', { body: { timeZone, force } });
  if (error) {
    let message = 'Couldn’t load your picks. Pull to refresh or try again soon.';
    try { message = (await error.context.json()).error || message; } catch { /* keep default */ }
    throw new Error(message);
  }
  return data;
}

export async function dismissRecommendation(gameId) {
  check(await supabase.from('recommendation_feedback').upsert({ game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true }));
}

export async function loadNotifications() {
  return check(await supabase.from('notifications').select('id, kind, game_id, title, body, read_at, created_at').order('created_at', { ascending: false }).limit(20));
}

export async function markNotificationsRead(ids) {
  if (!ids.length) return;
  check(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids));
}
