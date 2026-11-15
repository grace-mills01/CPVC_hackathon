# ToGo production

Source of truth: `grace-mills01/CPVC_hackathon`, branch `main`.
Live URL: https://togo-social-calpoly.cometherring2.chatgpt.site
Sites project: `appgprj_6af8a7f588e481919a944d61b813243f`.

GitHub CI currently checks tests and builds only. It does not deploy. Sites uses a separate source repository and requires an authenticated save-version/deploy operation. The available Sites connector does not offer a persistent GitHub push-triggered deployment connection. Never claim that pushing main automatically publishes the Site.

For every live-app change:

1. Fetch `origin/main` and use its committed source, excluding unrelated working-tree changes.
2. Open this existing Site with the Sites skill source helper and fresh source credentials. Preserve `.openai/hosting.json`, ignored local environment configuration, and audience.
3. Synchronize the application source from the selected main commit into the Site checkout. Record the GitHub commit in `.openai/github-source.json` so the publication can be traced to main. Do not copy Git metadata, credentials, or node_modules.
4. Run tests and the production build. Use the Sites source helper to push the exact source state and package its build.
5. Save that archive-backed version, deploy it, and wait for a successful deployment result.
6. Report the deployed URL and any verification limits. A push or saved version alone is incomplete.

Fully automatic deployment of changes made outside Codex still needs a supported persistent hosting integration. Short-lived Site credentials must not be stored in GitHub Actions or committed.

## Password reset email setup

In Supabase Authentication → URL Configuration, set the Site URL to the live ToGo URL and allow `https://togo-social-calpoly.cometherring2.chatgpt.site/?reset=1` as a redirect URL. Add the equivalent local URL when testing locally. The app sends this URL through `resetPasswordForEmail`; the default Supabase Reset Password email template must retain its `{{ .ConfirmationURL }}` link so Supabase verifies the token before redirecting. Custom templates should preserve that verification flow.

The recovery screen uses the existing application entry point (`?reset=1`) so static hosting needs no new route rewrite. Test with a real account: request email, open the newest link, reject mismatched passwords, submit matching passwords, then sign out and sign in with the new password. Also check expired or reused links. Email delivery and redirect configuration must be verified against the deployed Supabase project; local unit tests do not send email.

## Activity cover database setup

Before publishing code that uploads activity photos, apply `supabase/migrations/20261115000000_activity_covers.sql` to the target Supabase project. Site publishing does not apply SQL migrations. Prefer the Supabase migration workflow; if applying manually, run the migration and its migration-history insert in one transaction. Do not rerun this non-idempotent migration against an already migrated database.

Applied to production project `qdgzzbczlunkumerlbbh` on November 14, 2026, in one transaction, including the original migration SQL in `supabase_migrations.schema_migrations` under version `20261115000000` and name `activity_covers`. PostgREST schema reload was requested. Verified both `games` cover fields, the public `activity-covers` bucket (5 MB; JPEG, PNG, WebP), all three storage policies, and the eight-argument `create_game` RPC. No existing game rows were modified.

Run `supabase/tests/activity_covers_verification.sql` in the SQL Editor after applying the migration. Every check should return `true`. This inspects database configuration; an authenticated browser upload and event creation remain a separate end-to-end check.
