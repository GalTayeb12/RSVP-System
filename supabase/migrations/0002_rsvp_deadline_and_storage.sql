-- Migration 0002: RSVP deadline + invitation image storage
-- Run in Supabase SQL Editor

-- Add rsvp_deadline to events (null = no deadline enforced)
alter table events add column if not exists rsvp_deadline timestamptz;

-- ── Storage bucket for invitation images ──────────────────────────────────────
-- Public reads; only authenticated event members can upload/update/delete.
-- Files are stored as {event_id}/{filename} so policies can check event access.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invitations',
  'invitations',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) on conflict (id) do nothing;

create policy "public can read invitations"
  on storage.objects for select
  using (bucket_id = 'invitations');

create policy "event members can upload invitations"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'invitations'
    and can_access_event((storage.foldername(name))[1]::uuid)
  );

create policy "event members can update invitations"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'invitations'
    and can_access_event((storage.foldername(name))[1]::uuid)
  );

create policy "event members can delete invitations"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'invitations'
    and can_access_event((storage.foldername(name))[1]::uuid)
  );
