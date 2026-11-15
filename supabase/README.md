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

## AI recommendations and notifications

`migrations/20261115010000_ai_recommendations.sql` adds `recommendations`, `recommendation_runs`, `recommendation_feedback` ("Not for me"), `activity_embeddings`, and `notifications`. The `recommend` edge function (JWT on) builds each user's "For you" picks:

1. Filters out activities the user can't make (busy times, full, joined, hosting, dismissed).
2. Scores the rest by meaning with Supabase's built-in `gte-small` embedding model (no API key, no cost), plus interest and goal signals. Activity embeddings are cached.
3. Sends the top 8 to an LLM on Groq to re-rank and write one-line reasons, if `GROQ_API_KEY` is set. Otherwise it uses rule-based reasons.
4. Caches picks for 30 minutes unless inputs change, and creates notifications for strong new matches and nearly-full activities.

To turn on AI-written reasons, create a free key at console.groq.com, then in Supabase go to **Edge Functions → Secrets** and add `GROQ_API_KEY`. Optional: `GROQ_MODEL` to force a model. By default it tries `openai/gpt-oss-120b`, then `openai/gpt-oss-20b`, then asks Groq which chat models are available, since Groq retires models over time. The LLM receives the user's first name, interests, goals, and activity details only.

## Cal Poly–only sign-up

`migrations/20261115020000_calpoly_signup.sql` adds `public.hook_calpoly_signup`, a Supabase Auth **Before User Created** hook. It allows `@calpoly.edu` emails, plus anything in `public.signup_allowlist`, and rejects every other sign-up with "ToGo is for Cal Poly students. Please sign up with your @calpoly.edu email." Existing accounts keep working. Because email confirmation is on, a new account proves the person owns that Cal Poly inbox.

**Turn it on:** Dashboard → **Authentication → Hooks → Before User Created** → choose **Postgres** → function `public.hook_calpoly_signup` → Save. To turn it off, disable the hook there.

**Allow a teammate, judge, or test domain** (SQL editor):

```sql
insert into public.signup_allowlist (entry, note) values ('judge@gmail.com', 'CPVC judge');
insert into public.signup_allowlist (entry, note) values ('@example.com', 'test accounts');
```
