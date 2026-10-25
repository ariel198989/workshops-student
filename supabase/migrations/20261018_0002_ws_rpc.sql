-- 20261018_0002_ws_rpc — §3.6 RPCs (3.6.1–3.6.7). Requires 0001.
-- Source: workshops-os-plan/architecture.md §3 (2026-10-17). Generated 2026-10-18 by
-- build_ws_migrations.py; SQL is the doc's text verbatim except the fixes listed in README.md.
-- Target: Supabase project eaawnjvabcnznukewnlj, PostgreSQL 17.6. Additive only: no DDL on sc_*, profiles, auth.*.
-- ═══ §3.6.1 internal group stats ═══
create or replace function public.ws_internal_group_stats(p_workshop uuid, p_group uuid default null)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
with g as (
  select g.id, g.number, g.display_name, g.team_name, g.status, g.sc_class_id, g.subproblem_id,
         s.title as sub_title, s.task_type, coalesce(s.target_classes, '{}'::text[]) as target_classes,
         s.target_accuracy
  from public.ws_groups g
  left join public.ws_subproblems s on s.id = g.subproblem_id
  where g.workshop_id = p_workshop and (p_group is null or g.id = p_group)
),
gk as (      -- key table → single hash join instead of OR/IN per row
  select id as gid, team_name as k, false as personal from g
  union all
  select id, 'אישי · ' || team_name, true from g
),
d as (
  select gk.gid, gk.personal, x.class_name, x.detected_by, x.created_at,
         (x.frame_path is not null or x.crop_path is not null) as is_photo,
         (x.frame_path is not null and x.bbox is not null)     as is_tagged
  from gk join public.sc_detections x on x.team_name = gk.k
  where x.status is distinct from 'rejected'
),
dstat as (
  select gid,
    count(*) filter (where is_photo)                   as photos,
    count(*) filter (where is_tagged)                  as tagged,
    count(*) filter (where is_photo and not is_tagged) as untagged,
    count(*) filter (where is_photo and created_at >=
        (date_trunc('day', now() at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem')) as today,
    count(distinct detected_by)                        as contributors,
    max(created_at)                                    as last_photo_at
  from d group by gid
),
dcls as (
  select gid, lower(btrim(class_name)) as k, min(class_name) as name, count(*) as n
  from d where is_tagged and class_name is not null
  group by gid, lower(btrim(class_name))
),
cov as (
  select g.id as gid,
         jsonb_agg(jsonb_build_object('name', t.cls, 'tagged', coalesce(c.n, 0)) order by t.ord) as coverage,
         min(coalesce(c.n, 0)) as min_tagged
  from g
  cross join lateral unnest(g.target_classes) with ordinality as t(cls, ord)
  left join dcls c on c.gid = g.id and c.k = lower(btrim(t.cls))
  group by g.id
),
offt as (    -- classes in the data that are NOT targets → typos / scope creep
  select c.gid, jsonb_agg(jsonb_build_object('name', c.name, 'tagged', c.n) order by c.n desc) as off_target
  from dcls c join g on g.id = c.gid
  where not exists (select 1 from unnest(g.target_classes) t where lower(btrim(t)) = c.k)
  group by c.gid
),
mem as (
  select group_id as gid,
         count(*) filter (where status = 'active')                         as members,
         count(*) filter (where status = 'active' and user_id is not null) as linked
  from public.ws_participants
  where workshop_id = p_workshop and group_id is not null
  group by group_id
),
jobs as (
  select gk.gid,
    count(*) filter (where j.status = 'pending') as pending,
    count(*) filter (where j.status = 'running') as running,
    count(*) filter (where j.status = 'done')    as done,
    (array_agg(jsonb_build_object('id', j.id, 'status', j.status, 'image_count', j.image_count,
        'personal', gk.personal, 'created_at', j.created_at, 'completed_at', j.completed_at)
      order by j.created_at desc))[1] as last_job
  from gk join public.sc_training_jobs j on j.team_name = gk.k
  group by gk.gid
),
mdl as (     -- best model: team > personal, approved > not, newest
  select distinct on (gk.gid) gk.gid,
    jsonb_build_object('id', m.id, 'name', m.name, 'accuracy', m.accuracy, 'approved', m.approved,
      'scope', m.scope, 'image_count', m.image_count, 'honest_val', m.honest_val,
      'class_stats', m.class_stats, 'personal', gk.personal, 'created_at', m.created_at) as model
  from gk join public.sc_models m on m.team_name = gk.k
  where m.zip_path is not null
  order by gk.gid, gk.personal asc, m.approved desc, m.created_at desc
),
mcnt as (
  select gk.gid, count(*) as n from gk join public.sc_models m on m.team_name = gk.k group by gk.gid
),
att as (
  select p.group_id as gid,
         round(avg(case when a.status in ('present', 'late') then 1.0 else 0.0 end), 3) as rate
  from public.ws_attendance a
  join public.ws_participants p on p.id = a.participant_id
  where a.workshop_id = p_workshop and p.group_id is not null
  group by p.group_id
),
dl as (
  select group_id as gid, status, model_id, presentation_url, demo_result, demo_score, locked_at
  from public.ws_deliverables where workshop_id = p_workshop
)
select coalesce(jsonb_agg(jsonb_build_object(
    'group_id', g.id, 'number', g.number, 'display_name', g.display_name, 'team_name', g.team_name,
    'status', g.status, 'activated', g.sc_class_id is not null,
    'subproblem', case when g.subproblem_id is null then null else jsonb_build_object(
        'id', g.subproblem_id, 'title', g.sub_title, 'task_type', g.task_type,
        'target_classes', to_jsonb(g.target_classes), 'target_accuracy', g.target_accuracy) end,
    'members', coalesce(mem.members, 0), 'linked_accounts', coalesce(mem.linked, 0),
    'photos', coalesce(ds.photos, 0), 'tagged', coalesce(ds.tagged, 0), 'untagged', coalesce(ds.untagged, 0),
    'today', coalesce(ds.today, 0), 'contributors', coalesce(ds.contributors, 0), 'last_photo_at', ds.last_photo_at,
    'coverage', coalesce(cov.coverage, '[]'::jsonb),
    'off_target_classes', coalesce(offt.off_target, '[]'::jsonb),
    'readiness', case when cov.min_tagged is null then 'no_targets'
                      when cov.min_tagged < 50  then 'red'
                      when cov.min_tagged < 150 then 'ok' else 'strong' end,
    'jobs', jsonb_build_object('pending', coalesce(jobs.pending, 0), 'running', coalesce(jobs.running, 0),
                               'done', coalesce(jobs.done, 0), 'last', jobs.last_job),
    'model', mdl.model, 'models_count', coalesce(mcnt.n, 0),
    'attendance_rate', att.rate,
    'deliverable', case when dl.gid is null then null else jsonb_build_object(
        'status', dl.status, 'final_model_id', dl.model_id, 'presentation_url', dl.presentation_url,
        'demo_result', dl.demo_result, 'demo_score', dl.demo_score, 'locked', dl.locked_at is not null) end
  ) order by g.number), '[]'::jsonb)
from g
left join dstat ds on ds.gid = g.id
left join cov      on cov.gid = g.id
left join offt     on offt.gid = g.id
left join mem      on mem.gid = g.id
left join jobs     on jobs.gid = g.id
left join mdl      on mdl.gid = g.id
left join mcnt     on mcnt.gid = g.id
left join att      on att.gid = g.id
left join dl       on dl.gid = g.id;
$$;

-- ═══ §3.6.2 ws_workshop_overview ═══
create or replace function public.ws_workshop_overview(p_workshop uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_w jsonb; v_groups jsonb;
begin
  if not public.ws_is_workshop_staff(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select jsonb_build_object('id', w.id, 'title', w.title, 'code', w.code, 'status', w.status,
           'format', w.format, 'starts_on', w.starts_on, 'ends_on', w.ends_on,
           'group_size', w.group_size, 'organization', o.name)
    into v_w
    from public.ws_workshops w join public.ws_organizations o on o.id = w.organization_id
   where w.id = p_workshop;
  if v_w is null then raise exception 'workshop not found' using errcode = 'P0002'; end if;

  v_groups := public.ws_internal_group_stats(p_workshop, null);

  return jsonb_build_object(
    'workshop', v_w,
    'generated_at', now(),
    'groups', v_groups,
    'totals', (select jsonb_build_object(
        'groups', count(*),
        'members', coalesce(sum((x->>'members')::int), 0),
        'photos',  coalesce(sum((x->>'photos')::int), 0),
        'tagged',  coalesce(sum((x->>'tagged')::int), 0),
        'groups_with_model', count(*) filter (where jsonb_typeof(x->'model') = 'object'))
      from jsonb_array_elements(v_groups) x),
    'unassigned_participants', (select count(*) from public.ws_participants p
        where p.workshop_id = p_workshop and p.status = 'active' and p.group_id is null),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'session_no', s.session_no,
        'title', s.title, 'status', s.status, 'scheduled_at', s.scheduled_at) order by s.session_no), '[]'::jsonb)
      from public.ws_sessions s where s.workshop_id = p_workshop));
end $$;

-- ═══ §3.6.3 groups: create / activate / status ═══
create or replace function public.ws_activate_groups(p_workshop uuid)
returns setof public.ws_groups language plpgsql security definer set search_path = public, pg_temp as $$
declare v_g record; v_sc uuid; v_active boolean; v_used bigint;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select (status = 'live') into v_active from public.ws_workshops where id = p_workshop;
  if v_active is null then raise exception 'workshop not found' using errcode = 'P0002'; end if;

  -- descending + clock_timestamp(): Smart City sorts the signup dropdown created_at DESC → קבוצה 1 on top
  for v_g in select * from public.ws_groups
             where workshop_id = p_workshop and sc_class_id is null
             order by number desc for update loop
    perform pg_advisory_xact_lock(hashtextextended('ws_team:' || v_g.team_name, 0));
    select c.id into v_sc from public.sc_classes c where c.name = v_g.team_name order by c.created_at limit 1;
    if v_sc is not null then
      if exists (select 1 from public.ws_groups x where x.sc_class_id = v_sc) then
        raise exception 'sc_classes "%" is already linked to another group', v_g.team_name using errcode = '23505';
      end if;
      select (select count(*) from public.sc_detections
               where team_name in (v_g.team_name, 'אישי · ' || v_g.team_name))
           + (select count(*) from public.sc_models
               where team_name in (v_g.team_name, 'אישי · ' || v_g.team_name))
        into v_used;
      if v_used > 0 then
        raise exception 'team name "%" already has Smart City data — change the workshop team_prefix', v_g.team_name
          using errcode = '23505';
      end if;
      -- adopt the empty pre-existing class row
    else
      insert into public.sc_classes (name, active, created_at)
      values (v_g.team_name, v_active, clock_timestamp())
      returning id into v_sc;
    end if;

    update public.ws_groups
       set sc_class_id = v_sc, activated_at = now(),
           status = case when status = 'forming' then 'active' else status end
     where id = v_g.id;
    insert into public.ws_deliverables (workshop_id, group_id) values (p_workshop, v_g.id)
      on conflict (group_id) do nothing;
    insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
    values (p_workshop, 'group.activated', 'ws_groups', v_g.id,
            jsonb_build_object('team_name', v_g.team_name, 'sc_class_id', v_sc));
  end loop;

  return query select * from public.ws_groups where workshop_id = p_workshop order by number;
end $$;

create or replace function public.ws_create_groups(p_workshop uuid, p_count int default null,
                                                   p_activate boolean default false)
returns setof public.ws_groups language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_n int; v_max int;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = p_workshop for update;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  v_n := coalesce(p_count, ceil(coalesce(v_w.audience_size, 0)::numeric / v_w.group_size)::int);
  if v_n < 1 or v_n > 40 then
    raise exception 'group count must be 1..40 (got %) — set audience_size or pass p_count', v_n using errcode = '22023';
  end if;
  select coalesce(max(number), 0) into v_max from public.ws_groups where workshop_id = p_workshop;
  insert into public.ws_groups (workshop_id, number)
  select p_workshop, n from generate_series(v_max + 1, v_n) as n;      -- additive, never deletes
  if p_activate or v_w.status = 'live' then
    perform public.ws_activate_groups(p_workshop);
  end if;
  return query select * from public.ws_groups where workshop_id = p_workshop order by number;
end $$;

create or replace function public.ws_set_workshop_status(p_workshop uuid, p_status text)
returns public.ws_workshops language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_from text;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = p_workshop for update;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  v_from := v_w.status;
  if (v_from, p_status) not in (values
      ('draft','proposal'), ('draft','confirmed'), ('draft','cancelled'),
      ('proposal','draft'), ('proposal','confirmed'), ('proposal','cancelled'),
      ('confirmed','proposal'), ('confirmed','live'), ('confirmed','cancelled'),
      ('live','confirmed'), ('live','completed'),
      ('completed','live'), ('completed','archived'),
      ('archived','completed'), ('cancelled','draft')) then
    raise exception 'illegal status transition % -> %', v_from, p_status using errcode = '22023';
  end if;
  if p_status = 'archived' or v_from = 'archived' then
    if not public.ws_is_admin() then raise exception 'only admins archive' using errcode = '42501'; end if;
  end if;

  update public.ws_workshops set status = p_status where id = p_workshop returning * into v_w;

  if p_status = 'live' then
    perform public.ws_activate_groups(p_workshop);
  end if;
  -- signup dropdown visibility follows "live"; data/models are never touched
  update public.sc_classes c set active = (p_status = 'live')
    from public.ws_groups g
   where g.workshop_id = p_workshop and g.sc_class_id = c.id
     and c.active is distinct from (p_status = 'live');

  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'workshop.status', 'ws_workshops', p_workshop,
          jsonb_build_object('from', v_from, 'to', p_status));
  return v_w;
