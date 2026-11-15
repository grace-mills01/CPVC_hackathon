-- Personal "ToGo calendar" feed: a secret link each user can subscribe to in
-- Google, Apple, or Outlook Calendar so the activities they join or host show up
-- automatically. Anyone with the link can see those activities, so it's random,
-- owner-only, and can be reset (delete the row and a new one is made).

create table public.calendar_feed_tokens (
  user_id uuid primary key default auth.uid() references public.profiles on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);
alter table public.calendar_feed_tokens enable row level security;
create policy calendar_feed_tokens_read on public.calendar_feed_tokens for select to authenticated using (user_id = auth.uid());
create policy calendar_feed_tokens_insert on public.calendar_feed_tokens for insert to authenticated with check (user_id = auth.uid());
create policy calendar_feed_tokens_delete on public.calendar_feed_tokens for delete to authenticated using (user_id = auth.uid());
