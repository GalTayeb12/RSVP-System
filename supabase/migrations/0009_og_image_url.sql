-- Migration 0009: add og_image_url to events
-- Stores the 1200×630 crop URL separately so the OG image path is always
-- known even when files use timestamped names. Idempotent.

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'og_image_url'
  ) then
    alter table events add column og_image_url text;
  end if;
end $$;