end $$;

-- ═══ §3.6.4 participants: reconcile / link / move ═══
create or replace function public.ws_internal_set_user_team(p_user uuid, p_team text)
returns void language sql security definer set search_path = public, pg_temp as $$
  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('class_name', p_team),
         updated_at = now()
   where id = p_user;
$$;

-- zero-touch for Smart City: whoever signed up with a group's team_name becomes a participant
create or replace function public.ws_reconcile_participants(p_workshop uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_added int; v_drift jsonb;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  with g as (
    select id, team_name from public.ws_groups where workshop_id = p_workshop and sc_class_id is not null
  ), ins as (
    insert into public.ws_participants (workshop_id, group_id, user_id, full_name, source, status, joined_at)
    select p_workshop, g.id, u.id,
           left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                         split_part(u.email, '@', 1), 'תלמיד/ה'), 80),
           'signup', 'active', u.created_at
    from auth.users u
    join g on g.team_name = u.raw_user_meta_data->>'class_name'
    where not exists (select 1 from public.ws_participants p where p.workshop_id = p_workshop and p.user_id = u.id)
      and not exists (select 1 from public.ws_staff s where s.user_id = u.id)
    on conflict do nothing
    returning 1
  )
  select count(*) into v_added from ins;

  select coalesce(jsonb_agg(jsonb_build_object('participant_id', p.id, 'full_name', p.full_name,
           'expected_team', g.team_name, 'app_team', u.raw_user_meta_data->>'class_name')), '[]'::jsonb)
    into v_drift
    from public.ws_participants p
    join public.ws_groups g on g.id = p.group_id
    join auth.users u on u.id = p.user_id
   where p.workshop_id = p_workshop and p.status = 'active'
     and (u.raw_user_meta_data->>'class_name') is distinct from g.team_name;

  return jsonb_build_object('added', v_added, 'drift', v_drift);
