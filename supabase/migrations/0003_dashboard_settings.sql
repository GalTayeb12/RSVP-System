-- Migration 0003: Remove plate_price, add RSVP settings, enable Realtime
-- Run in Supabase SQL Editor

-- ── Remove plate_price ────────────────────────────────────────────────────────
alter table events drop column if exists plate_price;

-- ── RSVP settings per event ───────────────────────────────────────────────────
-- Stores which questions are active and their options
alter table events add column if not exists rsvp_settings jsonb not null default '{
  "meals":     {"enabled": false, "options": [{"id":"regular","label":"רגיל"},{"id":"vegetarian","label":"צמחוני"},{"id":"vegan","label":"טבעוני"},{"id":"gluten_free","label":"ללא גלוטן"},{"id":"kids_meal","label":"מנת ילד"}]},
  "transport": {"enabled": false, "pickup_points": []},
  "free_note": {"enabled": true}
}'::jsonb;

-- ── RSVP answers per guest ────────────────────────────────────────────────────
-- Stores structured answers: meals per type, transport details, note
alter table guests add column if not exists rsvp_answers jsonb;

-- ── rsvp_history: save answer snapshot ───────────────────────────────────────
alter table rsvp_history add column if not exists rsvp_answers jsonb;

-- ── Enable Realtime on guests ─────────────────────────────────────────────────
-- Allows the dashboard to receive live updates when guests respond
alter publication supabase_realtime add table guests;
