-- =============================================================
-- RLS test suite
-- Run in Supabase: SQL Editor > New query > paste this whole file > Run.
--
-- Results appear in the Results tab: one row per test, FAILs first.
-- All test data (users, events, guests...) is created inside a
-- sub-transaction and rolled back at the end, so nothing is left behind.
-- Safe to run as many times as you like.
-- =============================================================

-- Runs one SQL statement as a given user (or as anon when uid is null)
-- and reports what happened:
--   'ok:N'    the statement ran; N = rows returned / affected
--   'denied'  blocked by RLS or a permission check
--   'error: ...' anything else (a real problem with the test or schema)
create or replace function pg_temp.run_as(uid uuid, stmt text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  if uid is null then
    execute 'set local role anon';
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
  else
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', uid::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  end if;

  begin
    if stmt ~* '^\s*select' then
      execute 'select count(*) from (' || stmt || ') q' into n;
    else
      execute stmt;
      get diagnostics n = row_count;
    end if;
  exception
    when insufficient_privilege or raise_exception or check_violation then
      execute 'reset role';
      return 'denied';
    when others then
      execute 'reset role';
      return 'error: ' || sqlerrm;
  end;

  execute 'reset role';
  return 'ok:' || n;
end $$;

create or replace function pg_temp.rls_tests()
returns table (num int, test text, expected text, actual text, result text)
language plpgsql
as $$
declare
  -- fixed test ids (valid hex UUIDs)
  u_admin  constant uuid := 'a0000000-0000-0000-0000-0000000000a0';
  u_ownerA constant uuid := 'a0000000-0000-0000-0000-0000000000a1';
  u_ownerB constant uuid := 'a0000000-0000-0000-0000-0000000000b1';
  u_helper constant uuid := 'a0000000-0000-0000-0000-0000000000c1';
  e_A      constant uuid := 'e0000000-0000-0000-0000-00000000000a';
  e_B      constant uuid := 'e0000000-0000-0000-0000-00000000000b';
  g_A      constant uuid := 'f0000000-0000-0000-0000-00000000000a';
  g_B      constant uuid := 'f0000000-0000-0000-0000-00000000000b';
  c_A      constant uuid := 'c0000000-0000-0000-0000-00000000000a';

  names text[] := '{}';
  exps  text[] := '{}';
  acts  text[] := '{}';
  i int := 0;
begin
  begin  -- sub-transaction: everything in here is rolled back at the end

    -- ---------- fixtures (created as the SQL Editor's own role) ----------
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    select id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
    from (values (u_admin,  'rls_admin@rsvp.test'),
                 (u_ownerA, 'rls_owner_a@rsvp.test'),
                 (u_ownerB, 'rls_owner_b@rsvp.test'),
                 (u_helper, 'rls_helper@rsvp.test')) v(id, email);

    insert into profiles (id, username, role) values
      (u_admin,  'rls_admin',   'admin'),
      (u_ownerA, 'rls_owner_a', 'owner'),
      (u_ownerB, 'rls_owner_b', 'owner'),
      (u_helper, 'rls_helper',  'helper');

    insert into events (id, owner_id, title) values
      (e_A, u_ownerA, 'RLS test event A'),
      (e_B, u_ownerB, 'RLS test event B');

    insert into event_members (event_id, user_id, role) values (e_A, u_helper, 'helper');

    insert into guests (id, event_id, first_name, phone) values
      (g_A, e_A, 'Guest A', '+972500000001'),
      (g_B, e_B, 'Guest B', '+972500000002');

    insert into campaigns (id, event_id, kind, template_text)
      values (c_A, e_A, 'invitation', 'test');

    insert into messages (campaign_id, guest_id, channel) values (c_A, g_A, 'whatsapp_link');

    -- ---------- tests ----------
    -- Each test: name, expected result, actual result

    -- guests: isolation between couples
    names := array_append(names, ('Owner A sees only own guests')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, 'select 1 from guests'))::text);

    names := array_append(names, ('Owner A cannot read event B guests')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format('select 1 from guests where event_id = %L', e_B)))::text);

    names := array_append(names, ('Owner A cannot add guest to event B')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'insert into guests (event_id, first_name, phone) values (%L, ''X'', ''+972500000099'')', e_B)))::text);

    names := array_append(names, ('Owner A cannot edit event B guest')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'update guests set first_name = ''hacked'' where id = %L', g_B)))::text);

    names := array_append(names, ('Owner A cannot delete event B guest')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format('delete from guests where id = %L', g_B)))::text);

    -- helper: can manage guests, cannot send
    names := array_append(names, ('Helper sees event A guests')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, 'select 1 from guests'))::text);

    names := array_append(names, ('Helper can add guest to event A')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'insert into guests (event_id, first_name, phone) values (%L, ''Helper guest'', ''+972500000003'')', e_A)))::text);

    names := array_append(names, ('Helper can read campaigns')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, 'select 1 from campaigns'))::text);

    names := array_append(names, ('Helper cannot create campaign')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'insert into campaigns (event_id, kind, template_text) values (%L, ''reminder'', ''x'')', e_A)))::text);

    names := array_append(names, ('Helper cannot edit campaign')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'update campaigns set template_text = ''hacked'' where id = %L', c_A)))::text);

    names := array_append(names, ('Helper cannot delete campaign')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format('delete from campaigns where id = %L', c_A)))::text);

    names := array_append(names, ('Helper can read messages')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, 'select 1 from messages'))::text);

    names := array_append(names, ('Helper cannot create message')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'insert into messages (campaign_id, guest_id, channel) values (%L, %L, ''whatsapp_link'')', c_A, g_A)))::text);

    names := array_append(names, ('Helper cannot add members to event')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'insert into event_members (event_id, user_id, role) values (%L, %L, ''helper'')', e_A, u_ownerB)))::text);

    -- owner: can manage own event
    names := array_append(names, ('Owner A can create campaign')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'insert into campaigns (event_id, kind, template_text) values (%L, ''reminder'', ''x'')', e_A)))::text);

    names := array_append(names, ('Owner A can edit own event')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'update events set title = ''renamed'' where id = %L', e_A)))::text);

    names := array_append(names, ('Owner A cannot transfer event to owner B')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'update events set owner_id = %L where id = %L', u_ownerB, e_A)))::text);

    names := array_append(names, ('Owner A cannot see event B')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format('select 1 from events where id = %L', e_B)))::text);

    names := array_append(names, ('Owner B cannot read event A campaigns')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerB, 'select 1 from campaigns'))::text);

    names := array_append(names, ('Owner A can add helper to own event')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'insert into event_members (event_id, user_id, role) values (%L, %L, ''helper'')', e_A, u_ownerB)))::text);

    -- profiles: no self-promotion
    -- Blocked by RLS before the trigger even runs: 0 rows change.
    names := array_append(names, ('Owner A cannot make self admin (0 rows changed)')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'update profiles set role = ''admin'' where id = %L', u_ownerA)))::text);

    names := array_append(names, ('Owner A cannot edit owner B profile')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'update profiles set full_name = ''hacked'' where id = %L', u_ownerB)))::text);

    -- admin: sees and manages everything
    names := array_append(names, ('Admin sees all test guests')::text);
    exps := array_append(exps, ('ok:3')::text);
    acts := array_append(acts, (pg_temp.run_as(u_admin, format(
      'select 1 from guests where event_id in (%L, %L)', e_A, e_B)))::text);

    names := array_append(names, ('Admin can transfer event ownership')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_admin, format(
      'update events set owner_id = %L where id = %L', u_ownerB, e_B)))::text);

    -- not logged in
    names := array_append(names, ('Anonymous user sees no guests')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(null, 'select 1 from guests'))::text);

    names := array_append(names, ('Anonymous user sees no events')::text);
    exps := array_append(exps, ('ok:0')::text);
    acts := array_append(acts, (pg_temp.run_as(null, 'select 1 from events'))::text);

    -- storage: invitation images
    names := array_append(names, ('Helper cannot upload invitation image')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_helper, format(
      'insert into storage.objects (bucket_id, name) values (''invitations'', %L)', e_A || '/rls-test.png')))::text);

    names := array_append(names, ('Owner B cannot upload to event A folder')::text);
    exps := array_append(exps, ('denied')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerB, format(
      'insert into storage.objects (bucket_id, name) values (''invitations'', %L)', e_A || '/rls-test.png')))::text);

    names := array_append(names, ('Owner A can upload to own event folder')::text);
    exps := array_append(exps, ('ok:1')::text);
    acts := array_append(acts, (pg_temp.run_as(u_ownerA, format(
      'insert into storage.objects (bucket_id, name) values (''invitations'', %L)', e_A || '/rls-test.png')))::text);

    -- undo all fixtures and test writes
    raise exception 'rls_tests_rollback';
  exception
    when others then
      if sqlerrm <> 'rls_tests_rollback' then
        names := array_append(names, ('SCRIPT ERROR (tests stopped here)')::text);
        exps := array_append(exps, ('-')::text);
        acts := array_append(acts, (sqlerrm)::text);
      end if;
  end;

  return query
    with r as (
      select t.n::int as n, names[t.n] as tn, exps[t.n] as ex, acts[t.n] as ac,
             case when acts[t.n] = exps[t.n] then 'PASS' else 'FAIL' end as res
      from generate_subscripts(names, 1) as t(n)
    )
    select 0, 'SUMMARY'::text, (count(*))::text || ' tests',
           (count(*) filter (where res = 'PASS'))::text || ' passed, '
             || (count(*) filter (where res = 'FAIL'))::text || ' failed',
           case when bool_and(res = 'PASS') then 'PASS' else 'FAIL' end
    from r
    union all
    (select n, tn, ex, ac, res from r order by (res = 'PASS'), n);
end $$;

-- The only statement whose output the SQL Editor shows:
select * from pg_temp.rls_tests();
