-- Migration 0008: add partner names, gift url, and seating flag to events
-- Idempotent: uses IF NOT EXISTS / column existence checks

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'partner_a_name'
  ) then
    alter table events add column partner_a_name text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'partner_b_name'
  ) then
    alter table events add column partner_b_name text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'gift_url'
  ) then
    alter table events add column gift_url text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'show_seating'
  ) then
    alter table events add column show_seating boolean not null default false;
  end if;
end $$;
