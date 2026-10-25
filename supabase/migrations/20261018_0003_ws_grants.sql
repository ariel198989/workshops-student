-- 20261018_0003_ws_grants — §3.7 privileges. Requires 0002 (revokes name specific ws_internal_* signatures).
-- Re-run the function block after any future migration that adds a ws_ function.
-- Source: workshops-os-plan/architecture.md §3 (2026-10-17). Generated 2026-10-18 by
-- build_ws_migrations.py; SQL is the doc's text verbatim except the fixes listed in README.md.
-- Target: Supabase project eaawnjvabcnznukewnlj, PostgreSQL 17.6. Additive only: no DDL on sc_*, profiles, auth.*.
-- tables: no anon at all
do $$ declare t text; begin
  foreach t in array array['ws_staff','ws_organizations','ws_contacts','ws_field_definitions','ws_modules',
    'ws_curriculum_templates','ws_template_modules','ws_workshops','ws_workshop_staff','ws_sessions',
    'ws_session_modules','ws_problems','ws_subproblems','ws_groups','ws_participants','ws_attendance',
    'ws_deliverables','ws_certificates','ws_events'] loop
    execute format('revoke all on table public.%I from anon', t);
  end loop;
end $$;
revoke all on sequence public.ws_certificate_seq from anon, authenticated;

-- column-level: status changes and team identity only via RPC
revoke insert, update on public.ws_workshops from authenticated;
grant insert (organization_id, code, team_prefix, title, format, template_id, starts_on, ends_on, timezone,
              sector, grade_level, class_label, homeroom_teacher, audience_size, group_size, location,
              device_mode, tablets_count, sc_campaign_id, custom_fields, notes)
  on public.ws_workshops to authenticated;
grant update (organization_id, code, team_prefix, title, format, template_id, starts_on, ends_on, timezone,
              sector, grade_level, class_label, homeroom_teacher, audience_size, group_size, location,
              device_mode, tablets_count, sc_campaign_id, custom_fields, notes)
  on public.ws_workshops to authenticated;

revoke insert, update on public.ws_groups from authenticated;
grant insert (workshop_id, number, display_name, subproblem_id, capacity, color, notes) on public.ws_groups to authenticated;
grant update (display_name, subproblem_id, capacity, color, notes, status) on public.ws_groups to authenticated;

revoke insert, update on public.ws_participants from authenticated;
grant insert (workshop_id, group_id, full_name, grade, roles, status, source, media_consent, joined_at, notes, custom_fields)
  on public.ws_participants to authenticated;
grant update (full_name, grade, roles, status, media_consent, joined_at, notes, custom_fields)
  on public.ws_participants to authenticated;

revoke insert, update, delete on public.ws_certificates from authenticated;
revoke insert, update, delete on public.ws_events from authenticated;

-- functions: authenticated only; internals hidden; verification public
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'ws\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public.ws_internal_group_stats(uuid, uuid) from authenticated;
revoke execute on function public.ws_internal_set_user_team(uuid, text) from authenticated;
grant execute on function public.ws_verify_certificate(text) to anon;
