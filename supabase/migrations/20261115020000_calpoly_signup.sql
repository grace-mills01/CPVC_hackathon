-- Only Cal Poly students can create accounts: @calpoly.edu emails, plus an
-- allowlist for teammates, judges, and test accounts. Runs as a Supabase Auth
-- "Before User Created" hook, so it covers email sign-up and new Google sign-ins.
-- Existing accounts are not affected. Email confirmation proves the person owns
-- the inbox.
--
-- Turn it on in the dashboard: Authentication → Hooks → Before User Created →
-- Postgres function → public.hook_calpoly_signup.

create table public.signup_allowlist (
  -- A full email ("judge@gmail.com") or a whole domain ("@example.com").
  entry text primary key check (entry = lower(entry) and entry ~ '^[^@\s]*@[^@\s]+\.[^@\s]+$'),
  note text,
  created_at timestamptz not null default now()
);
alter table public.signup_allowlist enable row level security;
-- No policies for app users: the list is not readable or editable from the app.

create or replace function public.hook_calpoly_signup(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  email text := lower(trim(event->'user'->>'email'));
  domain text := '@' || split_part(email, '@', 2);
begin
  if email like '%@calpoly.edu'
     or exists (select 1 from public.signup_allowlist a where a.entry in (email, domain)) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'ToGo is for Cal Poly students. Please sign up with your @calpoly.edu email.'
  ));
end;
$$;

-- Only Supabase Auth may run the hook or read the allowlist.
revoke execute on function public.hook_calpoly_signup(jsonb) from public, anon, authenticated;
grant execute on function public.hook_calpoly_signup(jsonb) to supabase_auth_admin;
grant select on public.signup_allowlist to supabase_auth_admin;
create policy signup_allowlist_auth_admin on public.signup_allowlist for select to supabase_auth_admin using (true);