end $$;

-- link a roster row to an account (merges an auto-created 'signup' duplicate)
create or replace function public.ws_link_participant(p_participant uuid, p_user uuid)
returns public.ws_participants language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p public.ws_participants; v_team text;
begin
  select * into v_p from public.ws_participants where id = p_participant for update;
  if not found then raise exception 'participant not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_p.workshop_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  -- move attendance from the duplicate, then delete it
  update public.ws_attendance a set participant_id = v_p.id
    from public.ws_participants x
   where a.participant_id = x.id and x.workshop_id = v_p.workshop_id and x.user_id = p_user
     and x.id <> v_p.id and x.source = 'signup'
     and not exists (select 1 from public.ws_attendance b where b.session_id = a.session_id and b.participant_id = v_p.id);
  delete from public.ws_participants x
   where x.workshop_id = v_p.workshop_id and x.user_id = p_user and x.id <> v_p.id and x.source = 'signup'
     and not exists (select 1 from public.ws_certificates c where c.participant_id = x.id);
  update public.ws_participants set user_id = p_user, joined_at = coalesce(joined_at, now())
   where id = v_p.id returning * into v_p;
  select team_name into v_team from public.ws_groups where id = v_p.group_id and sc_class_id is not null;
  if v_team is not null then perform public.ws_internal_set_user_team(p_user, v_team); end if;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_p.workshop_id, 'participant.linked', 'ws_participants', v_p.id, jsonb_build_object('user_id', p_user));
  return v_p;
