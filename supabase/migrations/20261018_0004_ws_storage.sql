-- 20261018_0004_ws_storage — §3.8 private bucket + storage.objects policies. Requires 0001 (ws_try_uuid, role helpers).
-- Source: workshops-os-plan/architecture.md §3 (2026-10-17). Generated 2026-10-18 by
-- build_ws_migrations.py; SQL is the doc's text verbatim except the fixes listed in README.md.
-- Target: Supabase project eaawnjvabcnznukewnlj, PostgreSQL 17.6. Additive only: no DDL on sc_*, profiles, auth.*.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ws-private', 'ws-private', false, 52428800,
        array['application/pdf', 'image/png', 'image/jpeg',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

create policy ws_private_staff_read on storage.objects for select to authenticated
  using (bucket_id = 'ws-private'
         and public.ws_is_workshop_staff(public.ws_try_uuid((storage.foldername(name))[2])));
create policy ws_private_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ws-private'
              and public.ws_can_edit_workshop(public.ws_try_uuid((storage.foldername(name))[2])));
create policy ws_private_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'ws-private'
         and public.ws_can_edit_workshop(public.ws_try_uuid((storage.foldername(name))[2])));
create policy ws_private_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ws-private'
         and public.ws_can_edit_workshop(public.ws_try_uuid((storage.foldername(name))[2])));

create policy ws_private_group_read on storage.objects for select to authenticated
  using (bucket_id = 'ws-private' and (storage.foldername(name))[3] = 'g'
         and public.ws_try_uuid((storage.foldername(name))[4]) in (select public.ws_my_group_ids()));
create policy ws_private_group_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'ws-private' and (storage.foldername(name))[3] = 'g'
              and public.ws_try_uuid((storage.foldername(name))[4]) in (select public.ws_my_group_ids()));

create policy ws_private_own_cert on storage.objects for select to authenticated
  using (bucket_id = 'ws-private' and (storage.foldername(name))[3] = 'c'
         and public.ws_try_uuid(split_part(storage.filename(name), '.', 1)) in
             (select p.id from public.ws_participants p where p.user_id = (select auth.uid())));
