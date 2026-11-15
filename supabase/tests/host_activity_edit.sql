-- Run against a migrated development database. All fixtures roll back.
begin;
insert into auth.users(id) values ('10000000-0000-0000-0000-000000000001'),('10000000-0000-0000-0000-000000000002'),('10000000-0000-0000-0000-000000000003');
insert into public.profiles(id,display_name) values ('10000000-0000-0000-0000-000000000001','Host'),('10000000-0000-0000-0000-000000000002','Guest'),('10000000-0000-0000-0000-000000000003','Guest 2');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare gid uuid; g public.games; message_count integer;
begin
 gid=public.create_game('Original','Coffee','Library',now()+interval '1 day',4,'Original details');
 insert into public.game_participants(game_id,user_id) values (gid,'10000000-0000-0000-0000-000000000002'),(gid,'10000000-0000-0000-0000-000000000003');
 select * into g from public.games where id=gid;
 perform public.update_game(gid,'Updated',g.sport,'Union',g.starts_at,4,g.description,g.status,g.image_url,g.cover_color);
 if not exists(select 1 from public.game_messages where game_id=gid and body like '%Title: Original → Updated%' and body like '%Location: Library → Union%') then raise exception 'Missing change summary'; end if;
 select count(*) into message_count from public.game_messages where game_id=gid;
 select * into g from public.games where id=gid;
 perform public.update_game(gid,g.title,g.sport,g.venue,g.starts_at,g.capacity,g.description,g.status,g.image_url,g.cover_color);
 if (select count(*) from public.game_messages where game_id=gid)<>message_count then raise exception 'No-op created notification'; end if;
 begin
  perform public.update_game(gid,'Should roll back',g.sport,g.venue,g.starts_at,2,g.description,g.status,g.image_url,g.cover_color);
  raise exception 'Capacity validation failed';
 exception when raise_exception then
  if sqlerrm<>'Capacity cannot be below the current participant count' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
 begin
  perform public.update_game(gid,'Unauthorized',g.sport,g.venue,g.starts_at,4,g.description,g.status,g.image_url,g.cover_color);
  raise exception 'Authorization failed';
 exception when raise_exception then
  if sqlerrm<>'Only the host can edit this activity' then raise; end if;
 end;
 if (select title from public.games where id=gid)<>'Updated' or (select count(*) from public.game_messages where game_id=gid)<>message_count then raise exception 'Failed edit changed data'; end if;
end $$;
rollback;
