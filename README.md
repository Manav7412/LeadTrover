# LeadTrove

A lightweight CRM for small sales teams (2–10 people) who track leads in spreadsheets today.
One idea: **every lead has an owner and a next step, so no follow-up is missed.**

> Portfolio demo. All data is fake sample data.

## What it does

- **Contacts and companies** with search, filters, tags, CSV import (duplicate check on email and phone) and CSV export
- **Pipelines**: drag-and-drop Kanban boards, with your own pipelines and stages
- **Activity timeline**: calls, emails, notes and meetings with an outcome and a next step
- **Tasks**: a next step creates a follow-up task automatically; Today / Overdue / Upcoming views
- **Automations**: new leads get an owner, a won deal creates an onboarding deal, quiet leads are flagged stale
- **Public lead capture forms** that create a contact, assign an owner and a follow-up task
- **Email templates** with merge fields (logged on the timeline; no real sending yet)
- **Dashboard**: leads by source, calls per day, meetings booked, pipeline value, win rate, results by rep
- **Roles, permissions and sharing rules**, enforced in the database (row-level security)

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth)

## Run it locally

1. `npm install`
2. Create a free project at supabase.com.
3. In the Supabase **SQL Editor**, run these files from `supabase/`, in this order:
   `schema.sql`, `automations.sql`, `pipelines.sql`, `forms.sql`, `dashboard.sql`, `permissions.sql`
4. Copy `.env.example` to `.env.local` and fill in your project URL, publishable key and secret key.
5. `npm run seed` fills the database with fake data (2 users, 10 companies, 30 contacts, 15 deals and more).
6. `npm run dev`, then open http://localhost:3000

Demo logins (created by the seed): `manav@leadtrove.demo` (Owner) and `alex@leadtrove.demo` (Rep). Password: `LeadTrove-demo-1`.

## Deploying

Set these environment variables on the host (never commit them):

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **publishable** key |
| `SUPABASE_SERVICE_ROLE_KEY` | the **secret** key (server only: used for team management in Settings) |

## Notes

- `CLAUDE.md` describes the project for AI coding sessions.
- The public form has a honeypot but no rate limiting yet.
