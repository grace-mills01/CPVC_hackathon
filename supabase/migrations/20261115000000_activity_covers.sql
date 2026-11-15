alter table public.games add column image_url text;
alter table public.games add column cover_color text check (cover_color in ('#315E5C','#CA5323','#D086AB','#EEEDD9','#E6B545'));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('activity-covers','activity-covers',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy "activity covers public read" on storage.objects for select using (bucket_id='activity-covers');
create policy "activity covers own insert" on storage.objects for insert to authenticated with check (bucket_id='activity-covers' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "activity covers own delete" on storage.objects for delete to authenticated using (bucket_id='activity-covers' and (storage.foldername(name))[1]=auth.uid()::text);
drop function public.create_game(text,text,text,timestamptz,integer,text);
create function public.create_game(p_title text,p_sport text,p_venue text,p_starts_at timestamptz,p_capacity integer,p_description text,p_image_url text default null,p_cover_color text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare gid uuid;
begin
 if auth.uid() is null or p_starts_at <= now() then raise exception 'Sign in and choose a future time'; end if;
 insert into games(host_id,title,sport,venue,starts_at,capacity,description,image_url,cover_color) values(auth.uid(),p_title,p_sport,p_venue,p_starts_at,p_capacity,p_description,p_image_url,p_cover_color) returning id into gid;
 insert into game_participants(game_id,user_id) values(gid,auth.uid());
 return gid;
end $$;
revoke all on function public.create_game(text,text,text,timestamptz,integer,text,text,text) from public, anon;
grant execute on function public.create_game(text,text,text,timestamptz,integer,text,text,text) to authenticated;
