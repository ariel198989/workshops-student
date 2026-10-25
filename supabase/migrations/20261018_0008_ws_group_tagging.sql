-- 20261018_0008_ws_group_tagging — applied 2026-10-18 as ws_0008_group_tagging +
-- ws_0009_group_tagging_apply (final state below). A student may box / relabel / reject any
-- training photo of THEIR OWN group. Smart City's RLS allows own photos only, and its
-- sc_guard_verify_update trigger reverts bbox/class_name for non-photographers (it was written
-- for city verifiers), so ws_tag_detection authorizes group membership first and
-- ws_internal_tag_apply writes with the request JWT cleared for that one statement, restored
-- right after (also on error). sc_guard_owner_update still keeps credits/detected_by/lat/lng.

create or replace function public.ws_internal_tag_apply(p_id uuid, p_bbox jsonb, p_class text, p_reject boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_claims text := current_setting('request.jwt.claims', true);
        v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    if p_reject then
      update public.sc_detections set status = 'rejected' where id = p_id;
    else
      update public.sc_detections set bbox = p_bbox, class_name = coalesce(p_class, class_name) where id = p_id;
    end if;
  exception when others then
    perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
end $$;
revoke all on function public.ws_internal_tag_apply(uuid, jsonb, text, boolean) from public, anon, authenticated;

create or replace function public.ws_tag_detection(p_id uuid, p_bbox jsonb, p_class text, p_reject boolean default false)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_team text; v_status text; v_class text := nullif(btrim(coalesce(p_class, '')), ''); v_box jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select team_name, status into v_team, v_status from public.sc_detections where id = p_id;
  if v_team is null then raise exception 'photo not found' using errcode = 'P0002'; end if;
  if not exists (
    select 1 from public.ws_participants p join public.ws_groups g on g.id = p.group_id
     where p.user_id = auth.uid() and p.status = 'active'
       and v_team in (g.team_name, 'אישי · ' || g.team_name)) then
    raise exception 'photo is not from your group' using errcode = '42501';
  end if;
  if v_status not in ('dataset', 'pending') then
    raise exception 'photo is not a training photo' using errcode = '22023';
  end if;

  if p_reject then
    perform public.ws_internal_tag_apply(p_id, null, null, true);
    return;
  end if;
  if p_bbox is null or jsonb_typeof(p_bbox) <> 'object'
     or not (p_bbox ? 'x' and p_bbox ? 'y' and p_bbox ? 'w' and p_bbox ? 'h')
     or (p_bbox->>'w')::numeric <= 0 or (p_bbox->>'h')::numeric <= 0
     or (p_bbox->>'x')::numeric < 0 or (p_bbox->>'y')::numeric < 0
     or (p_bbox->>'x')::numeric + (p_bbox->>'w')::numeric > 1.0001
     or (p_bbox->>'y')::numeric + (p_bbox->>'h')::numeric > 1.0001 then
    raise exception 'bbox must be normalized {x,y,w,h} inside the frame' using errcode = '22023';
  end if;
  if v_class is not null and (v_class ~ '[''"\n\r]' or char_length(v_class) > 40) then
    raise exception 'class names: max 40 chars, no quotes/newlines' using errcode = '22023';
  end if;
  v_box := jsonb_build_object('x', (p_bbox->>'x')::numeric, 'y', (p_bbox->>'y')::numeric,
                              'w', (p_bbox->>'w')::numeric, 'h', (p_bbox->>'h')::numeric);
  perform public.ws_internal_tag_apply(p_id, v_box, v_class, false);
end $$;

revoke all on function public.ws_tag_detection(uuid, jsonb, text, boolean) from public, anon;
grant execute on function public.ws_tag_detection(uuid, jsonb, text, boolean) to authenticated;
