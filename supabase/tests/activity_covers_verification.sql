-- Read-only production configuration check. Every value should be true.
select
 (select count(*) = 2 from information_schema.columns
  where table_schema = 'public' and table_name = 'games'
    and column_name in ('image_url', 'cover_color')) as cover_fields_present,
 exists(select 1 from storage.buckets where id = 'activity-covers'
   and public and file_size_limit = 5242880
   and allowed_mime_types @> array['image/jpeg','image/png','image/webp']) as bucket_configured,
 (select count(*) = 3 from pg_policies where schemaname = 'storage'
   and tablename = 'objects' and policyname in
   ('activity covers public read','activity covers own insert','activity covers own delete')) as storage_policies_present,
 exists(select 1 from supabase_migrations.schema_migrations
   where version = '20261115000000') as migration_recorded,
 to_regprocedure('public.create_game(text,text,text,timestamptz,integer,text,text,text)') is not null as rpc_present,
 has_function_privilege('authenticated',
   'public.create_game(text,text,text,timestamptz,integer,text,text,text)', 'EXECUTE') as members_can_create,
 not has_function_privilege('anon',
   'public.create_game(text,text,text,timestamptz,integer,text,text,text)', 'EXECUTE') as anonymous_create_blocked;
