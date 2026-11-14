-- Onboarding: interests, goals, and availability used for activity matching.

alter table public.profiles
  add column interests text[] not null default '{}' check (cardinality(interests) <= 30),
  add column goals text[] not null default '{}' check (cardinality(goals) <= 10),
  add column onboarded_at timestamptz;

-- Busy times synced from Google Calendar's free/busy API. Only start/end times
-- are stored, never event titles or details, and only the owner can read them.
create table public.busy_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'google' check (source in ('google')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index busy_blocks_user_time on public.busy_blocks (user_id, starts_at);

-- Recurring weekly busy times the user enters by hand (classes, work shifts).
-- weekday: 0 = Sunday ... 6 = Saturday. Times are local wall-clock times.
create table public.weekly_busy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  label text check (char_length(label) <= 60),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index weekly_busy_user on public.weekly_busy (user_id);

alter table public.busy_blocks enable row level security;
alter table public.weekly_busy enable row level security;
create policy busy_blocks_read on public.busy_blocks for select to authenticated using (user_id = auth.uid());
create policy busy_blocks_insert on public.busy_blocks for insert to authenticated with check (user_id = auth.uid());
create policy busy_blocks_delete on public.busy_blocks for delete to authenticated using (user_id = auth.uid());
create policy weekly_busy_read on public.weekly_busy for select to authenticated using (user_id = auth.uid());
create policy weekly_busy_insert on public.weekly_busy for insert to authenticated with check (user_id = auth.uid());
create policy weekly_busy_delete on public.weekly_busy for delete to authenticated using (user_id = auth.uid());
