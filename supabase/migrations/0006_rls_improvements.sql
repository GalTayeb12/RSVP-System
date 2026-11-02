-- Migration 0006: RLS hardening
-- Run in Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. can_manage_event — owner or admin only (not helper)
-- ══════════════════════════════════════════════════════════════════════════════

create function can_manage_event(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
      or exists (select 1 from events where id = e and owner_id = auth.uid());
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. campaigns: helpers can read, only owners/admins can write
-- ══════════════════════════════════════════════════════════════════════════════

drop policy "event campaigns" on campaigns;

create policy "read campaigns" on campaigns
  for select using (can_access_event(event_id));

create policy "manage campaigns insert" on campaigns
  for insert with check (can_manage_event(event_id));

create policy "manage campaigns update" on campaigns
  for update using (can_manage_event(event_id));

create policy "manage campaigns delete" on campaigns
  for delete using (can_manage_event(event_id));

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. messages: helpers can read, only owners/admins can write
-- ══════════════════════════════════════════════════════════════════════════════

drop policy "guest messages" on messages;

create policy "read messages" on messages
  for select
  using (
    exists (
      select 1 from guests g
      where g.id = guest_id and can_access_event(g.event_id)
    )
  );

create policy "manage messages insert" on messages
  for insert
  with check (
    exists (
      select 1 from guests g
      where g.id = guest_id and can_manage_event(g.event_id)
    )
  );

create policy "manage messages update" on messages
  for update
  using (
    exists (
      select 1 from guests g
      where g.id = guest_id and can_manage_event(g.event_id)
    )
  );

create policy "manage messages delete" on messages
  for delete
  using (
    exists (
      select 1 from guests g
      where g.id = guest_id and can_manage_event(g.event_id)
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. events: owner can update fields, but CANNOT change owner_id
--    WITH CHECK on new row: new owner_id must equal current user (or be admin)
-- ══════════════════════════════════════════════════════════════════════════════

drop policy "owner updates event" on events;

create policy "owner updates event" on events
  for update
  using  (owner_id = auth.uid() or is_admin())
  with check (
    is_admin()
    or owner_id = auth.uid()   -- new row's owner_id must still be me
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. profiles: no user can change their own role via app
--    Enforce with a trigger that fires before any UPDATE.
--    Admin bypasses this because admin uses the service role key in code.
-- ══════════════════════════════════════════════════════════════════════════════

create function prevent_role_self_change() returns trigger language plpgsql
security definer set search_path = public as $$
begin
  -- Block if the caller is authenticated (not postgres/service_role),
  -- is changing role, and is changing THEIR OWN profile.
  if new.id = auth.uid()
     and new.role <> old.role
     and not is_admin()
  then
    raise exception 'אין הרשאה לשנות תפקיד';
  end if;
  return new;
end $$;

create trigger profiles_prevent_role_self_change
  before update on profiles
  for each row execute function prevent_role_self_change();

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. event_members: existing policy is already correct (owner-only write).
--    Documented here for completeness — no change needed.
--    "owner manages members" policy already requires owner_id = auth.uid().
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. storage: upload/update/delete restricted to can_manage_event
-- ══════════════════════════════════════════════════════════════════════════════

drop policy if exists "event members can upload invitations"  on storage.objects;
drop policy if exists "event members can update invitations"  on storage.objects;
drop policy if exists "event members can delete invitations"  on storage.objects;

create policy "event managers can upload invitations"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'invitations'
    and can_manage_event((storage.foldername(name))[1]::uuid)
  );

create policy "event managers can update invitations"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'invitations'
    and can_manage_event((storage.foldername(name))[1]::uuid)
  );

create policy "event managers can delete invitations"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'invitations'
    and can_manage_event((storage.foldername(name))[1]::uuid)
  );
