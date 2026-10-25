-- 20261018_0007_ws_student_join — student self-service: find a live workshop by
-- its code, then join one of its activated groups. Applied 2026-10-18.
create or replace function public.ws_find_workshop(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when auth.uid() is null then null else (
    select jsonb_build_object(
      'id', w.id, 'title', w.title, 'code', w.code, 'organization', o.name, 'status', w.status,
      'groups', coalesce((select jsonb_agg(jsonb_build_object(
          'id', g.id, 'number', g.number, 'display_name', g.display_name,
          'members', (select count(*) from public.ws_participants p where p.group_id = g.id and p.status = 'active'),
          'capacity', g.capacity) order by g.number)
        from public.ws_groups g where g.workshop_id = w.id and g.sc_class_id is not null), '[]'::jsonb))
    from public.ws_workshops w join public.ws_organizations o on o.id = w.organization_id
    where upper(w.code) = upper(btrim(p_code)) and w.status = 'live') end;
$$;

create or replace function public.ws_join_group(p_code text, p_group uuid, p_full_name text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_w public.ws_workshops; v_g public.ws_groups; v_p public.ws_participants;
        v_name text := left(btrim(coalesce(p_full_name, '')), 80);
begin
  if v_uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if char_length(v_name) < 2 then raise exception 'full name required' using errcode = '22023'; end if;
  select * into v_w from public.ws_workshops where upper(code) = upper(btrim(p_code)) and status = 'live';
  if not found then raise exception 'workshop not found or not live' using errcode = 'P0002'; end if;
  select * into v_g from public.ws_groups where id = p_group and workshop_id = v_w.id and sc_class_id is not null;
  if not found then raise exception 'group not in this workshop' using errcode = '22023'; end if;

  select * into v_p from public.ws_participants where workshop_id = v_w.id and user_id = v_uid;
  if found then
    -- already joined: only an instructor moves students between groups
    if v_p.group_id is not null and v_p.group_id <> v_g.id then
      raise exception 'already in another group; ask your instructor to move you' using errcode = '23505';
    end if;
    update public.ws_participants set group_id = v_g.id, status = 'active',
           full_name = case when source = 'signup' then v_name else full_name end,
           joined_at = coalesce(joined_at, now())
     where id = v_p.id returning * into v_p;
  else
    insert into public.ws_participants (workshop_id, group_id, user_id, full_name, source, status, joined_at)
    values (v_w.id, v_g.id, v_uid, v_name, 'signup', 'active', now()) returning * into v_p;
  end if;

  perform public.ws_internal_set_user_team(v_uid, v_g.team_name);
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_w.id, 'participant.joined', 'ws_participants', v_p.id,
          jsonb_build_object('group', v_g.number, 'team_name', v_g.team_name));
  return jsonb_build_object('workshop_id', v_w.id, 'participant_id', v_p.id, 'group_id', v_g.id, 'team_name', v_g.team_name);
end $$;

revoke all on function public.ws_find_workshop(text) from public, anon;
revoke all on function public.ws_join_group(text, uuid, text) from public, anon;
grant execute on function public.ws_find_workshop(text) to authenticated;
grant execute on function public.ws_join_group(text, uuid, text) to authenticated;
