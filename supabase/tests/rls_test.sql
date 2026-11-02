-- ════════════════════════════════════════════════════════════════════════════
-- RLS Policy Tests
-- Run in Supabase SQL Editor as a single "Run" click.
-- Results appear in the Results tab (FAIL rows first).
-- Always rolls back — leaves no data behind.
-- ════════════════════════════════════════════════════════════════════════════
-- How it works:
--   1. Creates _rls_results temp table to collect PASS/FAIL rows.
--   2. Inserts test fixtures as the postgres superuser (bypasses RLS).
--   3. The DO block switches roles via EXECUTE 'set local role ...' and
--      sets request.jwt.claims so auth.uid() returns the right UUID.
--   4. Calls rec() to record each result into _rls_results.
--   5. After the DO block, SELECT displays all rows (Results tab).
--   6. ROLLBACK removes all test data including the temp table.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Temp results table ────────────────────────────────────────────────────
-- Created before the DO block so we can SELECT it after.
-- GRANT lets rec() insert even when role = authenticated.

create temp table _rls_results (
  result   text,   -- 'PASS' or 'FAIL'
  test     text,
  expected text,
  actual   text
);

grant insert, select on _rls_results to authenticated;

-- ── Fixture UUIDs ──────────────────────────────────────────────────────────
-- All UUIDs are valid hex (8-4-4-4-12). No letters outside 0-9 a-f.

do $setup$ begin
  perform set_config('t.admin_id',    'a1000000-0000-0000-0000-000000000001', false);
  perform set_config('t.owner_a_id',  'a1000000-0000-0000-0000-000000000002', false);
  perform set_config('t.owner_b_id',  'a1000000-0000-0000-0000-000000000003', false);
  perform set_config('t.helper_id',   'a1000000-0000-0000-0000-000000000004', false);
  perform set_config('t.event_a_id',  'e1000000-0000-0000-0000-000000000001', false);
  perform set_config('t.event_b_id',  'e1000000-0000-0000-0000-000000000002', false);
  perform set_config('t.guest_a_id',  'b1000000-0000-0000-0000-000000000001', false);
  perform set_config('t.campaign_id', 'c1000000-0000-0000-0000-000000000001', false);
  perform set_config('t.message_id',  'd1000000-0000-0000-0000-000000000001', false);
end $setup$;

