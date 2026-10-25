-- §3.10 post-migration checks — READ-ONLY. Never apply as a migration (name has no numeric prefix on purpose).
-- Run in the SQL editor after 0001..0005. Expected values in trailing comments.

select version();                                                     -- ≥ 15
select tablename, rowsecurity from pg_tables where tablename like 'ws\_%' order by 1;   -- all true
select count(*) from public.ws_template_modules;                      -- 16  (6 corewise-6-sessions + 5 hackathon-day + 5 corporate-half-day)
select public.ws_whoami();                                            -- as Ariel: staff.role = owner
-- Supabase advisors (security + performance) must show nothing new for ws_*

-- ── extra checks added 2026-10-18 ──
select count(*) from public.ws_modules;                                  -- 42 (17 §3.9 stubs + 25 curriculum)
select slug, format, is_default from public.ws_curriculum_templates order by 1;  -- 3 rows; 2 defaults (sessions, hackathon)
select t.slug, count(*) from public.ws_template_modules tm join public.ws_curriculum_templates t on t.id = tm.template_id
 group by 1 order by 1;                                                   -- 6 / 5 / 5
select role, email from public.ws_staff order by role;                   -- owner = arielohayon3@gmail.com

-- every ws_ function: security definer ones must carry search_path
select p.proname, p.prosecdef, p.proconfig
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname like 'ws\_%'
 order by 1;                                                              -- prosecdef=true ⇒ proconfig has search_path=public, pg_temp

-- anon must hold NO table privilege on ws_* and EXECUTE only on ws_verify_certificate
select table_name, privilege_type from information_schema.role_table_grants
 where grantee = 'anon' and table_schema = 'public' and table_name like 'ws\_%';   -- 0 rows
select routine_name from information_schema.role_routine_grants
 where grantee = 'anon' and specific_schema = 'public' and routine_name like 'ws\_%';  -- only ws_verify_certificate
select routine_name from information_schema.role_routine_grants
 where grantee = 'authenticated' and specific_schema = 'public' and routine_name like 'ws\_internal%';  -- 0 rows

-- policies per table (every ws_ table has ≥1; ws_certificates and ws_events have select only)
select tablename, count(*) from pg_policies where schemaname = 'public' and tablename like 'ws\_%' group by 1 order by 1;
select policyname from pg_policies where schemaname = 'storage' and policyname like 'ws\_private%';   -- 7 rows
select id, public, file_size_limit from storage.buckets where id = 'ws-private';          -- 1 row, public=false

-- the one sc_* assumption the RPCs could not verify from code (see README doubts)
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'sc_models' and column_name in ('class_stats','honest_val','scope','classes');
-- if class_stats is missing, group stats still work (to_jsonb(m)->'class_stats' is null); nothing breaks.
