-- ════════════════════════════════════════════════════════════════════════════
-- RLS Policy Tests
-- Run in Supabase SQL Editor.
-- Always rolls back — leaves no data behind.
-- ════════════════════════════════════════════════════════════════════════════
-- How it works:
--   1. Creates test fixtures as the postgres superuser (bypasses RLS).
--   2. Switches to the `authenticated` role with spoofed JWT claims to
--      simulate each persona (admin / owner_a / owner_b / helper).
--   3. Runs queries and raises NOTICE with PASS / FAIL.
--   4. ROLLBACK removes all test data.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Fixture UUIDs ─────────────────────────────────────────────────────────────

do $$ begin
  -- Re-usable constants via session-level settings
  perform set_config('test.admin_id',   '00000000-test-0000-0000-000000000001', false);
  perform set_config('test.owner_a_id', '00000000-test-0000-0000-000000000002', false);
  perform set_config('test.owner_b_id', '00000000-test-0000-0000-000000000003', false);
  perform set_config('test.helper_id',  '00000000-test-0000-0000-000000000004', false);
  perform set_config('test.event_a_id', '00000000-test-0001-0000-000000000001', false);
  perform set_config('test.event_b_id', '00000000-test-0001-0000-000000000002', false);
end $$;

-- ── Create test auth users (service-role bypass) ──────────────────────────────