-- ── Create test auth users ─────────────────────────────────────────────────
-- All Supabase-required columns are supplied.

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  is_super_admin,
  is_sso_user
) values
  (
    current_setting('t.admin_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'admin_rls@rsvp.test', '',
    now(), now(), now(),
    '{}', '{}',
    '', '', '', '',
    false, false
  ),
  (
    current_setting('t.owner_a_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner_a_rls@rsvp.test', '',
    now(), now(), now(),
    '{}', '{}',
    '', '', '', '',
    false, false
  ),
  (
    current_setting('t.owner_b_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'owner_b_rls@rsvp.test', '',
    now(), now(), now(),
    '{}', '{}',
    '', '', '', '',
    false, false
  ),
  (
    current_setting('t.helper_id')::uuid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'helper_rls@rsvp.test', '',
    now(), now(), now(),
    '{}', '{}',
    '', '', '', '',
    false, false
  );

-- ── Profiles ───────────────────────────────────────────────────────────────

insert into profiles (id, username, role) values
  (current_setting('t.admin_id')::uuid,   'admin_rls',   'admin'),
  (current_setting('t.owner_a_id')::uuid, 'owner_a_rls', 'owner'),
  (current_setting('t.owner_b_id')::uuid, 'owner_b_rls', 'owner'),
  (current_setting('t.helper_id')::uuid,  'helper_rls',  'helper');

-- ── Events ─────────────────────────────────────────────────────────────────

insert into events (id, owner_id, title, host_names) values
  (
    current_setting('t.event_a_id')::uuid,
    current_setting('t.owner_a_id')::uuid,
    'RLS Test Event A', 'Owner A'
  ),
  (
    current_setting('t.event_b_id')::uuid,
    current_setting('t.owner_b_id')::uuid,
    'RLS Test Event B', 'Owner B'
  );

-- ── Event members: helper belongs to event_a ──────────────────────────────

insert into event_members (event_id, user_id, role) values
  (
    current_setting('t.event_a_id')::uuid,
    current_setting('t.helper_id')::uuid,
    'helper'
  );

-- ── Guest, campaign, message in event_a ───────────────────────────────────

insert into guests (id, event_id, first_name, phone, side) values
  (
    current_setting('t.guest_a_id')::uuid,
    current_setting('t.event_a_id')::uuid,
    'Test Guest', '+972501234567', 'shared'
  );

insert into campaigns (id, event_id, kind, channel, template_text, audience) values
  (
    current_setting('t.campaign_id')::uuid,
    current_setting('t.event_a_id')::uuid,
    'invitation', 'whatsapp_link', 'Hello', 'all'
  );

insert into messages (id, campaign_id, guest_id, channel, status) values
  (
    current_setting('t.message_id')::uuid,
    current_setting('t.campaign_id')::uuid,
    current_setting('t.guest_a_id')::uuid,
    'whatsapp_link', 'queued'
  );

-- ── Test runner ────────────────────────────────────────────────────────────

do $tests$
declare
  cnt  int;

  -- Switch current role + JWT claims to simulate a logged-in user
  procedure switch_to(uid uuid) as $$
  begin
    execute 'set local role to authenticated';
    execute format(
      'set local "request.jwt.claims" to %L',
      json_build_object('sub', uid::text)::text
    );
  end $$;

  -- Record a test result into _rls_results
  procedure rec(test_name text, expected text, actual_val text) as $$
  begin
    insert into _rls_results (result, test, expected, actual) values (
      case when expected = actual_val then 'PASS' else 'FAIL' end,
      test_name,
      expected,
      actual_val
    );
  end $$;

  ADMIN_ID    uuid := current_setting('t.admin_id')::uuid;
  OWNER_A     uuid := current_setting('t.owner_a_id')::uuid;
  OWNER_B     uuid := current_setting('t.owner_b_id')::uuid;
  HELPER      uuid := current_setting('t.helper_id')::uuid;
  EVENT_A     uuid := current_setting('t.event_a_id')::uuid;
  EVENT_B     uuid := current_setting('t.event_b_id')::uuid;
  GUEST_A     uuid := current_setting('t.guest_a_id')::uuid;
  MESSAGE_A   uuid := current_setting('t.message_id')::uuid;

begin

  -- ════════════════════════════════════════════════════════════════════
  -- EVENTS — read isolation
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(OWNER_A);
  select count(*) into cnt from events where id = EVENT_A;
  call rec('owner_a reads own event', '1', cnt::text);

  call switch_to(OWNER_A);
  select count(*) into cnt from events where id = EVENT_B;
  call rec('owner_a cannot read owner_b event', '0', cnt::text);

  call switch_to(OWNER_B);
  select count(*) into cnt from events where id = EVENT_A;
  call rec('owner_b cannot read owner_a event', '0', cnt::text);

  call switch_to(HELPER);
  select count(*) into cnt from events where id = EVENT_A;
  call rec('helper reads event they belong to', '1', cnt::text);

  call switch_to(HELPER);
  select count(*) into cnt from events where id = EVENT_B;
  call rec('helper cannot read event they do not belong to', '0', cnt::text);

  call switch_to(ADMIN_ID);
  select count(*) into cnt from events where id in (EVENT_A, EVENT_B);
  call rec('admin reads both test events', '2', cnt::text);

  -- ════════════════════════════════════════════════════════════════════
  -- EVENTS — owner cannot change owner_id (WITH CHECK protection)
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(OWNER_A);
  begin
    update events set owner_id = OWNER_B where id = EVENT_A;
    -- If no exception: WITH CHECK blocked silently (0 rows) or allowed
    select count(*) into cnt from events where id = EVENT_A and owner_id = OWNER_B;
    if cnt = 0 then
      call rec('owner_a cannot change owner_id (silent block)', 'BLOCKED', 'BLOCKED');
    else
      call rec('owner_a cannot change owner_id (silent block)', 'BLOCKED', 'NOT BLOCKED');
    end if;
  exception when others then
    call rec('owner_a cannot change owner_id (exception)', 'BLOCKED', 'BLOCKED');
  end;

  execute 'reset role';
  select count(*) into cnt from events where id = EVENT_A and owner_id = OWNER_A;
  call rec('owner_id still OWNER_A after blocked attempt', '1', cnt::text);

  -- ════════════════════════════════════════════════════════════════════
  -- CAMPAIGNS — helpers read; owners/admins write
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(HELPER);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call rec('helper reads campaigns for accessible event', '1', cnt::text);

  call switch_to(OWNER_B);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call rec('owner_b cannot read owner_a campaigns', '0', cnt::text);

  call switch_to(OWNER_A);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call rec('owner_a reads own campaigns', '1', cnt::text);

  call switch_to(HELPER);
  begin
    insert into campaigns (event_id, kind, channel, template_text, audience)
      values (EVENT_A, 'reminder', 'whatsapp_link', 'test', 'all');
    call rec('helper cannot insert campaign', 'BLOCKED', 'NOT BLOCKED');
  exception when others then
    call rec('helper cannot insert campaign', 'BLOCKED', 'BLOCKED');
  end;

  -- ════════════════════════════════════════════════════════════════════
  -- MESSAGES — helpers read; owners/admins write
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(HELPER);
  select count(*) into cnt from messages where id = MESSAGE_A;
  call rec('helper reads messages for accessible event', '1', cnt::text);

  -- RLS UPDATE policy should block helper: expect 0 rows affected
  call switch_to(HELPER);
  update messages set status = 'sent', sent_at = now() where id = MESSAGE_A;
  get diagnostics cnt = row_count;
  call rec('helper cannot update message (0 rows affected)', '0', cnt::text);

  -- Owner can update
  call switch_to(OWNER_A);
  update messages set status = 'sent', sent_at = now() where id = MESSAGE_A;
  get diagnostics cnt = row_count;
  call rec('owner_a can update message status', '1', cnt::text);

  -- ════════════════════════════════════════════════════════════════════
  -- PROFILES — user cannot change own role (trigger protection)
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(OWNER_A);
  begin
    update profiles set role = 'admin' where id = OWNER_A;
    call rec('owner_a cannot elevate own role', 'BLOCKED', 'NOT BLOCKED');
  exception when others then
    call rec('owner_a cannot elevate own role', 'BLOCKED', 'BLOCKED');
  end;

  execute 'reset role';
  select count(*) into cnt from profiles where id = OWNER_A and role = 'owner';
  call rec('owner_a role still owner after blocked attempt', '1', cnt::text);

  call switch_to(ADMIN_ID);
  update profiles set full_name = 'Updated Name' where id = OWNER_A;
  get diagnostics cnt = row_count;
  call rec('admin can update any profile', '1', cnt::text);

  -- ════════════════════════════════════════════════════════════════════
  -- EVENT_MEMBERS — only owner/admin can add members
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(HELPER);
  begin
    insert into event_members (event_id, user_id, role)
      values (EVENT_B, HELPER, 'helper');
    call rec('helper cannot add self to another event', 'BLOCKED', 'NOT BLOCKED');
  exception when others then
    call rec('helper cannot add self to another event', 'BLOCKED', 'BLOCKED');
  end;

  call switch_to(OWNER_A);
  begin
    insert into event_members (event_id, user_id, role)
      values (EVENT_A, OWNER_B, 'helper');
    call rec('owner_a can add member to own event', 'OK', 'OK');
  exception when others then
    call rec('owner_a can add member to own event', 'OK', 'BLOCKED');
  end;

  call switch_to(OWNER_A);
  begin
    insert into event_members (event_id, user_id, role)
      values (EVENT_B, OWNER_A, 'helper');
    call rec('owner_a cannot add member to another owner event', 'BLOCKED', 'NOT BLOCKED');
  exception when others then
    call rec('owner_a cannot add member to another owner event', 'BLOCKED', 'BLOCKED');
  end;

  -- ════════════════════════════════════════════════════════════════════
  -- GUESTS — members read their events only
  -- ════════════════════════════════════════════════════════════════════

  call switch_to(HELPER);
  select count(*) into cnt from guests where event_id = EVENT_A;
  call rec('helper reads guests for accessible event', '1', cnt::text);

  call switch_to(HELPER);
  select count(*) into cnt from guests where event_id = EVENT_B;
  call rec('helper cannot read guests for inaccessible event', '0', cnt::text);

  execute 'reset role';

end $tests$;

-- ── Results — displayed in the Results tab ────────────────────────────────
-- FAIL rows appear first.

select
  result,
  test,
  expected,
  actual
from _rls_results
order by
  case when result = 'FAIL' then 0 else 1 end,
  ctid;

-- Summary row

select
  count(*) filter (where result = 'PASS') as passed,
  count(*) filter (where result = 'FAIL') as failed,
  count(*)                                as total
from _rls_results;

rollback;