end $$;

-- move between groups; history (old photos) stays with the old group by design
create or replace function public.ws_move_participant(p_participant uuid, p_group uuid)
returns public.ws_participants language plpgsql security definer set search_path = public, pg_temp as $$
declare v_p public.ws_participants; v_old text; v_new text;
begin
  select * into v_p from public.ws_participants where id = p_participant for update;
  if not found then raise exception 'participant not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_p.workshop_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_group is not null then
    select team_name into v_new from public.ws_groups
     where id = p_group and workshop_id = v_p.workshop_id;
    if v_new is null then raise exception 'target group not in this workshop' using errcode = '22023'; end if;
  end if;
  select team_name into v_old from public.ws_groups where id = v_p.group_id;
  update public.ws_participants set group_id = p_group where id = p_participant returning * into v_p;
  if v_p.user_id is not null and p_group is not null
     and exists (select 1 from public.ws_groups where id = p_group and sc_class_id is not null) then
    perform public.ws_internal_set_user_team(v_p.user_id, v_new);
  end if;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_p.workshop_id, 'participant.moved', 'ws_participants', v_p.id,
          jsonb_build_object('from', v_old, 'to', v_new));
  return v_p;
end $$;

-- ═══ §3.6.5 curriculum: instantiate / clone / reorder ═══
create or replace function public.ws_instantiate_curriculum(
  p_workshop uuid, p_template uuid default null,
  p_first_session timestamptz default null, p_interval interval default interval '7 days')
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w public.ws_workshops; v_t uuid; v_r record; v_sid uuid; v_idx int := 0;
begin
  if not public.ws_can_edit_workshop(p_workshop) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select * into v_w from public.ws_workshops where id = p_workshop for update;
  if not found then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.ws_sessions where workshop_id = p_workshop) then
    raise exception 'workshop already has sessions — edit them instead' using errcode = '23505';
  end if;
  v_t := coalesce(p_template, v_w.template_id,
         (select id from public.ws_curriculum_templates
           where is_default and not is_archived and format = v_w.format limit 1));
  if v_t is null then raise exception 'no template for format %', v_w.format using errcode = 'P0002'; end if;

  for v_r in
    select tm.session_no, max(tm.session_title) as title, max(tm.session_kind) as kind,
           sum(coalesce(tm.duration_override, m.duration_minutes)) as dur
      from public.ws_template_modules tm join public.ws_modules m on m.id = tm.module_id
     where tm.template_id = v_t
     group by tm.session_no order by tm.session_no
  loop
    insert into public.ws_sessions (workshop_id, session_no, title, kind, duration_minutes, scheduled_at, status)
    values (p_workshop, v_r.session_no, coalesce(v_r.title, 'מפגש ' || v_r.session_no),
            coalesce(v_r.kind, 'regular'), greatest(15, least(720, v_r.dur)),
            p_first_session + (v_idx * p_interval),
            case when p_first_session is null then 'planned' else 'scheduled' end)
    returning id into v_sid;

    insert into public.ws_session_modules (session_id, workshop_id, module_id, module_version, position,
                                           title, module_type, duration_minutes, pipeline_stage, content)
    select v_sid, p_workshop, m.id, m.version,
           (row_number() over (order by tm.position))::smallint,
           m.title, m.module_type, coalesce(tm.duration_override, m.duration_minutes), m.pipeline_stage,
           jsonb_build_object('summary', m.summary, 'objectives', to_jsonb(m.objectives),
             'exercises', m.exercises, 'materials', m.materials,
             'facilitator_notes', m.facilitator_notes, 'template_notes', tm.notes)
      from public.ws_template_modules tm join public.ws_modules m on m.id = tm.module_id
     where tm.template_id = v_t and tm.session_no = v_r.session_no;
    v_idx := v_idx + 1;
  end loop;

  update public.ws_workshops set template_id = v_t where id = p_workshop;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (p_workshop, 'curriculum.instantiated', 'ws_curriculum_templates', v_t, jsonb_build_object('sessions', v_idx));
  return v_idx;
