-- 20261018_0006_ws_hardening — Supabase advisor follow-up: pin search_path on the
-- non-definer ws_ helpers, and hide trigger functions from the RPC surface
-- (EXECUTE is checked only when a trigger is created, never when it fires).
alter function public.ws_touch_updated_at() set search_path = public, pg_temp;
alter function public.ws_try_uuid(text) set search_path = public, pg_temp;
alter function public.ws_is_service() set search_path = public, pg_temp;
alter function public.ws_modules_bump_version() set search_path = public, pg_temp;
alter function public.ws_workshops_guard() set search_path = public, pg_temp;
alter function public.ws_subproblems_normalize() set search_path = public, pg_temp;
alter function public.ws_groups_defaults() set search_path = public, pg_temp;
alter function public.ws_groups_guard() set search_path = public, pg_temp;
alter function public.ws_participants_capacity() set search_path = public, pg_temp;

revoke execute on function public.ws_touch_updated_at() from authenticated;
revoke execute on function public.ws_modules_bump_version() from authenticated;
revoke execute on function public.ws_workshops_guard() from authenticated;
revoke execute on function public.ws_subproblems_normalize() from authenticated;
revoke execute on function public.ws_groups_defaults() from authenticated;
revoke execute on function public.ws_groups_guard() from authenticated;
revoke execute on function public.ws_participants_capacity() from authenticated;
revoke execute on function public.ws_attendance_mark_session() from authenticated;
revoke execute on function public.ws_deliverables_guard() from authenticated;
revoke execute on function public.ws_guard_staff() from authenticated;
