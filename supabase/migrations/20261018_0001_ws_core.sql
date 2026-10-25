-- 20261018_0001_ws_core — §3.1 utility fns, §3.2 tables, §3.3 role helpers, §3.4 triggers, §3.5 RLS
-- Source: workshops-os-plan/architecture.md §3 (2026-10-17). Generated 2026-10-18 by
-- build_ws_migrations.py; SQL is the doc's text verbatim except the fixes listed in README.md.
-- Target: Supabase project eaawnjvabcnznukewnlj, PostgreSQL 17.6. Additive only: no DDL on sc_*, profiles, auth.*.
-- ═══ §3.1 utility functions ═══
create or replace function public.ws_touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create or replace function public.ws_try_uuid(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- true for service_role JWTs, pg_cron and the SQL editor; false for any PostgREST user/anon
create or replace function public.ws_is_service() returns boolean
language sql stable as $$
  select coalesce(auth.jwt()->>'role', '') = 'service_role'
      or (auth.uid() is null and session_user not in ('authenticator', 'anon', 'authenticated'));
$$;

-- ═══ §3.2 tables ═══
-- ── staff & roles ─────────────────────────────────────────────────────
create table public.ws_staff (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null check (email = lower(email)),
  full_name   text not null default '',
  phone       text,
  role        text not null default 'instructor'
              check (role in ('owner', 'admin', 'instructor', 'guest')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index ws_staff_email_uq on public.ws_staff (email);

-- ── customers ─────────────────────────────────────────────────────────
create table public.ws_organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(btrim(name)) between 2 and 120),
  kind          text not null default 'school'
                check (kind in ('school', 'company', 'municipality', 'ngo', 'other')),
  city          text,
  address       text,
  external_ref  text,                       -- e.g. institution code
  website       text,
  status        text not null default 'active'
                check (status in ('lead', 'active', 'paused', 'archived')),
  notes         text,
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  created_by    uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index ws_organizations_name_city_uq
  on public.ws_organizations (lower(name), lower(coalesce(city, '')));

create table public.ws_contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ws_organizations(id) on delete cascade,
  full_name       text not null check (char_length(btrim(full_name)) between 1 and 120),
  role_title      text,
  email           text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text,
  is_primary      boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index ws_contacts_one_primary on public.ws_contacts (organization_id) where is_primary;
create index ws_contacts_org_idx on public.ws_contacts (organization_id);

create table public.ws_field_definitions (
  id              uuid primary key default gen_random_uuid(),
  entity          text not null check (entity in ('organization', 'workshop', 'group', 'participant')),
  organization_id uuid references public.ws_organizations(id) on delete cascade,   -- null = global
  key             text not null check (key ~ '^[a-z][a-z0-9_]{1,39}$'),
  label           text not null,
  field_type      text not null
                  check (field_type in ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'url')),
  options         jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required        boolean not null default false,
  position        smallint not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index ws_field_definitions_uq on public.ws_field_definitions
  (entity, key, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ── curriculum library ────────────────────────────────────────────────
create table public.ws_modules (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title             text not null check (char_length(btrim(title)) between 2 and 120),
  summary           text,
  module_type       text not null check (module_type in ('theory', 'practice', 'demo', 'mixed')),
  pipeline_stage    text check (pipeline_stage in
                    ('intro', 'grouping', 'problem', 'research', 'collect', 'tag', 'train', 'evaluate', 'present', 'demo')),
  duration_minutes  int not null default 45 check (duration_minutes between 5 and 720),
  objectives        text[] not null default '{}',
  exercises         jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array'),
     -- [{ "title": "...", "instructions": "...", "duration_min": 10, "kind": "individual|group|class" }]
  materials         jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
     -- [{ "label": "...", "url": "https://...", "kind": "slides|video|handout|link" }]
  facilitator_notes text,
  tags              text[] not null default '{}',
  requires_app      boolean not null default false,
  version           int not null default 1,
  parent_module_id  uuid references public.ws_modules(id) on delete set null,   -- cloned from
  is_archived       boolean not null default false,
  created_by        uuid default auth.uid() references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.ws_curriculum_templates (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title               text not null,
  description         text,
  format              text not null check (format in ('sessions', 'hackathon', 'custom')),
  default_group_size  smallint not null default 4 check (default_group_size between 2 and 8),
  is_default          boolean not null default false,
  is_archived         boolean not null default false,
  parent_template_id  uuid references public.ws_curriculum_templates(id) on delete set null,
  created_by          uuid default auth.uid() references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index ws_templates_one_default on public.ws_curriculum_templates (format)
  where is_default and not is_archived;

create table public.ws_template_modules (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid not null references public.ws_curriculum_templates(id) on delete cascade,
  module_id         uuid not null references public.ws_modules(id) on delete restrict,  -- archive, don't delete
  session_no        smallint not null check (session_no between 1 and 60),
  position          smallint not null check (position between 1 and 500),
  session_title     text,
  session_kind      text check (session_kind in ('regular', 'practical', 'hackathon', 'demo_day', 'other')),
  duration_override int check (duration_override between 5 and 720),
  notes             text,
  created_at        timestamptz not null default now(),
  constraint ws_template_modules_pos_uq unique (template_id, position) deferrable initially deferred
);
create index ws_template_modules_tpl_idx on public.ws_template_modules (template_id, session_no);
create index ws_template_modules_mod_idx on public.ws_template_modules (module_id);

-- ── workshops ─────────────────────────────────────────────────────────
create table public.ws_workshops (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.ws_organizations(id) on delete restrict,
  code             text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{2,19}$'),
  -- Hebrew prefix of every group's team_name, e.g. 'אופק ח2 תשפ״ז'. Use gershayim ״, never ASCII "
  team_prefix      text not null unique check (
                     team_prefix = btrim(team_prefix)
                     and char_length(team_prefix) between 2 and 24
                     and team_prefix not like 'אישי%'
                     and team_prefix !~ '[,()"''\\]'),
  title            text not null check (char_length(btrim(title)) between 2 and 160),
  format           text not null default 'sessions' check (format in ('sessions', 'hackathon', 'custom')),
  template_id      uuid references public.ws_curriculum_templates(id) on delete set null,
  status           text not null default 'draft'
                   check (status in ('draft', 'proposal', 'confirmed', 'live', 'completed', 'archived', 'cancelled')),
  starts_on        date,
  ends_on          date,
  timezone         text not null default 'Asia/Jerusalem',
  sector           text not null default 'education'
                   check (sector in ('education', 'municipal', 'industry', 'ngo', 'other')),
  grade_level      text,                    -- 'ז' / 'ח' / 'ט' / free
  class_label      text,                    -- e.g. ח׳2
  homeroom_teacher text,
  audience_size    int check (audience_size between 1 and 500),
  group_size       smallint not null default 4 check (group_size between 2 and 8),
  location         text,
  device_mode      text not null default 'own_phones'
                   check (device_mode in ('own_phones', 'tablets_addon', 'mixed')),
  tablets_count    int check (tablets_count >= 0),
  sc_campaign_id   uuid,                    -- soft ref sc_campaigns.id (optional, see §4.4)
  custom_fields    jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  notes            text,
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index ws_workshops_org_idx on public.ws_workshops (organization_id);
create index ws_workshops_status_idx on public.ws_workshops (status, starts_on);

create table public.ws_workshop_staff (
  workshop_id uuid not null references public.ws_workshops(id) on delete cascade,
  user_id     uuid not null references public.ws_staff(user_id) on delete cascade,
  role        text not null default 'instructor'
              check (role in ('lead', 'instructor', 'assistant', 'observer')),
  created_at  timestamptz not null default now(),
  primary key (workshop_id, user_id)
);
create index ws_workshop_staff_user_idx on public.ws_workshop_staff (user_id);

-- ── sessions (meetings) ───────────────────────────────────────────────
create table public.ws_sessions (
  id               uuid primary key default gen_random_uuid(),
  workshop_id      uuid not null references public.ws_workshops(id) on delete cascade,
  session_no       smallint not null check (session_no between 1 and 60),
  title            text not null,
  kind             text not null default 'regular'
                   check (kind in ('regular', 'practical', 'hackathon', 'demo_day', 'other')),
  scheduled_at     timestamptz,
  duration_minutes int not null default 120 check (duration_minutes between 15 and 720),
  location         text,
  status           text not null default 'planned'
                   check (status in ('planned', 'scheduled', 'live', 'done', 'cancelled', 'postponed')),
  started_at       timestamptz,
  ended_at         timestamptz,
  lead_user_id     uuid references public.ws_staff(user_id) on delete set null,
  facilitator_log  text,
  recap            text,
  attendance_taken boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint ws_sessions_no_uq unique (workshop_id, session_no) deferrable initially deferred,
  constraint ws_sessions_id_wid_uq unique (id, workshop_id)
);
create index ws_sessions_sched_idx on public.ws_sessions (workshop_id, scheduled_at);

create table public.ws_session_modules (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null,
  workshop_id      uuid not null,
  module_id        uuid references public.ws_modules(id) on delete set null,
  module_version   int,
  position         smallint not null check (position between 1 and 200),
  title            text not null,
  module_type      text not null check (module_type in ('theory', 'practice', 'demo', 'mixed')),
  duration_minutes int not null check (duration_minutes between 5 and 720),
  pipeline_stage   text,
  content          jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
     -- snapshot: { summary, objectives[], exercises[], materials[], facilitator_notes, template_notes }
  status           text not null default 'pending' check (status in ('pending', 'done', 'partial', 'skipped')),
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (session_id, workshop_id) references public.ws_sessions(id, workshop_id) on delete cascade,
  constraint ws_session_modules_pos_uq unique (session_id, position) deferrable initially deferred
);
create index ws_session_modules_wid_idx on public.ws_session_modules (workshop_id);

-- ── problem decomposition ─────────────────────────────────────────────
create table public.ws_problems (
  id                   uuid primary key default gen_random_uuid(),
  workshop_id          uuid not null references public.ws_workshops(id) on delete cascade,
  client_org_id        uuid references public.ws_organizations(id) on delete set null,
  client_name          text,
  client_contact       text,
  title                text not null,
  statement            text not null,
  context              text,
  success_criteria     text,
  media                jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'),
  is_primary           boolean not null default true,
  status               text not null default 'draft'
                       check (status in ('draft', 'presented', 'decomposed', 'solved')),
  presented_session_id uuid,
  solution_notes       text,               -- Demo Day: how the groups' parts assemble
  solution_model_id    uuid,               -- optional soft ref sc_models.id (class-wide merged model, phase 2)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ws_problems_id_wid_uq unique (id, workshop_id),
  foreign key (presented_session_id, workshop_id)
    references public.ws_sessions(id, workshop_id) on delete set null (presented_session_id)
);
create unique index ws_problems_one_primary on public.ws_problems (workshop_id) where is_primary;

create table public.ws_subproblems (
  id              uuid primary key default gen_random_uuid(),
  workshop_id     uuid not null,
  problem_id      uuid not null,
  position        smallint not null default 1,
  title           text not null,
  statement       text,
  task_type       text not null check (task_type in ('detect', 'classify', 'count', 'other')),
  target_classes  text[] not null default '{}',     -- normalized by trigger; dynamic, any objects
  success_metric  text,                              -- e.g. 'mAP50 ≥ 0.6' / 'count error ≤ 10%'
  target_accuracy numeric(4,3) check (target_accuracy between 0 and 1),
  data_plan       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ws_subproblems_id_wid_uq unique (id, workshop_id),
  foreign key (problem_id, workshop_id) references public.ws_problems(id, workshop_id) on delete cascade
);
create index ws_subproblems_problem_idx on public.ws_subproblems (problem_id);
create index ws_subproblems_wid_idx on public.ws_subproblems (workshop_id);

-- ── groups ↔ sc_classes ───────────────────────────────────────────────
create table public.ws_groups (
  id            uuid primary key default gen_random_uuid(),
  workshop_id   uuid not null references public.ws_workshops(id) on delete cascade,
  number        smallint not null check (number between 1 and 99),
  display_name  text,                                   -- fun name, freely editable
  team_name     text not null unique check (            -- == sc_classes.name; set by trigger
                  team_name = btrim(team_name)
                  and char_length(team_name) between 2 and 40
                  and team_name not like 'אישי ·%'
                  and team_name !~ '[,()"''\\]'),
  sc_class_id   uuid unique,                            -- soft ref sc_classes.id; set ONLY by RPC
  subproblem_id uuid,
  capacity      smallint check (capacity between 1 and 12),   -- null = no hard cap
  color         text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  status        text not null default 'forming' check (status in ('forming', 'active', 'done')),
  activated_at  timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ws_groups_number_uq unique (workshop_id, number),
  constraint ws_groups_id_wid_uq unique (id, workshop_id),
  foreign key (subproblem_id, workshop_id)
    references public.ws_subproblems(id, workshop_id) on delete set null (subproblem_id)
);
create index ws_groups_subproblem_idx on public.ws_groups (subproblem_id);

-- ── participants ──────────────────────────────────────────────────────
create table public.ws_participants (
  id            uuid primary key default gen_random_uuid(),
  workshop_id   uuid not null references public.ws_workshops(id) on delete cascade,
  group_id      uuid,
  user_id       uuid references auth.users(id) on delete set null,
  full_name     text not null check (char_length(btrim(full_name)) between 1 and 80),
  grade         text,
  roles         text[] not null default '{}',     -- e.g. {צלם, מתייג, מציג}
  status        text not null default 'active' check (status in ('invited', 'active', 'withdrawn')),
  source        text not null default 'roster' check (source in ('roster', 'signup', 'manual')),
  media_consent boolean,                          -- null = unknown (minors!)
  joined_at     timestamptz,
  notes         text,                             -- instructor-only (students can't read teammates' rows)
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ws_participants_id_wid_uq unique (id, workshop_id),
  foreign key (group_id, workshop_id)
    references public.ws_groups(id, workshop_id) on delete set null (group_id)
);
create unique index ws_participants_user_uq on public.ws_participants (workshop_id, user_id)
  where user_id is not null;
create index ws_participants_group_idx on public.ws_participants (group_id);
create index ws_participants_user_idx on public.ws_participants (user_id);

-- ── attendance ────────────────────────────────────────────────────────
create table public.ws_attendance (
  session_id     uuid not null,
  participant_id uuid not null,
  workshop_id    uuid not null,
  status         text not null check (status in ('present', 'late', 'absent', 'excused')),
  arrived_at     timestamptz,
  note           text,
  marked_by      uuid default auth.uid() references auth.users(id) on delete set null,
  marked_at      timestamptz not null default now(),
  primary key (session_id, participant_id),
  foreign key (session_id, workshop_id) references public.ws_sessions(id, workshop_id) on delete cascade,
  foreign key (participant_id, workshop_id) references public.ws_participants(id, workshop_id) on delete cascade
);
create index ws_attendance_participant_idx on public.ws_attendance (participant_id);
create index ws_attendance_wid_idx on public.ws_attendance (workshop_id);

-- ── deliverables (one per group) ──────────────────────────────────────
create table public.ws_deliverables (
  id                uuid primary key default gen_random_uuid(),
  workshop_id       uuid not null,
  group_id          uuid not null unique,
  model_id          uuid,                   -- soft ref sc_models.id (final model)
  training_job_id   uuid,                   -- soft ref sc_training_jobs.id
  dataset_snapshot  jsonb,                  -- frozen at lock: photos/tagged/coverage/...
  model_snapshot    jsonb,                  -- frozen at lock: accuracy/class_stats/...
  presentation_url  text check (presentation_url is null or presentation_url ~* '^https://'),
  presentation_path text,                   -- ws-private bucket key
  demo_result       text check (demo_result in ('pass', 'partial', 'fail')),
  demo_score        numeric(5,2) check (demo_score between 0 and 100),
  demo_notes        text,
  failure_cases     jsonb not null default '[]'::jsonb check (jsonb_typeof(failure_cases) = 'array'),
     -- [{ "frame_path": "...", "note": "דוגמה שהמודל פספס", "kind": "fn|fp|confusion" }]
  extras            jsonb not null default '{}'::jsonb check (jsonb_typeof(extras) = 'object'),
  status            text not null default 'in_progress'
                    check (status in ('in_progress', 'submitted', 'approved', 'returned')),
  submitted_at      timestamptz,
  locked_at         timestamptz,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (group_id, workshop_id) references public.ws_groups(id, workshop_id) on delete cascade
);
create index ws_deliverables_wid_idx on public.ws_deliverables (workshop_id);

-- ── certificates ──────────────────────────────────────────────────────
create sequence public.ws_certificate_seq;

create table public.ws_certificates (
  id             uuid primary key default gen_random_uuid(),
  workshop_id    uuid not null references public.ws_workshops(id) on delete restrict,
  participant_id uuid not null unique,
  certificate_no text not null unique,                       -- CW-2026-00042
  verify_code    text not null unique default replace(gen_random_uuid()::text, '-', ''),
  recipient_name text not null,
  group_name     text,
  data           jsonb not null default '{}'::jsonb,         -- snapshot for rendering
  status         text not null default 'issued' check (status in ('issued', 'revoked')),
  issued_at      timestamptz not null default now(),
  issued_by      uuid references auth.users(id) on delete set null,
  pdf_path       text,                                       -- null = rendering pending
  revoked_at     timestamptz,
  revoke_reason  text,
  foreign key (participant_id, workshop_id)
    references public.ws_participants(id, workshop_id) on delete restrict
);
create index ws_certificates_wid_idx on public.ws_certificates (workshop_id);

-- ── audit ─────────────────────────────────────────────────────────────
create table public.ws_events (
  id          bigint generated always as identity primary key,
  workshop_id uuid references public.ws_workshops(id) on delete cascade,
  actor       uuid default auth.uid(),
  action      text not null,
  entity      text,
  entity_id   uuid,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index ws_events_wid_idx on public.ws_events (workshop_id, created_at desc);

-- ═══ §3.3 role helpers (security definer; created BEFORE any policy or trigger uses them) ═══
create or replace function public.ws_is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.ws_is_service() or exists (
    select 1 from public.ws_staff s
    where s.user_id = auth.uid() and s.active and s.role in ('owner', 'admin'));
$$;

create or replace function public.ws_is_core_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.ws_is_service() or exists (
    select 1 from public.ws_staff s
    where s.user_id = auth.uid() and s.active and s.role in ('owner', 'admin', 'instructor'));
$$;

-- read access to a workshop (any assigned role incl. observer)
create or replace function public.ws_is_workshop_staff(p_workshop uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.ws_is_admin() or exists (
    select 1 from public.ws_workshop_staff w
    join public.ws_staff s on s.user_id = w.user_id and s.active
    where w.workshop_id = p_workshop and w.user_id = auth.uid());
$$;

-- write access to a workshop (lead/instructor/assistant)
create or replace function public.ws_can_edit_workshop(p_workshop uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.ws_is_admin() or exists (
    select 1 from public.ws_workshop_staff w
    join public.ws_staff s on s.user_id = w.user_id and s.active
    where w.workshop_id = p_workshop and w.user_id = auth.uid()
      and w.role in ('lead', 'instructor', 'assistant'));
$$;

create or replace function public.ws_my_group_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select p.group_id from public.ws_participants p
  where p.user_id = auth.uid() and p.status = 'active' and p.group_id is not null;
$$;

create or replace function public.ws_my_workshop_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select distinct p.workshop_id from public.ws_participants p
  where p.user_id = auth.uid() and p.status = 'active';
$$;

-- ═══ §3.4 triggers ═══
-- updated_at everywhere
do $$ declare t text; begin
  foreach t in array array['ws_staff','ws_organizations','ws_contacts','ws_modules','ws_curriculum_templates',
    'ws_workshops','ws_sessions','ws_session_modules','ws_problems','ws_subproblems','ws_groups',
    'ws_participants','ws_deliverables'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.ws_touch_updated_at()',
                   t || '_touch', t);
  end loop;
end $$;

-- staff: only an owner (or service) may grant/modify/remove owner
create or replace function public.ws_guard_staff() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner boolean := public.ws_is_service() or exists (
  select 1 from public.ws_staff where user_id = auth.uid() and role = 'owner' and active);
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.role = 'owner' and not v_owner then
      raise exception 'only an owner can modify an owner' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.role = 'owner' and not v_owner then
    raise exception 'only an owner can grant owner' using errcode = '42501';
  end if;
  new.email := lower(btrim(new.email));
  return new;
end $$;
create trigger ws_staff_guard before insert or update or delete on public.ws_staff
  for each row execute function public.ws_guard_staff();

-- module version bump on content change
create or replace function public.ws_modules_bump_version() returns trigger
language plpgsql as $$
begin
  if (new.title, new.summary, new.module_type, new.duration_minutes, new.objectives,
      new.exercises, new.materials, new.facilitator_notes)
     is distinct from
     (old.title, old.summary, old.module_type, old.duration_minutes, old.objectives,
      old.exercises, old.materials, old.facilitator_notes) then
    new.version := old.version + 1;
  end if;
  return new;
end $$;
create trigger ws_modules_version before update on public.ws_modules
  for each row execute function public.ws_modules_bump_version();

-- workshop: team_prefix locked once any group is activated
create or replace function public.ws_workshops_guard() returns trigger
language plpgsql as $$
begin
  if new.team_prefix is distinct from old.team_prefix
     and exists (select 1 from public.ws_groups where workshop_id = old.id and sc_class_id is not null) then
    raise exception 'team_prefix is locked once groups are activated (it keys Smart City data)'
      using errcode = '23514';
  end if;
  if new.sc_campaign_id is not null and new.sc_campaign_id is distinct from old.sc_campaign_id
     and not exists (select 1 from public.sc_campaigns where id = new.sc_campaign_id) then
    raise exception 'sc_campaign % not found', new.sc_campaign_id using errcode = '23503';
  end if;
  return new;
end $$;
create trigger ws_workshops_guard before update on public.ws_workshops
  for each row execute function public.ws_workshops_guard();

-- sub-problem classes: trim, drop empties, dedupe case-insensitively, forbid YAML-breaking chars
create or replace function public.ws_subproblems_normalize() returns trigger
language plpgsql as $$
declare v text[];
begin
  select coalesce(array_agg(c order by o), '{}') into v from (
    select distinct on (lower(btrim(x))) btrim(x) as c, o
    from unnest(new.target_classes) with ordinality as u(x, o)
    where btrim(coalesce(x, '')) <> ''
    order by lower(btrim(x)), o) s;
  if cardinality(v) = 0 then
    raise exception 'target_classes must contain at least one class' using errcode = '23514';
  end if;
  if cardinality(v) > 20 then
    raise exception 'max 20 target classes' using errcode = '23514';
  end if;
  if exists (select 1 from unnest(v) c where c ~ '[''"\n\r]' or char_length(c) > 40) then
    raise exception 'class names: max 40 chars, no quotes/newlines (they break YOLO data.yaml)'
      using errcode = '23514';
  end if;
  new.target_classes := v;
  return new;
end $$;
create trigger ws_subproblems_normalize before insert or update of target_classes on public.ws_subproblems
  for each row execute function public.ws_subproblems_normalize();

-- groups: compute team_name; freeze identity after activation
create or replace function public.ws_groups_defaults() returns trigger
language plpgsql as $$
begin
  if new.team_name is null then
    select w.team_prefix || ' · קבוצה ' || new.number into new.team_name
    from public.ws_workshops w where w.id = new.workshop_id;
  end if;
  return new;
end $$;
create trigger ws_groups_defaults before insert on public.ws_groups
  for each row execute function public.ws_groups_defaults();

create or replace function public.ws_groups_guard() returns trigger
language plpgsql as $$
begin
  if new.workshop_id <> old.workshop_id then
    raise exception 'a group cannot move between workshops' using errcode = '23514';
  end if;
  if old.sc_class_id is not null and (new.team_name is distinct from old.team_name
                                      or new.sc_class_id is distinct from old.sc_class_id
                                      or new.number <> old.number) then
    raise exception 'team identity is immutable after activation (it keys sc_* rows)' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger ws_groups_guard before update on public.ws_groups
  for each row execute function public.ws_groups_guard();

-- participants: soft capacity (signups bypass — the phone app already put them in that team)
create or replace function public.ws_participants_capacity() returns trigger
language plpgsql as $$
declare v_cap smallint; v_n int;
begin
  if new.group_id is null or new.status <> 'active' or new.source = 'signup' then return new; end if;
  if tg_op = 'UPDATE' then
    if new.group_id is not distinct from old.group_id and old.status = 'active' then return new; end if;
  end if;
  select capacity into v_cap from public.ws_groups where id = new.group_id for update;
  if v_cap is null then return new; end if;
  select count(*) into v_n from public.ws_participants
   where group_id = new.group_id and status = 'active' and id <> new.id;
  if v_n >= v_cap then
    raise exception 'group is full (capacity %)', v_cap using errcode = '23514';
  end if;
  return new;
end $$;
create trigger ws_participants_capacity before insert or update on public.ws_participants
  for each row execute function public.ws_participants_capacity();

-- attendance marks the session as attendance-taken
create or replace function public.ws_attendance_mark_session() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.ws_sessions set attendance_taken = true
   where id = new.session_id and not attendance_taken;
  return new;
end $$;
create trigger ws_attendance_mark after insert on public.ws_attendance
  for each row execute function public.ws_attendance_mark_session();

-- deliverables: students may only touch presentation/failure cases/extras + submit;
-- the chosen model must belong to the group (team or personal variant)
create or replace function public.ws_deliverables_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_staff boolean := public.ws_can_edit_workshop(new.workshop_id);
begin
  if tg_op = 'UPDATE' and not v_staff then
    if old.locked_at is not null then
      raise exception 'deliverable is locked' using errcode = '42501';
    end if;
    if (new.model_id, new.training_job_id, new.dataset_snapshot, new.model_snapshot, new.demo_result,
        new.demo_score, new.demo_notes, new.reviewed_by, new.reviewed_at, new.locked_at, new.group_id, new.workshop_id)
       is distinct from
       (old.model_id, old.training_job_id, old.dataset_snapshot, old.model_snapshot, old.demo_result,
        old.demo_score, old.demo_notes, old.reviewed_by, old.reviewed_at, old.locked_at, old.group_id, old.workshop_id) then
      raise exception 'students may only edit presentation, failure cases and submit' using errcode = '42501';
    end if;
    if new.status is distinct from old.status
       and not (old.status in ('in_progress', 'returned', 'submitted') and new.status in ('submitted', 'in_progress')) then
      raise exception 'illegal status change % -> %', old.status, new.status using errcode = '42501';
    end if;
    if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now(); end if;
  end if;

  if new.model_id is not null then
    if tg_op = 'INSERT' or new.model_id is distinct from old.model_id then
      perform 1 from public.sc_models m join public.ws_groups g on g.id = new.group_id
       where m.id = new.model_id and m.team_name in (g.team_name, 'אישי · ' || g.team_name);
      if not found then
        raise exception 'model % does not belong to this group', new.model_id using errcode = '23514';
      end if;
    end if;
  end if;
  if new.training_job_id is not null then
    if tg_op = 'INSERT' or new.training_job_id is distinct from old.training_job_id then
      perform 1 from public.sc_training_jobs where id = new.training_job_id;
      if not found then raise exception 'training job not found' using errcode = '23503'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger ws_deliverables_guard before insert or update on public.ws_deliverables
  for each row execute function public.ws_deliverables_guard();

-- ═══ §3.5 RLS policies ═══
do $$ declare t text; begin
  foreach t in array array['ws_staff','ws_organizations','ws_contacts','ws_field_definitions','ws_modules',
    'ws_curriculum_templates','ws_template_modules','ws_workshops','ws_workshop_staff','ws_sessions',
    'ws_session_modules','ws_problems','ws_subproblems','ws_groups','ws_participants','ws_attendance',
    'ws_deliverables','ws_certificates','ws_events'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ws_staff
create policy ws_staff_sel on public.ws_staff for select to authenticated
  using (user_id = (select auth.uid()) or (select public.ws_is_core_staff()));
create policy ws_staff_ins on public.ws_staff for insert to authenticated with check ((select public.ws_is_admin()));
create policy ws_staff_upd on public.ws_staff for update to authenticated
  using ((select public.ws_is_admin())) with check ((select public.ws_is_admin()));
create policy ws_staff_del on public.ws_staff for delete to authenticated using ((select public.ws_is_admin()));

-- organizations / contacts: admins, or staff of a workshop for that org
create policy ws_org_sel on public.ws_organizations for select to authenticated
  using ((select public.ws_is_admin()) or exists (
    select 1 from public.ws_workshops w
    where w.organization_id = ws_organizations.id and public.ws_is_workshop_staff(w.id)));
create policy ws_org_write on public.ws_organizations for all to authenticated
  using ((select public.ws_is_admin())) with check ((select public.ws_is_admin()));

create policy ws_contacts_sel on public.ws_contacts for select to authenticated
  using ((select public.ws_is_admin()) or exists (
    select 1 from public.ws_workshops w
    where w.organization_id = ws_contacts.organization_id and public.ws_can_edit_workshop(w.id)));
create policy ws_contacts_write on public.ws_contacts for all to authenticated
  using ((select public.ws_is_admin())) with check ((select public.ws_is_admin()));

-- field definitions
create policy ws_fdef_sel on public.ws_field_definitions for select to authenticated
  using ((select public.ws_is_core_staff()));
create policy ws_fdef_write on public.ws_field_definitions for all to authenticated
  using ((select public.ws_is_admin())) with check ((select public.ws_is_admin()));

-- curriculum library: core staff read+write, admins delete
create policy ws_mod_sel on public.ws_modules for select to authenticated using ((select public.ws_is_core_staff()));
create policy ws_mod_ins on public.ws_modules for insert to authenticated with check ((select public.ws_is_core_staff()));
create policy ws_mod_upd on public.ws_modules for update to authenticated
  using ((select public.ws_is_core_staff())) with check ((select public.ws_is_core_staff()));
create policy ws_mod_del on public.ws_modules for delete to authenticated using ((select public.ws_is_admin()));

create policy ws_tpl_sel on public.ws_curriculum_templates for select to authenticated using ((select public.ws_is_core_staff()));
create policy ws_tpl_ins on public.ws_curriculum_templates for insert to authenticated with check ((select public.ws_is_core_staff()));
create policy ws_tpl_upd on public.ws_curriculum_templates for update to authenticated
  using ((select public.ws_is_core_staff())) with check ((select public.ws_is_core_staff()));
create policy ws_tpl_del on public.ws_curriculum_templates for delete to authenticated using ((select public.ws_is_admin()));

create policy ws_tplm_sel on public.ws_template_modules for select to authenticated using ((select public.ws_is_core_staff()));
create policy ws_tplm_write on public.ws_template_modules for all to authenticated
  using ((select public.ws_is_core_staff())) with check ((select public.ws_is_core_staff()));

-- workshops (students read via ws_my_context RPC, not directly)
create policy ws_ws_sel on public.ws_workshops for select to authenticated using (public.ws_is_workshop_staff(id));
create policy ws_ws_ins on public.ws_workshops for insert to authenticated with check ((select public.ws_is_admin()));
create policy ws_ws_upd on public.ws_workshops for update to authenticated
  using (public.ws_can_edit_workshop(id)) with check (public.ws_can_edit_workshop(id));
create policy ws_ws_del on public.ws_workshops for delete to authenticated
  using ((select public.ws_is_admin()) and status in ('draft', 'cancelled'));

create policy ws_wstaff_sel on public.ws_workshop_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.ws_is_workshop_staff(workshop_id));
create policy ws_wstaff_write on public.ws_workshop_staff for all to authenticated
  using ((select public.ws_is_admin())) with check ((select public.ws_is_admin()));

-- sessions / session modules: staff only (students via RPC)
create policy ws_sess_sel on public.ws_sessions for select to authenticated using (public.ws_is_workshop_staff(workshop_id));
create policy ws_sess_write on public.ws_sessions for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

create policy ws_smod_sel on public.ws_session_modules for select to authenticated using (public.ws_is_workshop_staff(workshop_id));
create policy ws_smod_write on public.ws_session_modules for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

-- problems / subproblems / groups: whole class may read (needed for Demo Day assembly)
create policy ws_prob_sel on public.ws_problems for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or workshop_id in (select public.ws_my_workshop_ids()));
create policy ws_prob_write on public.ws_problems for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

create policy ws_sub_sel on public.ws_subproblems for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or workshop_id in (select public.ws_my_workshop_ids()));
create policy ws_sub_write on public.ws_subproblems for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

create policy ws_grp_sel on public.ws_groups for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or workshop_id in (select public.ws_my_workshop_ids()));
create policy ws_grp_ins on public.ws_groups for insert to authenticated
  with check (public.ws_can_edit_workshop(workshop_id));
create policy ws_grp_upd on public.ws_groups for update to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));
create policy ws_grp_del on public.ws_groups for delete to authenticated
  using (public.ws_can_edit_workshop(workshop_id) and sc_class_id is null);

-- participants: student sees ONLY own row (teammates via RPC — notes are private)
create policy ws_part_sel on public.ws_participants for select to authenticated
  using (user_id = (select auth.uid()) or public.ws_is_workshop_staff(workshop_id));
create policy ws_part_write on public.ws_participants for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

-- attendance
create policy ws_att_sel on public.ws_attendance for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or participant_id in (
    select p.id from public.ws_participants p where p.user_id = (select auth.uid())));
create policy ws_att_write on public.ws_attendance for all to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));

-- deliverables: own group may read + update (column guard trigger restricts)
create policy ws_del_sel on public.ws_deliverables for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or group_id in (select public.ws_my_group_ids()));
create policy ws_del_upd_staff on public.ws_deliverables for update to authenticated
  using (public.ws_can_edit_workshop(workshop_id)) with check (public.ws_can_edit_workshop(workshop_id));
create policy ws_del_upd_group on public.ws_deliverables for update to authenticated
  using (group_id in (select public.ws_my_group_ids())) with check (group_id in (select public.ws_my_group_ids()));
create policy ws_del_ins on public.ws_deliverables for insert to authenticated
  with check (public.ws_can_edit_workshop(workshop_id));
create policy ws_del_del on public.ws_deliverables for delete to authenticated
  using (public.ws_can_edit_workshop(workshop_id));

-- certificates: read own / staff; writes only via RPC (privileges revoked)
create policy ws_cert_sel on public.ws_certificates for select to authenticated
  using (public.ws_is_workshop_staff(workshop_id) or participant_id in (
    select p.id from public.ws_participants p where p.user_id = (select auth.uid())));

-- events: staff read; writes only via RPC
create policy ws_evt_sel on public.ws_events for select to authenticated
  using (workshop_id is not null and public.ws_is_workshop_staff(workshop_id));
