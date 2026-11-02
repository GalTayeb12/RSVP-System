-- Migration 0005: Add created_at to messages table
-- Run in Supabase SQL Editor

alter table messages
  add column if not exists created_at timestamptz not null default now();

-- Back-fill existing rows: sent messages use sent_at, queued messages use updated_at
update messages
  set created_at = coalesce(sent_at, updated_at);
