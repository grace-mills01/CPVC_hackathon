// The user's personal ToGo calendar feed link (for subscribing in calendar apps).
import { supabase } from '../../lib/supabase.js';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed`;

function check({ data, error }) {
  if (error) throw error;
  return data;
}

/** Returns the user's feed token, creating one the first time. */
export async function getFeedToken(userId) {
  const existing = check(await supabase.from('calendar_feed_tokens').select('token').maybeSingle());
  if (existing) return existing.token;
  return check(await supabase.from('calendar_feed_tokens').insert({ user_id: userId }).select('token').single()).token;
}

/** Makes a new link; anyone with the old one loses access. */
export async function resetFeedToken(userId) {
  check(await supabase.from('calendar_feed_tokens').delete().eq('user_id', userId));
  return getFeedToken(userId);
}

export function feedLinks(token) {
  const https = `${FUNCTION_URL}?token=${token}`;
  const webcal = https.replace(/^https:/, 'webcal:');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`
  };
}
