-- Calendar sync: subscribe to an Apple/Google/Outlook calendar link, and let
-- users block out one-off times by hand. Busy times only; never event details.

-- busy_blocks now holds three sources:
--   google  synced once via Google sign-in (free/busy API)
--   feed    synced from a calendar link by the sync-calendar-feed function
--   manual  one-off times the user blocks out themselves
alter table public.busy_blocks drop constraint busy_blocks_source_check;
alter table public.busy_blocks
  add constraint busy_blocks_source_check check (source in ('google', 'feed', 'manual')),
  add column label text check (char_length(label) <= 60);

-- One calendar link per user. The link itself can reveal event details, so it is
-- readable only by its owner and only busy times are copied out of it.
create table public.calendar_feeds (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  provider text not null check (provider in ('apple', 'google', 'outlook')),
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 300),
  created_at timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;
create policy calendar_feeds_read on public.calendar_feeds for select to authenticated using (user_id = auth.uid());
create policy calendar_feeds_insert on public.calendar_feeds for insert to authenticated with check (user_id = auth.uid());
create policy calendar_feeds_update on public.calendar_feeds for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy calendar_feeds_delete on public.calendar_feeds for delete to authenticated using (user_id = auth.uid());
