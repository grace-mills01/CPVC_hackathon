# Supabase setup

Create a Supabase project, then run `migrations/20261114000000_initial.sql` in its SQL editor. In Authentication settings, configure the production site URL and allowed redirect URLs. Copy the project URL and publishable key into `.env` using `.env.example`; never place a secret/service-role key in the browser. Email confirmation is enabled according to your project's Auth settings.

The migration creates profiles, games, participant rosters, and messages with row-level security. The create/join/leave functions use transactions; joining locks the game row to protect capacity. Test these policies and concurrent joins against a real Supabase instance before production use. This first iteration does not yet provide host cancellation, editing, or account deletion.

## Onboarding and calendar matching

Run `migrations/20261114010000_social_profiles.sql` and then `migrations/20261114020000_onboarding.sql`. The second adds `interests`, `goals`, and `onboarded_at` to profiles, plus two owner-only tables: `busy_blocks` (times synced from Google Calendar) and `weekly_busy` (weekly busy times users enter by hand). No event titles or details are stored.

To enable **Connect Google Calendar**:

1. In Google Cloud Console, create an OAuth client (Web application), enable the **Google Calendar API**, and add the `https://www.googleapis.com/auth/calendar.freebusy` scope to the OAuth consent screen. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorized redirect URI.
2. In Supabase → Authentication → Providers, enable Google with that client ID and secret.
3. In Supabase → Authentication → Settings, turn on **Manual linking** so email/password users can link Google to their existing account.
4. Add the app's URL to the allowed redirect URLs.

Google returns a short-lived access token right after the redirect; the app uses it once to sync the next four weeks of busy times. Users press **Sync again** to refresh. Manual weekly entries work without any of this setup.

## Calendar links (Apple, Google, Outlook)

`migrations/20261114030000_calendar_sync.sql` adds `calendar_feeds` (one link per user, owner-only) and lets `busy_blocks` hold `feed` and `manual` rows. The `sync-calendar-feed` edge function (`functions/sync-calendar-feed`) fetches a user's link, keeps only busy start/end times for the next 30 days, and replaces their `feed` rows. It runs with the caller's JWT, so RLS applies, and it only fetches iCloud, Google Calendar, and Outlook hosts.

Deploy it with `supabase functions deploy sync-calendar-feed` (JWT verification on). No secrets are needed. The app re-syncs a saved link in the background when it's more than 6 hours old.
