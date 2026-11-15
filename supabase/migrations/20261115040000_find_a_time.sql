-- "Find the best time": cached meaning-vectors for profiles (interests + goals),
-- made by Supabase's built-in gte-small model. Only the suggest-times function
-- (service role) reads or writes them; the app never sees them.
create table public.profile_embeddings (
  user_id uuid primary key references public.profiles on delete cascade,
  content_hash text not null,
  embedding real[] not null,
  updated_at timestamptz not null default now()
);
alter table public.profile_embeddings enable row level security;
