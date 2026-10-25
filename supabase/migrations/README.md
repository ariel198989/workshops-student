# Workshops OS — Supabase migrations (`ws_*` data layer)

Source of truth: `workshops-os-plan/architecture.md` §3 (2026-10-17). Target: Supabase project
`eaawnjvabcnznukewnlj`, PostgreSQL 17.6.

**Applied 2026-10-18** as migrations `ws_0001_core`, `ws_0002_rpc`, `ws_0003_grants`, `ws_0004_storage`,
`ws_0005a/b/c_seed_*` (the seed split in three for transport) and `ws_0006_hardening`. Verified after apply:
25 modules (title/summary/notes md5 identical to this file), 3 templates, 16 template rows, owner row,
19 RLS tables, private `ws-private` bucket with 7 policies, anon can execute only `ws_verify_certificate`.
A rolled-back end-to-end run (org → workshop → 6 sessions → 3 groups → live creates 3 active `sc_classes`
→ attendance → lock → certificate → verify → completed deactivates them; non-staff and anon denied with
42501) passed on the live database and left no rows behind.

Changes made at apply time: `m.class_stats` read directly (column verified as jsonb, so the `to_jsonb(m)`
workaround below was reverted); the 17 §3.9 stub modules were not seeded (superseded by curriculum.json,
unused by any template); `0006_ws_hardening.sql` added after the Supabase security advisor run.
The files were produced by `build_ws_migrations.py` (scratchpad), which slices the doc's ```sql blocks
byte-for-byte and applies only the fixes listed below; `lint_ws_migrations.py` is the static check.

## Apply order (each file = one transaction)

| # | File | Contents | Depends on |
|---|------|----------|------------|
| 1 | `20261018_0001_ws_core.sql` | §3.1 utility fns → §3.2 19 tables + sequence → §3.3 role helpers → §3.4 triggers → §3.5 RLS (enable + policies) | — |
| 2 | `20261018_0002_ws_rpc.sql` | §3.6.1–3.6.7: 20 RPCs (group stats, overview, groups/activation/status, participants, curriculum, deliverables/certificates, whoami/add_staff/my_context) | 0001 |
| 3 | `20261018_0003_ws_grants.sql` | §3.7: revoke anon on all `ws_*` tables, column-level insert/update grants, function execute policy (internals hidden, `ws_verify_certificate` public) | 0002 (names `ws_internal_*` signatures) |
| 4 | `20261018_0004_ws_storage.sql` | §3.8: private bucket `ws-private` + 7 `storage.objects` policies | 0001 (`ws_try_uuid`, role helpers) |
| 5 | `20261018_0005_ws_seed.sql` | §3.9 owner bootstrap (arielohayon3@gmail.com) + 17 §3.9 stub modules + **curriculum.json**: 25 modules, 3 templates, 16 template-module rows. Idempotent (`on conflict do nothing` / `where not exists`). | 0001 (needs an `auth.users` row for the owner e-mail, otherwise 0 staff rows) |
| — | `20261018_ws_checks_READONLY.sql` | §3.10 checks + extra SELECTs (RLS flags, grants, policies, counts, `sc_models.class_stats` probe). **Never apply as a migration**; run in the SQL editor. | after 1–5 |

After 0003, re-run its function block whenever a later migration adds a `ws_` function (Supabase default
privileges grant EXECUTE to anon/authenticated on new functions).

## What was NOT changed

- Doc order already satisfies every dependency: §3.3 helpers precede §3.4 triggers and §3.5 policies; every FK
  target table is created before the table that references it; SQL-language bodies (`ws_is_*`, `ws_my_*`,
  `ws_internal_group_stats`, `ws_internal_set_user_team`, `ws_verify_certificate`, `ws_whoami`) only reference
  objects created earlier. No block was reordered.
- No HTML entities were present in the doc (grep for `&gt;|&lt;|&amp;` = 0 hits).
- No DDL on `sc_*`, `profiles`, `auth.*`; only `insert into storage.buckets` and policies on `storage.objects` (§3.8),
  and DML on `sc_classes` / `auth.users.raw_user_meta_data` inside RPCs (doc design).
- All 29 `security definer` functions carry `set search_path = public, pg_temp` (verified by lint).

## Fixes applied to the doc's SQL (file:line → reason)