insert into auth.users (id, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  (current_setting('test.admin_id')::uuid,   'admin_rls_test@rsvp.local',   now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  (current_setting('test.owner_a_id')::uuid, 'owner_a_rls_test@rsvp.local', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  (current_setting('test.owner_b_id')::uuid, 'owner_b_rls_test@rsvp.local', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  (current_setting('test.helper_id')::uuid,  'helper_rls_test@rsvp.local',  now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated');

insert into profiles (id, username, role) values
  (current_setting('test.admin_id')::uuid,   'admin_rls_test',   'admin'),
  (current_setting('test.owner_a_id')::uuid, 'owner_a_rls_test', 'owner'),
  (current_setting('test.owner_b_id')::uuid, 'owner_b_rls_test', 'owner'),
  (current_setting('test.helper_id')::uuid,  'helper_rls_test',  'helper');

insert into events (id, owner_id, title, host_names) values
  (current_setting('test.event_a_id')::uuid, current_setting('test.owner_a_id')::uuid, 'Test Event A', 'Owner A'),
  (current_setting('test.event_b_id')::uuid, current_setting('test.owner_b_id')::uuid, 'Test Event B', 'Owner B');

insert into event_members (event_id, user_id, role) values
  (current_setting('test.event_a_id')::uuid, current_setting('test.helper_id')::uuid, 'helper');

insert into guests (id, event_id, first_name, phone, side) values
  ('00000000-test-0002-0000-000000000001', current_setting('test.event_a_id')::uuid, 'Test Guest', '+972501234567', 'shared');

insert into campaigns (id, event_id, kind, channel, template_text, audience) values
  ('00000000-test-0003-0000-000000000001', current_setting('test.event_a_id')::uuid, 'invitation', 'whatsapp_link', 'Test', 'all');

insert into messages (id, campaign_id, guest_id, channel, status) values
  ('00000000-test-0004-0000-000000000001',
   '00000000-test-0003-0000-000000000001',
   '00000000-test-0002-0000-000000000001',
   'whatsapp_link', 'queued');

-- ── Helper: switch to a persona ───────────────────────────────────────────────

create or replace function test_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid::text)::text, true);
end $$;

-- ── Test runner ───────────────────────────────────────────────────────────────

do $tests$
declare
  cnt     int;
  ok      bool;
  pass_n  int := 0;
  fail_n  int := 0;

  ADMIN_ID   uuid := current_setting('test.admin_id')::uuid;
  OWNER_A    uuid := current_setting('test.owner_a_id')::uuid;
  OWNER_B    uuid := current_setting('test.owner_b_id')::uuid;
  HELPER     uuid := current_setting('test.helper_id')::uuid;
  EVENT_A    uuid := current_setting('test.event_a_id')::uuid;
  EVENT_B    uuid := current_setting('test.event_b_id')::uuid;

  procedure pass(label text) as $$
  begin raise notice 'PASS  %', label; pass_n := pass_n + 1; end $$;

  procedure fail(label text) as $$
  begin raise warning 'FAIL  %', label; fail_n := fail_n + 1; end $$;

  procedure check_eq(label text, actual int, expected int) as $$
  begin
    if actual = expected then pass(label);
    else
      raise warning 'FAIL  % — expected %, got %', label, expected, actual;
      fail_n := fail_n + 1;
    end if;
  end $$;

begin

  -- ════════════════════════════════════════════════════════════════
  -- EVENTS — read access
  -- ════════════════════════════════════════════════════════════════

  set local role to authenticated;
  perform test_as(OWNER_A);
  select count(*) into cnt from events where id = EVENT_A;
  call check_eq('owner_a reads own event', cnt, 1);

  perform test_as(OWNER_A);
  select count(*) into cnt from events where id = EVENT_B;
  call check_eq('owner_a cannot read owner_b event', cnt, 0);

  perform test_as(OWNER_B);
  select count(*) into cnt from events where id = EVENT_A;
  call check_eq('owner_b cannot read owner_a event', cnt, 0);

  perform test_as(HELPER);
  select count(*) into cnt from events where id = EVENT_A;
  call check_eq('helper reads event they belong to', cnt, 1);

  perform test_as(HELPER);
  select count(*) into cnt from events where id = EVENT_B;
  call check_eq('helper cannot read event they do not belong to', cnt, 0);

  perform test_as(ADMIN_ID);
  select count(*) into cnt from events;
  call check_eq('admin reads all events (at least 2)', cnt, 2);

  -- ════════════════════════════════════════════════════════════════
  -- EVENTS — owner cannot change owner_id
  -- ════════════════════════════════════════════════════════════════

  reset role;

  set local role to authenticated;
  perform test_as(OWNER_A);

  begin
    update events set owner_id = OWNER_B where id = EVENT_A;
    call fail('owner_a changed owner_id — SHOULD HAVE BEEN BLOCKED');
  exception when others then
    -- either RLS blocks (no rows updated) or check violation
    call pass('owner_a cannot change owner_id');
  end;

  -- Verify owner_id is unchanged
  reset role;
  select count(*) into cnt from events where id = EVENT_A and owner_id = OWNER_A;
  call check_eq('owner_id still OWNER_A after blocked attempt', cnt, 1);

  -- ════════════════════════════════════════════════════════════════
  -- CAMPAIGNS — helpers can read, cannot write
  -- ════════════════════════════════════════════════════════════════

  set local role to authenticated;

  perform test_as(HELPER);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call check_eq('helper reads campaigns for accessible event', cnt, 1);

  perform test_as(HELPER);
  begin
    insert into campaigns (event_id, kind, channel, template_text, audience)
    values (EVENT_A, 'reminder', 'whatsapp_link', 'hello', 'all');
    call fail('helper inserted campaign — SHOULD HAVE BEEN BLOCKED');
  exception when others then
    call pass('helper cannot insert campaign');
  end;

  perform test_as(OWNER_B);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call check_eq('owner_b cannot read owner_a campaigns', cnt, 0);

  perform test_as(OWNER_A);
  select count(*) into cnt from campaigns where event_id = EVENT_A;
  call check_eq('owner_a reads own campaigns', cnt, 1);

  -- ════════════════════════════════════════════════════════════════
  -- MESSAGES — helpers can read, cannot update status
  -- ════════════════════════════════════════════════════════════════

  perform test_as(HELPER);
  select count(*) into cnt from messages
    where id = '00000000-test-0004-0000-000000000001';
  call check_eq('helper reads messages for accessible event', cnt, 1);

  perform test_as(HELPER);
  begin
    update messages
      set status = 'sent', sent_at = now()
      where id = '00000000-test-0004-0000-000000000001';
    -- RLS UPDATE policy blocks this — update affects 0 rows, no exception
    get diagnostics cnt = row_count;
    if cnt = 0 then
      call pass('helper cannot update message status (0 rows affected)');
    else
      call fail('helper updated message status — SHOULD HAVE BEEN BLOCKED');
    end if;
  end;

  perform test_as(OWNER_A);
  update messages
    set status = 'sent', sent_at = now()
    where id = '00000000-test-0004-0000-000000000001';
  get diagnostics cnt = row_count;
  call check_eq('owner_a can update message status', cnt, 1);

  -- ════════════════════════════════════════════════════════════════
  -- PROFILES — user cannot change own role
  -- ════════════════════════════════════════════════════════════════

  perform test_as(OWNER_A);
  begin
    update profiles set role = 'admin' where id = OWNER_A;
    call fail('owner_a changed own role to admin — SHOULD HAVE BEEN BLOCKED');
  exception when others then
    call pass('owner_a cannot change own role to admin');
  end;

  reset role;
  select count(*) into cnt from profiles where id = OWNER_A and role = 'owner';
  call check_eq('owner_a role still "owner" after blocked attempt', cnt, 1);

  -- Admin CAN change roles (uses service role in app code, but test via admin RLS)
  set local role to authenticated;
  perform test_as(ADMIN_ID);
  update profiles set full_name = 'Updated Name' where id = OWNER_A;
  get diagnostics cnt = row_count;
  call check_eq('admin can update profile', cnt, 1);

  -- ════════════════════════════════════════════════════════════════
  -- EVENT_MEMBERS — only owner can add/remove helpers
  -- ════════════════════════════════════════════════════════════════

  perform test_as(HELPER);
  begin
    insert into event_members (event_id, user_id, role)
    values (EVENT_B, HELPER, 'helper');
    call fail('helper added self to event_b — SHOULD HAVE BEEN BLOCKED');
  exception when others then
    call pass('helper cannot add self to another event');
  end;

  perform test_as(OWNER_A);
  begin
    insert into event_members (event_id, user_id, role)
    values (EVENT_A, OWNER_B, 'helper');
    call pass('owner_a can add helper to own event');
  exception when others then
    call fail('owner_a could not add helper to own event');
  end;

  perform test_as(OWNER_A);
  begin
    insert into event_members (event_id, user_id, role)
    values (EVENT_B, HELPER, 'helper');
    call fail('owner_a added helper to owner_b event — SHOULD HAVE BEEN BLOCKED');
  exception when others then
    call pass('owner_a cannot add helper to another owner event');
  end;

  -- ════════════════════════════════════════════════════════════════
  -- GUESTS — helpers can add/read guests for their event
  -- ════════════════════════════════════════════════════════════════

  perform test_as(HELPER);
  select count(*) into cnt from guests where event_id = EVENT_A;
  call check_eq('helper reads guests for accessible event', cnt, 1);

  perform test_as(HELPER);
  select count(*) into cnt from guests where event_id = EVENT_B;
  call check_eq('helper cannot read guests for inaccessible event', cnt, 0);

  -- ════════════════════════════════════════════════════════════════
  -- Summary
  -- ════════════════════════════════════════════════════════════════

  reset role;
  raise notice '══════════════════════════════════════════════════';
  raise notice 'Results: % passed, % failed', pass_n, fail_n;
  raise notice '══════════════════════════════════════════════════';
  if fail_n > 0 then
    raise warning '% tests FAILED — review the FAIL lines above', fail_n;
  end if;

end $tests$;

rollback;