end $$;

create or replace function public.ws_clone_template(p_template uuid, p_title text, p_slug text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_new uuid;
begin
  if not public.ws_is_core_staff() then raise exception 'not authorized' using errcode = '42501'; end if;
  insert into public.ws_curriculum_templates (slug, title, description, format, default_group_size, parent_template_id, created_by)
  select p_slug, p_title, description, format, default_group_size, id, auth.uid()
    from public.ws_curriculum_templates where id = p_template
  returning id into v_new;
  if v_new is null then raise exception 'template not found' using errcode = 'P0002'; end if;
  insert into public.ws_template_modules (template_id, module_id, session_no, position, session_title,
                                          session_kind, duration_override, notes)
  select v_new, module_id, session_no, position, session_title, session_kind, duration_override, notes
    from public.ws_template_modules where template_id = p_template;
  return v_new;
end $$;

-- p_ids = the COMPLETE set of ws_template_modules ids in the new order
create or replace function public.ws_reorder_template_modules(p_template uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.ws_is_core_staff() then raise exception 'not authorized' using errcode = '42501'; end if;
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or cardinality(p_ids) <> (select count(*) from public.ws_template_modules where template_id = p_template)
     or exists (select 1 from unnest(p_ids) i
                where not exists (select 1 from public.ws_template_modules t where t.id = i and t.template_id = p_template)) then
    raise exception 'p_ids must be the complete, distinct set of this template''s rows' using errcode = '22023';
  end if;
  update public.ws_template_modules tm set position = u.ord
    from unnest(p_ids) with ordinality as u(id, ord)
   where tm.id = u.id;                       -- unique(position) is DEFERRABLE → swaps are fine
end $$;

create or replace function public.ws_reorder_session_modules(p_session uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid;
begin
  select workshop_id into v_wid from public.ws_sessions where id = p_session;
  if v_wid is null or not public.ws_can_edit_workshop(v_wid) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or cardinality(p_ids) <> (select count(*) from public.ws_session_modules where session_id = p_session)
     or exists (select 1 from unnest(p_ids) i
                where not exists (select 1 from public.ws_session_modules s where s.id = i and s.session_id = p_session)) then
    raise exception 'p_ids must be the complete, distinct set of this session''s rows' using errcode = '22023';
  end if;
  update public.ws_session_modules sm set position = u.ord
    from unnest(p_ids) with ordinality as u(id, ord)
   where sm.id = u.id;
end $$;

-- ═══ §3.6.6 deliverables and certificates ═══
create or replace function public.ws_lock_deliverable(p_group uuid, p_model uuid default null)
returns public.ws_deliverables language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid; v_stats jsonb; v_model uuid; v_d public.ws_deliverables;
begin
  select workshop_id into v_wid from public.ws_groups where id = p_group;
  if v_wid is null then raise exception 'group not found' using errcode = 'P0002'; end if;
  if not public.ws_can_edit_workshop(v_wid) then raise exception 'not authorized' using errcode = '42501'; end if;

  v_stats := public.ws_internal_group_stats(v_wid, p_group) -> 0;
  v_model := coalesce(p_model,
                      (select model_id from public.ws_deliverables where group_id = p_group),
                      (v_stats #>> '{model,id}')::uuid);

  update public.ws_deliverables d set
      model_id         = v_model,
      dataset_snapshot = jsonb_build_object('photos', v_stats->'photos', 'tagged', v_stats->'tagged',
                           'contributors', v_stats->'contributors', 'coverage', v_stats->'coverage',
                           'off_target_classes', v_stats->'off_target_classes', 'captured_at', now()),
      model_snapshot   = (select jsonb_build_object('id', m.id, 'name', m.name, 'accuracy', m.accuracy,
                           'classes', m.classes, 'class_stats', m.class_stats, 'image_count', m.image_count,
                           'honest_val', m.honest_val, 'approved', m.approved, 'created_at', m.created_at)
                          from public.sc_models m where m.id = v_model),
      locked_at = now(), status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where d.group_id = p_group
  returning * into v_d;
  if not found then raise exception 'deliverable row missing — activate the group first' using errcode = 'P0002'; end if;

  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_wid, 'deliverable.locked', 'ws_deliverables', v_d.id, jsonb_build_object('model_id', v_model));
  return v_d;
end $$;

create or replace function public.ws_issue_certificates(
  p_workshop uuid,
  p_min_attendance numeric default 0.5,
  p_require_deliverable boolean default false,
  p_participant_ids uuid[] default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_w record; v_r record; v_issued int := 0; v_skipped jsonb := '[]'::jsonb;
        v_rate numeric; v_reason text; v_hours numeric;
begin
  if not public.ws_can_edit_workshop(p_workshop) then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_min_attendance < 0 or p_min_attendance > 1 then
    raise exception 'p_min_attendance must be 0..1' using errcode = '22023';
  end if;
  select w.id, w.title, w.status, w.starts_on, w.ends_on, o.name as org_name into v_w
    from public.ws_workshops w join public.ws_organizations o on o.id = w.organization_id
   where w.id = p_workshop;
  if v_w.id is null then raise exception 'workshop not found' using errcode = 'P0002'; end if;
  if v_w.status not in ('live', 'completed') then
    raise exception 'certificates only for live/completed workshops' using errcode = '22023';
  end if;
  select coalesce(sum(duration_minutes), 0) / 60.0 into v_hours
    from public.ws_sessions where workshop_id = p_workshop and status = 'done';

  for v_r in
    select p.id, p.full_name, g.display_name, g.number, sp.title as sub_title, sp.task_type,
           d.status as d_status, d.model_snapshot,
           (select count(*) from public.ws_sessions s
             where s.workshop_id = p_workshop and s.attendance_taken) as n_sessions,
           (select count(*) from public.ws_attendance a join public.ws_sessions s on s.id = a.session_id
             where a.participant_id = p.id and s.attendance_taken and a.status in ('present', 'late')) as n_present,
           exists (select 1 from public.ws_certificates c where c.participant_id = p.id) as has_cert
      from public.ws_participants p
      left join public.ws_groups g        on g.id = p.group_id
      left join public.ws_subproblems sp  on sp.id = g.subproblem_id
      left join public.ws_deliverables d  on d.group_id = g.id
     where p.workshop_id = p_workshop and p.status = 'active'
       and (p_participant_ids is null or p.id = any(p_participant_ids))
     order by g.number nulls last, p.full_name
  loop
    v_rate := case when v_r.n_sessions = 0 then 1 else v_r.n_present::numeric / v_r.n_sessions end;
    v_reason := case
      when v_r.has_cert then 'already_issued'
      when v_rate < p_min_attendance then 'attendance'
      when p_require_deliverable and coalesce(v_r.d_status, 'in_progress') not in ('submitted', 'approved') then 'deliverable'
    end;
    if v_reason is not null then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('participant_id', v_r.id,
                     'full_name', v_r.full_name, 'reason', v_reason, 'attendance', round(v_rate, 2)));
      continue;
    end if;
    insert into public.ws_certificates (workshop_id, participant_id, certificate_no, recipient_name,
                                        group_name, issued_by, data)
    values (p_workshop, v_r.id,
            'CW-' || to_char(now() at time zone 'Asia/Jerusalem', 'YYYY') || '-'
                  || lpad(nextval('public.ws_certificate_seq')::text, 5, '0'),
            v_r.full_name,
            coalesce(v_r.display_name, case when v_r.number is null then null else 'קבוצה ' || v_r.number end),
            auth.uid(),
            jsonb_build_object('workshop_title', v_w.title, 'organization', v_w.org_name,
              'starts_on', v_w.starts_on, 'ends_on', v_w.ends_on, 'hours', round(v_hours, 1),
              'subproblem', v_r.sub_title, 'task_type', v_r.task_type,
              'model_accuracy', v_r.model_snapshot->'accuracy', 'attendance', round(v_rate, 2)));
    v_issued := v_issued + 1;
  end loop;

  insert into public.ws_events (workshop_id, action, entity, payload)
  values (p_workshop, 'certificates.issued', 'ws_certificates',
          jsonb_build_object('issued', v_issued, 'skipped', jsonb_array_length(v_skipped)));
  return jsonb_build_object('issued', v_issued, 'skipped', v_skipped);
end $$;

create or replace function public.ws_revoke_certificate(p_certificate uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_wid uuid;
begin
  select workshop_id into v_wid from public.ws_certificates where id = p_certificate;
  if v_wid is null then raise exception 'certificate not found' using errcode = 'P0002'; end if;
  if not public.ws_is_admin() then raise exception 'only admins revoke' using errcode = '42501'; end if;
  update public.ws_certificates set status = 'revoked', revoked_at = now(), revoke_reason = p_reason
   where id = p_certificate;
  insert into public.ws_events (workshop_id, action, entity, entity_id, payload)
  values (v_wid, 'certificate.revoked', 'ws_certificates', p_certificate, jsonb_build_object('reason', p_reason));
end $$;

-- public verification page (anon): minimal data, first name + initial only (minors)
create or replace function public.ws_verify_certificate(p_code text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select case when p_code !~ '^[0-9a-f]{32}$' then null else (
    select jsonb_build_object('valid', c.status = 'issued', 'certificate_no', c.certificate_no,
      'recipient', split_part(c.recipient_name, ' ', 1)
                   || coalesce(' ' || left(nullif(split_part(c.recipient_name, ' ', 2), ''), 1) || '.', ''),
      'workshop', c.data->>'workshop_title', 'organization', c.data->>'organization', 'issued_at', c.issued_at)
    from public.ws_certificates c where c.verify_code = p_code) end;
$$;

-- ═══ §3.6.7 identity, staff, student context ═══
create or replace function public.ws_whoami()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'staff', (select jsonb_build_object('role', s.role, 'full_name', s.full_name)
                from public.ws_staff s where s.user_id = auth.uid() and s.active),
    'workshops', (select coalesce(jsonb_agg(jsonb_build_object('workshop_id', w.workshop_id, 'role', w.role)), '[]'::jsonb)
                    from public.ws_workshop_staff w where w.user_id = auth.uid()),
    'participations', (select coalesce(jsonb_agg(jsonb_build_object('workshop_id', p.workshop_id,
                          'participant_id', p.id, 'group_id', p.group_id)), '[]'::jsonb)
                         from public.ws_participants p where p.user_id = auth.uid() and p.status = 'active'));
$$;

create or replace function public.ws_add_staff(p_email text, p_role text, p_full_name text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid;
begin
  if not public.ws_is_admin() then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_role not in ('admin', 'instructor', 'guest') then
    raise exception 'role must be admin|instructor|guest (owner only via SQL)' using errcode = '22023';
  end if;
  select id into v_uid from auth.users where lower(email) = lower(btrim(p_email));
  if v_uid is null then
    raise exception 'no account for % — send an invite first', p_email using errcode = 'P0002';
  end if;
  insert into public.ws_staff (user_id, email, full_name, role)
  values (v_uid, lower(btrim(p_email)), coalesce(p_full_name, ''), p_role)
  on conflict (user_id) do update
    set role = excluded.role, active = true,
        full_name = coalesce(nullif(excluded.full_name, ''), public.ws_staff.full_name);
  return v_uid;
end $$;

-- student portal / phone: everything a student may see, in one call
create or replace function public.ws_my_context(p_workshop uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_p public.ws_participants;
begin
  select * into v_p from public.ws_participants
   where user_id = auth.uid() and status = 'active' and (p_workshop is null or workshop_id = p_workshop)
   order by created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'workshop', (select jsonb_build_object('id', w.id, 'title', w.title, 'format', w.format,
                   'starts_on', w.starts_on, 'ends_on', w.ends_on, 'status', w.status)
                 from public.ws_workshops w where w.id = v_p.workshop_id),
    'me', jsonb_build_object('participant_id', v_p.id, 'full_name', v_p.full_name, 'roles', v_p.roles),
    'group', (select jsonb_build_object('id', g.id, 'number', g.number, 'display_name', g.display_name,
                'team_name', g.team_name) from public.ws_groups g where g.id = v_p.group_id),
    'teammates', (select coalesce(jsonb_agg(jsonb_build_object('full_name', x.full_name, 'roles', x.roles)
                    order by x.full_name), '[]'::jsonb)
                  from public.ws_participants x
                  where v_p.group_id is not null and x.group_id = v_p.group_id and x.status = 'active'),
    'problem', (select jsonb_build_object('title', pr.title, 'statement', pr.statement, 'client_name', pr.client_name)
                from public.ws_problems pr where pr.workshop_id = v_p.workshop_id and pr.is_primary),
    'subproblem', (select jsonb_build_object('title', s.title, 'statement', s.statement, 'task_type', s.task_type,
                     'target_classes', to_jsonb(s.target_classes), 'success_metric', s.success_metric)
                   from public.ws_subproblems s join public.ws_groups g on g.subproblem_id = s.id
                   where g.id = v_p.group_id),
    'sessions', (select coalesce(jsonb_agg(jsonb_build_object('session_no', s.session_no, 'title', s.title,
                   'kind', s.kind, 'scheduled_at', s.scheduled_at, 'status', s.status) order by s.session_no), '[]'::jsonb)
                 from public.ws_sessions s where s.workshop_id = v_p.workshop_id),
    'progress', case when v_p.group_id is null then null
                     else public.ws_internal_group_stats(v_p.workshop_id, v_p.group_id) -> 0 end,
    'certificate', (select jsonb_build_object('certificate_no', c.certificate_no, 'issued_at', c.issued_at,
                      'pdf_path', c.pdf_path, 'status', c.status)
                    from public.ws_certificates c where c.participant_id = v_p.id));
end $$;
