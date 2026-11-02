-- Migration 0007: WhatsApp Cloud API support
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP CONSTRAINT IF EXISTS

-- ── 1. messages: delivery tracking + soft-lock for batch claiming ─────────────

alter table messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at       timestamptz,
  add column if not exists failed_at     timestamptz,
  add column if not exists error_code    text,
  add column if not exists locked_at     timestamptz;

-- Prevent double-sending: each guest gets at most one message per campaign
alter table messages
  drop constraint if exists messages_campaign_id_guest_id_key;
alter table messages
  add constraint messages_campaign_id_guest_id_key
  unique (campaign_id, guest_id);

-- ── 2. webhook_events: raw event log (service-role only) ──────────────────────

create table if not exists webhook_events (
  id          bigserial   primary key,
  received_at timestamptz not null default now(),
  payload     jsonb       not null,
  processed   boolean     not null default false,
  error       text
);

alter table webhook_events enable row level security;
-- No SELECT/INSERT/UPDATE/DELETE policies → authenticated users see nothing.
-- Only the service-role key (used by route handlers) can access this table.

-- ── 3. claim_messages_batch: atomic batch claim with row-level lock ───────────
-- Called by the auto-send API route. Marks up to p_limit queued messages as
-- locked so two concurrent requests never send the same message.
-- Stale locks (> 5 min old) are reclaimed automatically.

create or replace function claim_messages_batch(
  p_campaign_id uuid,
  p_limit       int default 20
)
returns table (id uuid, guest_id uuid, msg_text text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update messages m
    set    locked_at = now()
    where  m.id in (
      select q.id
      from   messages q
      where  q.campaign_id = p_campaign_id
        and  q.status      = 'queued'
        and  (q.locked_at is null
              or q.locked_at < now() - interval '5 minutes')
      order  by q.created_at
      limit  p_limit
      for update skip locked
    )
    returning m.id, m.guest_id, m.text;
end $$;
