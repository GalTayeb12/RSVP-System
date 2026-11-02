-- =============================================================
-- מערכת אישורי הגעה — סכמה ראשונית
-- להריץ ב-Supabase: SQL Editor > New query > להדביק > Run
-- =============================================================

create extension if not exists pgcrypto;

-- ---------- סוגים ----------
create type user_role as enum ('admin', 'owner', 'helper');
create type rsvp_status as enum ('pending', 'attending', 'declined', 'maybe');
create type guest_side as enum ('groom', 'bride', 'shared');
create type campaign_kind as enum ('invitation', 'reminder', 'event_day', 'thank_you');
create type message_channel as enum ('whatsapp_link', 'whatsapp_api', 'sms');
create type message_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');

-- ---------- משתמשים ----------
-- כל משתמש ב-auth.users מקבל שורה כאן. אתה (admin) יוצר את המשתמשים.
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  full_name   text,
  role        user_role not null default 'owner',
  created_at  timestamptz not null default now()
);

-- ---------- אירועים ----------
create table events (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid not null references profiles (id) on delete cascade,
  title                text not null,               -- "החתונה של דני ומיכל"
  host_names           text,                        -- "דני ומיכל"
  event_date           timestamptz,
  venue_name           text,
  venue_address        text,
  waze_url             text,
  plate_price          numeric(8, 2),               -- מחיר מנה, לחישוב עלות משוערת
  invitation_image_url text,
  message_quota        int not null default 3000,   -- תקרת הודעות לאירוע
  created_at           timestamptz not null default now()
);

-- עוזרים (הורים וכו') שמשותפים לאירוע
create table event_members (
  event_id  uuid references events (id) on delete cascade,
  user_id   uuid references profiles (id) on delete cascade,
  role      user_role not null default 'helper',
  primary key (event_id, user_id)
);

-- ---------- מוזמנים ----------
-- רשומה אחת = מספר טלפון אחד, גם אם מגיעים כמה אנשים
create table guests (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references events (id) on delete cascade,
  first_name       text not null,
  last_name        text,
  phone            text not null,                   -- בפורמט E.164: +972501234567
  side             guest_side not null default 'shared',
  group_name       text,                            -- משפחה / עבודה / צבא...
  invited_count    int not null default 1,          -- כמה הוזמנו ברשומה הזו
  status           rsvp_status not null default 'pending',
  attending_count  int not null default 0,
  meal_notes       text,                            -- טבעוני, ללא גלוטן, מנת ילד
  note             text,
  table_number     int,
  rsvp_token       text not null unique default encode(gen_random_bytes(8), 'hex'),
  opted_out        boolean not null default false,  -- לחץ "הסר אותי"
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (event_id, phone)
);
create index guests_event_status_idx on guests (event_id, status);

-- היסטוריית תשובות (לא רק התשובה האחרונה)
create table rsvp_history (
  id               bigint generated always as identity primary key,
  guest_id         uuid not null references guests (id) on delete cascade,
  status           rsvp_status not null,
  attending_count  int not null default 0,
  source           text not null,                   -- 'link' / 'whatsapp' / 'manual' / 'phone'
  changed_by       uuid references profiles (id),
  created_at       timestamptz not null default now()
);

-- ---------- שליחות ----------
create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events (id) on delete cascade,
  kind          campaign_kind not null,
  channel       message_channel not null default 'whatsapp_link',
  template_text text not null,                      -- "היי {first_name}, ..."
  audience      text not null default 'all',        -- 'all' / 'pending' / 'attending'
  scheduled_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns (id) on delete cascade,
  guest_id        uuid not null references guests (id) on delete cascade,
  channel         message_channel not null,
  status          message_status not null default 'queued',
  provider_id     text,                             -- מזהה ההודעה אצל Meta
  error           text,
  sent_at         timestamptz,
  updated_at      timestamptz not null default now()
);
create index messages_campaign_idx on messages (campaign_id, status);

-- ---------- עדכון updated_at אוטומטי ----------
create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger guests_touch before update on guests
  for each row execute function touch_updated_at();
create trigger messages_touch before update on messages
  for each row execute function touch_updated_at();

-- =============================================================
-- הרשאות (Row Level Security): כל זוג רואה רק את האירוע שלו
-- =============================================================

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create function can_access_event(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin()
      or exists (select 1 from events where id = e and owner_id = auth.uid())
      or exists (select 1 from event_members where event_id = e and user_id = auth.uid());
$$;

alter table profiles      enable row level security;
alter table events        enable row level security;
alter table event_members enable row level security;
alter table guests        enable row level security;
alter table rsvp_history  enable row level security;
alter table campaigns     enable row level security;
alter table messages      enable row level security;

-- profiles: כל אחד רואה את עצמו; אדמין רואה ומנהל הכול
create policy "own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "admin manages profiles" on profiles for all using (is_admin()) with check (is_admin());

-- events
create policy "read events" on events for select using (can_access_event(id));
create policy "owner updates event" on events for update using (owner_id = auth.uid() or is_admin());
create policy "admin creates/deletes events" on events for all using (is_admin()) with check (is_admin());

-- event_members
create policy "read members" on event_members for select using (can_access_event(event_id));
create policy "owner manages members" on event_members for all
  using (is_admin() or exists (select 1 from events where id = event_id and owner_id = auth.uid()))
  with check (is_admin() or exists (select 1 from events where id = event_id and owner_id = auth.uid()));

-- guests / campaigns: כל מי שיש לו גישה לאירוע
create policy "event guests" on guests for all
  using (can_access_event(event_id)) with check (can_access_event(event_id));
create policy "event campaigns" on campaigns for all
  using (can_access_event(event_id)) with check (can_access_event(event_id));

-- rsvp_history / messages: דרך המוזמן
create policy "guest history" on rsvp_history for all
  using (exists (select 1 from guests g where g.id = guest_id and can_access_event(g.event_id)))
  with check (exists (select 1 from guests g where g.id = guest_id and can_access_event(g.event_id)));
create policy "guest messages" on messages for all
  using (exists (select 1 from guests g where g.id = guest_id and can_access_event(g.event_id)))
  with check (exists (select 1 from guests g where g.id = guest_id and can_access_event(g.event_id)));

-- הערה: דף האישור הציבורי של המוזמן (לפי rsvp_token) לא עובר דרך RLS.
-- הוא ייבנה בשלב 4 כפעולה בצד השרת עם מפתח השירות, ויחשוף רק את השדות הנדרשים.
