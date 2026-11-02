@AGENTS.md

# RSVP System — project context

An RSVP / guest-management system for weddings and events in Israel.
First customer: the owner's own wedding (~600 guests). Later: sold to other couples for a small fee.

## Users and roles

- **admin** — the owner of the system. Creates user accounts (username + password) and events. Sees everything.
- **owner** — a couple. Sees and manages only their own event(s).
- **helper** — e.g. parents. Added to an event by the owner; can add guests and see status, cannot send messages.

There is no public sign-up. Only the admin creates users.

## Stack

- Next.js 16 (App Router, `src/`), TypeScript, Tailwind v4
- Supabase (Postgres + Auth) via `@supabase/ssr` and `@supabase/supabase-js`
- Hosting: Vercel
- Next.js 16 renamed Middleware to **Proxy** (`src/proxy.ts`). Read `node_modules/next/dist/docs/` before using any Next.js API — this version differs from older training data.

## Conventions

- UI text is **Hebrew**, layout is **RTL** (`<html lang="he" dir="rtl">`). Code, identifiers and comments in code are English (SQL comments may be Hebrew).
- Mobile-first: most couples will use this from their phone.
- Design tokens live in `src/app/globals.css` (`bg-background`, `text-muted`, `text-accent`, `bg-card`, `border-border`). Reuse them; don't hard-code colors.
- Phone numbers are stored in E.164 (`+972501234567`). Normalize every phone input (Excel, manual) with `libphonenumber-js`, default region `IL`.
- Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`) are used only in server code (route handlers / server actions). Never import them into client components.

## Database

- Schema: `supabase/migrations/0001_initial_schema.sql`. Every schema change = a new numbered migration file; never edit an applied migration.
- **Every schema change = new migration file + update `src/lib/database.types.ts`**. The types file is the single source of truth for TypeScript — a column that doesn't exist in `database.types.ts` will be caught at build time.
- Tables: `profiles`, `events`, `event_members`, `guests`, `rsvp_history`, `campaigns`, `messages`.
- Row Level Security is on for every table. Access goes through `is_admin()` and `can_access_event(event_id)`. Keep it that way for any new table.
- One guest row = one phone number (may represent several people via `invited_count` / `attending_count`). `unique (event_id, phone)`.
- Each guest has a random `rsvp_token` for their personal RSVP link (`/r/<token>`). That public page must go through server code with the service key and expose only the fields it needs.

## Security and privacy

- The GitHub repo is **public**. Never commit `.env*` files (other than `.env.example`), real guest lists, Excel files with real data, or keys.
- Guest data is personal data (Israeli Privacy Protection Law). Collect only what's needed; plan for deleting event data ~60 days after the event.

## Workflow

- Build one roadmap step at a time (see README). Keep each step small and working end to end.
- Before finishing a step: `npm run lint` and `npm run build` must pass; check the pages in a browser (desktop + mobile width).
- Commit at the end of each step with a clear message, and tick the step in README.
