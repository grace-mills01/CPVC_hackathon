# Supabase setup

Create a Supabase project, then run `migrations/20261114000000_initial.sql` in its SQL editor. In Authentication settings, configure the production site URL and allowed redirect URLs. Copy the project URL and publishable key into `.env` using `.env.example`; never place a secret/service-role key in the browser. Email confirmation is enabled according to your project's Auth settings.

The migration creates profiles, games, participant rosters, and messages with row-level security. The create/join/leave functions use transactions; joining locks the game row to protect capacity. Test these policies and concurrent joins against a real Supabase instance before production use. This first iteration does not yet provide host cancellation, editing, or account deletion.
