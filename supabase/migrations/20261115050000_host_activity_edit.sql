-- Serialize edits with join/leave and publish changes in the same transaction.
create function public.update_game(p_game_id uuid,p_title text,p_sport text,p_venue text,p_starts_at timestamptz,p_capacity integer,p_description text,p_status text,p_image_url text,p_cover_color text)
returns public.games language plpgsql security definer set search_path=public as $$
declare
 old_game games%rowtype;
 updated games%rowtype;
 changes text[] := array[]::text[];
 field text;
 label text;
 before_value text;
 after_value text;
 summary text;
 offset_index integer;
begin
 select * into old_game from games where id=p_game_id for update;
 if auth.uid() is null or not found or old_game.host_id<>auth.uid() then raise exception 'Only the host can edit this activity'; end if;
 if p_title is null or length(trim(p_title)) not between 1 and 100
 or p_sport is null or length(trim(p_sport)) not between 1 and 80
 or p_venue is null or length(trim(p_venue)) not between 1 and 120
 or p_description is null or length(p_description)>10000
 or p_starts_at is null or p_capacity is null or p_capacity not between 2 and 100
 or p_status is null or p_status not in ('scheduled','canceled') then
 raise exception 'Check the activity information and try again'; end if;
 if p_starts_at is distinct from old_game.starts_at and p_starts_at<=now() then raise exception 'Choose a future start time'; end if;
 if p_status='scheduled' and old_game.status='canceled' and p_starts_at<=now() then raise exception 'Choose a future start time to reopen this activity'; end if;
 if p_capacity<(select count(*) from game_participants where game_id=p_game_id) then raise exception 'Capacity cannot be below the current participant count'; end if;
 update games set title=trim(p_title),sport=trim(p_sport),venue=trim(p_venue),starts_at=p_starts_at,capacity=p_capacity,description=p_description,status=p_status,image_url=p_image_url,cover_color=p_cover_color where id=p_game_id returning * into updated;
 foreach field in array array['title','sport','venue','starts_at','capacity','description','status','image_url','cover_color'] loop
  before_value=to_jsonb(old_game)->>field;
  after_value=to_jsonb(updated)->>field;
  if before_value is distinct from after_value then
   label=case field when 'sport' then 'Activity type' when 'venue' then 'Location' when 'starts_at' then 'Date/time (UTC)' when 'capacity' then 'Max spots' when 'image_url' then 'Cover photo' when 'cover_color' then 'Background color' else initcap(field) end;
   if field='image_url' then
    changes=array_append(changes,label||': '||case when after_value is null then 'removed' when before_value is null then 'added' else 'replaced' end);
   else
    changes=array_append(changes,label||': '||coalesce(nullif(before_value,''),'(empty)')||' → '||coalesce(nullif(after_value,''),'(empty)'));
   end if;
  end if;
 end loop;
 if cardinality(changes)>0 then
  summary='Activity updated by the host:'||E'\n'||array_to_string(changes,E'\n');
  -- Messages retain the existing 1,000-character limit, including long descriptions.
  offset_index=1;
  while offset_index<=length(summary) loop
   if length(trim(substring(summary from offset_index for 1000)))>0 then
    insert into game_messages(game_id,sender_id,body) values(p_game_id,auth.uid(),substring(summary from offset_index for 1000));
   end if;
   offset_index=offset_index+1000;
  end loop;
 end if;
 return updated;
end $$;
revoke all on function public.update_game(uuid,text,text,text,timestamptz,integer,text,text,text,text) from public,anon;
grant execute on function public.update_game(uuid,text,text,text,timestamptz,integer,text,text,text,text) to authenticated;
