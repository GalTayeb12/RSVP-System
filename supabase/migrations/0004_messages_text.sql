-- Migration 0004: Add per-message text for wa.me link building and offline resume
-- Run in Supabase SQL Editor

-- Store the filled message text per recipient so the queue can resume
-- from any device without re-rendering the template.
alter table messages add column if not exists text text;