| File:line | Change | Reason |
|-----------|--------|--------|
| `0002_ws_rpc.sql:81` (§3.6.1 `mdl` CTE) | `m.class_stats` → `to_jsonb(m)->'class_stats'` | `sc_models.class_stats` is not in `smart-city/lib/types.ts` (`Model`) and is only read via `(m as any).class_stats` in `lib/patrol.ts:162`, so its existence is unverified. `ws_internal_group_stats` is `LANGUAGE sql`: a missing column fails at `CREATE FUNCTION` and aborts the whole 0002 transaction. `to_jsonb(row)->'col'` returns the identical jsonb when the column exists and `NULL` when it doesn't. |
| `0002_ws_rpc.sql:530` (§3.6.6 `ws_lock_deliverable`) | same substitution | same reason (plpgsql, so a runtime rather than create-time failure, but same unverified column). |
| `0005_ws_seed.sql:36–458` (§3.9) | §3.9's two templates (`corewise-6-sessions`, `corewise-hackathon`) and their 34 template-module rows are **replaced** by curriculum.json's three templates (`corewise-6-sessions`, `hackathon-day`, `corporate-half-day`) with 6 + 5 + 5 rows. The §3.9 owner bootstrap and its 17 stub modules are kept verbatim. | Task requirement: every curriculum.json module and template must be seeded. The §3.9 templates are the same two products in stub form; the partial unique index `ws_templates_one_default (format) where is_default` allows only one default per format, so both sets cannot coexist as defaults, and the stub `corewise-6-sessions` slug collides with the curriculum one. |
| `0005_ws_seed.sql` module rows | slug = curriculum `id` with `_` → `-` (e.g. `core_s1_machine_vision_intro` → `core-s1-machine-vision-intro`) | `ws_modules.slug CHECK (slug ~ '^[a-z0-9-]{3,60}$')` forbids underscores. Mapping is reversible. |
| `0005_ws_seed.sql` module rows | curriculum `type` `assessment` → `module_type 'practice'`, `reflection` → `'mixed'`; original kept as tag `type:assessment` / `type:reflection` | `module_type CHECK in ('theory','practice','demo','mixed')` (also on `ws_session_modules`). Changing the CHECK would be schema DDL beyond the doc. |
| `0005_ws_seed.sql` template rows | `corporate_half_day` → `format 'custom'`, `is_default false` | `format CHECK in ('sessions','hackathon','custom')`; a default for `custom` would make `ws_instantiate_curriculum` auto-pick the corporate template for every custom workshop. Pass `p_template` explicitly for corporate workshops. |
| `ws_checks_READONLY.sql:7` (§3.10) | expected `ws_template_modules` count 34 → 16; added counts/grants/policy/bucket checks | follows the seed above. |
| all files | 4-line header comment per file; section banners (`-- ═══ §3.x ═══`) | navigation only; no SQL change. |

### curriculum.json → ws_modules column mapping (no schema change)

| curriculum.json | ws_modules |
|---|---|
| `id` | `slug` (`_`→`-`) |
| `title`, `duration_min`, `objectives` | `title`, `duration_minutes`, `objectives` |
| `type` | `module_type` (mapped, see above) |
| `agenda[]` | `summary` = one-line "סדר יום: title (N ד׳) · …"; full agenda (minutes · title — description) appended to `facilitator_notes` |
| `exercises[].{title,steps,tool_hook}` | `exercises` jsonb `[{title, instructions (numbered steps), kind ('group' / 'individual' for assessment), tool_hook}]`; `question_bank` attached as `questions` on the "שאלון מושגים" exercise |
| `materials[]` (strings) | `materials` jsonb `[{label, kind:'supply'}]` |
| `facilitator_notes`, `assessment`, `differentiation` | `facilitator_notes` (sections "── סדר יום ──", "── הערכה ──", "── התאמות ──") |
| `tags`, `audience` | `tags` + `audience:school` / `audience:adult` |
| exercises using series_capture / phone_tagger / cloud_train / live_cam / pocket_trainer / map | `requires_app = true` |
| pipeline stage (not in JSON) | hand-assigned from content; `assess_concept_check` and `adult_governance_privacy` left null |

Template extras (`embedded_modules`, `optional_slots`, `overrides`, `schedule` breaks/times) are written into
`ws_template_modules.notes` of the relevant row; `format_notes` + unmapped overrides go into
`ws_curriculum_templates.description`. `duration_override` is null everywhere (720 / 390 / 240 already match).

## Unresolved doubts

1. **`sc_models.class_stats`** — existence not verifiable from code (see fix 1). The to_jsonb form is safe either way;
   the READONLY file probes `information_schema.columns`. If the column exists as `text` rather than `jsonb`, the
   value arrives as a JSON string instead of a parsed array.
2. **Owner bootstrap depends on an existing `auth.users` row** for `arielohayon3@gmail.com`; if absent, `ws_staff`
   stays empty and every admin-gated policy/RPC denies. Check with `select role, email from ws_staff`.
3. **`ws_guard_staff` / `ws_is_service()` during migration** — the seed grants `owner`, which the trigger allows
   only when `ws_is_service()` is true: `session_user` must not be `authenticator`/`anon`/`authenticated`.
   Supabase CLI, dashboard SQL editor and the management API all run as `postgres`, so this holds; running the
   seed through PostgREST would fail with 42501.
4. **17 §3.9 stub modules** (`what-is-seeing` … `certificates`) remain in the library but no template uses them;
   they overlap in topic with the 25 curriculum modules. If the library looks cluttered, archive them:
   `update ws_modules set is_archived = true where slug in ('what-is-seeing','grouping-roles','app-onboarding','mega-problem','decomposition','vision-task-framing','research-sprint','how-models-learn','data-plan','data-collection','tagging-bbox','train-model','evaluate-failures','build-presentation','demo-day','mega-solution','certificates');`
5. **No structured home** for `agenda`, `assessment`, `differentiation`, `audience`, `demo_day_rubric`,
   `certificate` text variants: the first four are preserved as text (above); `demo_day_rubric` and the
   `certificate` variants are **not seeded** (no `ws_*` table holds them). If the UI needs them structured,
   a follow-up `alter table ws_modules add column content jsonb` + snapshot change in `ws_instantiate_curriculum`
   is the clean path.
6. **FKs to `auth.users`** (`ws_staff.user_id`, `created_by`, `marked_by`, …) create RI triggers on `auth.users`
   — the doc chose this deliberately (standard Supabase practice) while refusing the same for `sc_*`. Not changed.
7. **Storage policies on `storage.objects`** require the migration role to be allowed to create policies there
   (true for `postgres` on current Supabase). If 0004 fails with "must be owner of table objects", run it from
   the dashboard SQL editor.
8. Nothing has been executed: no parser or psql was available locally, so verification is the static lint
   (dependency order, search_path, name uniqueness, FK order, RLS coverage, dollar-quote balance) plus a
   byte-identity check of every §3.1–3.8 block against the doc.
