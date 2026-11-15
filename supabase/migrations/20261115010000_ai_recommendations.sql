-- AI recommendations ("For you") and in-app notifications.

-- Cached meaning-vectors for activities, made by Supabase's built-in gte-small
-- model. Only the recommend function (service role) reads or writes these.
create table public.activity_embeddings (
  game_id uuid primary key references public.games on delete cascade,
  content_hash text not null,
  embedding real[] not null,
  updated_at timestamptz not null default now()
);
alter table public.activity_embeddings enable row level security;

-- The latest picks for each user, with the AI-written reason.
create table public.recommendations (
  user_id uuid not null references public.profiles on delete cascade,
  game_id uuid not null references public.games on delete cascade,
  rank smallint not null,
  fit smallint not null check (fit between 0 and 100),
  reason text not null check (char_length(reason) <= 300),
  source text not null check (source in ('ai', 'rules')),
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.recommendations enable row level security;
create policy recommendations_read on public.recommendations for select to authenticated using (user_id = auth.uid());

-- When picks were last computed and from what inputs, so the AI isn't re-run
-- on every page load.
create table public.recommendation_runs (
  user_id uuid primary key references public.profiles on delete cascade,
  input_hash text not null,
  model text,
  computed_at timestamptz not null default now()
);
alter table public.recommendation_runs enable row level security;

-- "Not for me" feedback; dismissed activities are never suggested again and
-- are shown to the AI as things this user passed on.
create table public.recommendation_feedback (
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  game_id uuid not null references public.games on delete cascade,
  verdict text not null default 'dismissed' check (verdict in ('dismissed')),
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
alter table public.recommendation_feedback enable row level security;
create policy recommendation_feedback_read on public.recommendation_feedback for select to authenticated using (user_id = auth.uid());
create policy recommendation_feedback_insert on public.recommendation_feedback for insert to authenticated with check (user_id = auth.uid());
create policy recommendation_feedback_delete on public.recommendation_feedback for delete to authenticated using (user_id = auth.uid());

-- In-app notifications. Created by the recommend function; users can read
-- their own and mark them read (read_at only).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('new_match', 'filling_up')),
  game_id uuid not null references public.games on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, game_id, kind)
);
create index notifications_user_created on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
