# Summer Cup 2026 prototype

A locally runnable, seeded tournament prototype for the Summer Cup 2026. It includes a no-login public event hub, Auth.js email magic-link sign-in through Mailpit, protected Owner and Team Manager areas, PostgreSQL/Drizzle persistence, a local job worker, and a one-command demo reset.

This is throwaway demonstration code. It is not production hardening, and there is deliberately no automated test suite, CI pipeline, or release process.

## What is in the demo

Summer Cup 2026 is seeded with:

- **Under-12 Football** — 8 teams, 96 participants, open registration, 6 accepted Team Managers, 2 pending email invitations, and one reusable Team-scoped share link. The draw is intentionally not generated so the guided football path stays demonstrable.
- **Tennis Open** — 8 individual entrants, each represented by a one-Participant Team. Two groups, 12 round-robin fixtures, 8 published results with best-of-three set scores, and aces/double-fault leaders.
- **Venues** — Campo Principal, Campo 2, Quadra Central and Quadra 2.
- **Event** — `America/Sao_Paulo`, Parque Esportivo do Sol, São Paulo. Seeded dates are relative to the reset time so the event always feels current.
- All people, emails, teams and results are fictitious.

The public hub is useful immediately; the football registration/draw/scheduling/results path remains open for the later guided tickets.

## Prerequisites

- Node.js 20 or newer (verified with Node 24)
- pnpm 12 (the repo is pinned in `package.json`; `corepack enable` installs the matching shim)
- Docker with the Compose plugin
- Free local ports: `3000` (app), `5433` (PostgreSQL), `1025`/`8025` (Mailpit)

PostgreSQL is exposed on **5433**, not 5432, to avoid colliding with an existing local database.

## First run

```bash
corepack enable
pnpm install

cp .env.example .env
# Optional: replace AUTH_SECRET in .env with a long random local value.

pnpm compose:up        # PostgreSQL + Mailpit
pnpm db:reset          # apply checked-in migrations, then recreate the seed
pnpm dev               # http://localhost:3000
```

For background jobs, run a second terminal:

```bash
pnpm worker
```

The guided demo also works without the worker because the job queue exposes a synchronous fallback (`lib/jobs/run.ts`). Email sending and future extraction jobs are persisted in PostgreSQL either way.

### Important: use `pnpm dev` for the demo

The seeded account switcher and protected reset controls are **development-only**. They are disabled when `NODE_ENV=production`, including `pnpm build && pnpm start`. Use `pnpm dev` for stakeholder demonstrations.

## Demo entry points

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/` | Public Summer Cup 2026 hub, no login |
| `http://localhost:3000/events/summer-cup-2026` | Event hub |
| `http://localhost:3000/events/summer-cup-2026/competitions/under-12-football` | Football competition overview |
| `http://localhost:3000/events/summer-cup-2026/competitions/tennis-open` | Tennis competition overview with provisional standings |
| `http://localhost:3000/signin` | Magic-link sign-in and seeded account switcher |
| `http://localhost:3000/admin` | Protected Owner administration |
| `http://localhost:3000/manage` | Protected Team Manager area |
| `http://localhost:8025` | Mailpit inbox |

## Seeded accounts

All seeded sign-in addresses are at `example.com`. There are no passwords; use the magic link or the development account switcher.

| Person | Email | Role |
| --- | --- | --- |
| Alex Moreira | `alex.moreira@example.com` | Event Owner |
| Maya Chen | `maya.chen@example.com` | Manager, Riverside Rovers |
| Samuel Okoye | `samuel.okoye@example.com` | Manager, Harbour Athletic |
| Beatriz Nunes | `beatriz.nunes@example.com` | Manager, Westfield Juniors |
| Lucas Ferreira | `lucas.ferreira@example.com` | Manager, Northgate United |
| Priya Raman | `priya.raman@example.com` | Manager, Meadow Park FC |
| Tomás Silva | `tomas.silva@example.com` | Manager, Stonebridge City |

Kingsway Colts (`nadia.haddad@example.com`) and Lakeside Rangers (`joao.alves@example.com`) have pending invitations and no accepted manager account yet.

### Magic-link flow

1. Open `/signin` and enter a seeded email.
2. Auth.js sends a branded magic link through Mailpit.
3. Open `http://localhost:8025`, open the newest message, and follow the link.
4. The destination is preserved through sign-in (for example `/manage`).

Raw magic-link and invitation tokens are not written to application logs. Manager invitation rows persist only SHA-256 token hashes.

### Owner demo controls

In `pnpm dev`, sign in as Alex Moreira and open `/admin`. The demo panel provides:

- Account switching between the Owner and seeded Team Managers.
- A protected **Reset demo** action that only the Event Owner of that event can trigger.
- A public-hub shortcut and the current event checklist.

The reset action recreates the same deterministic event and user IDs, so the current Owner session survives the reset. CLI reset also keeps the schema and only replaces data.

## Commands

```bash
pnpm dev                 # Next.js development server
pnpm build               # production build
pnpm start               # production server (demo tools disabled)
pnpm typecheck           # tsc --noEmit

pnpm compose:up          # start PostgreSQL + Mailpit
pnpm compose:down        # stop services (keeps the database volume)

pnpm db:generate         # generate a new Drizzle migration after schema edits
pnpm db:migrate          # apply checked-in migrations
pnpm db:seed             # reset data only
pnpm db:reset            # migrate + reset data (the one-command reset)
pnpm db:studio           # Drizzle Studio

pnpm worker              # poll the PostgreSQL job queue
```

### Reset safety

`pnpm db:reset` runs `db:migrate` followed by the seed. The seed:

- refuses to run when `NODE_ENV=production` unless `ALLOW_DEMO_RESET=true`;
- refuses non-local database hosts unless `ALLOW_REMOTE_DEMO_RESET=true`;
- truncates only the known application/auth tables inside one transaction;
- recreates the deterministic Summer Cup 2026 state.

The reset is idempotent: run it as many times as needed.

## Environment

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (`localhost:5433` by default) |
| `AUTH_SECRET` | Auth.js JWT/session secret; replace for shared machines |
| `AUTH_URL` | Local app origin, `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Trust the local host header |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit SMTP, default `127.0.0.1:1025` |
| `EMAIL_FROM` | Sender used by magic-link and worker email |
| `STORAGE_DIR` | Local file-storage root, default `.storage` (git-ignored) |
| `DEMO_MODE` | `true` enables development-only demo tools |

## Architecture

```text
app/                         Public, auth, Owner, and Manager routes
  api/auth/[...nextauth]/    Auth.js route handler
  admin/events/[eventId]/    Protected Owner dashboard
  manage/                    Protected Team Manager area
components/                  Shared UI and feature UI
features/
  auth/                      Server actions for sign-in/out, demo switch, reset
  competitions/              Competition read model, tennis standings
  events/                    Owner event read model and checklist
  public/                    Public event/match read models
  teams/                     Roster read model
  scoresheets/               (reserved for the extraction/review ticket)
  matches/                   (reserved for scheduling/results tickets)
lib/
  auth/                      Auth.js config, guards, email delivery
  db/                        Drizzle schema, client, deterministic demo seed
  i18n/                      pt-BR/en dictionaries, browser locale, provider
  jobs/                      PostgreSQL queue, handlers, synchronous fallback
  storage/                   Local file-storage helper with traversal protection
workers/index.ts             Local leased job worker
drizzle/                     Checked-in SQL migrations and snapshots
scripts/seed.ts              CLI seed entry point
```

### Database

The schema includes the full foundation plus forward-looking records needed by later tickets:

`users`, `accounts`, `sessions`, `verification_tokens`, `authenticators`,
`events`, `venues`, `competitions`, `teams`, `participants`, `team_managers`,
`manager_invitations`, `invitation_teams`, `access_events`, `groups`,
`group_entries`, `matches`, `match_entries`, `result_versions`,
`football_results`, `tennis_results`, `participant_statistics`, `scoresheets`,
`extracted_fields`, `jobs`, `disputes`, `audit_events`.

Important constraints include unique event/competition/team slugs, participant
uniqueness within a competition, one current result version per match, one
active scoresheet per match, one open dispute per match, and a single leaseable
job row per processing claim.

### Auth and authorization

- Auth.js v5 with the Drizzle adapter and Nodemailer email provider.
- JWT sessions, so the seeded demo switch and reset work without sessions
  fighting the database.
- `lib/auth/guards.ts` provides `requireUser`, `requireEventOwner`, and
  `requireTeamManager`. Owner routes check `events.owner_id` on the server;
  Manager routes check `team_managers` membership on the server. Unauthorized
  resource access returns 404 rather than leaking existence.
- The sample raw invitation tokens in the seed are hashed and discarded.

### Localization

- Brazilian Portuguese is the default locale.
- The PT/EN selector writes the choice to `localStorage` and a cookie.
- Server rendering reads the cookie for the initial locale; the client
  reconciles with `localStorage` after hydration.
- Dictionaries cover the public hub, competition pages, auth, Owner dashboard,
  and Team Manager screens. User-entered names/descriptions are not translated,
  as agreed in the spec.

### Jobs and storage

- `lib/jobs/queue.ts` implements leased claims with `FOR UPDATE SKIP LOCKED`,
  attempts, backoff, failure visibility, and manual retry.
- `workers/index.ts` is a local polling worker. It logs job type and ID, never
  job payloads.
- `lib/jobs/run.ts` is the synchronous demo fallback; it still records a real
  job row and leaves failures retryable.
- `lib/storage/local.ts` stores originals, previews and crops under
  `STORAGE_DIR`, rejects path traversal, and returns checksums. PostgreSQL keeps
  only metadata.

## Manual verification

There is no automated test suite by design. The verification seam is the running
app against PostgreSQL, Mailpit, local storage and the worker/fallback.

Before a demo:

1. `pnpm compose:up && pnpm db:reset`
2. Open `/` and confirm Portuguese copy, the Summer Cup hub, competitions,
   tennis results, upcoming fixtures and leaders load without authentication.
3. Switch to English and reload; confirm the choice persists.
4. Sign in as Alex Moreira through `/signin` (demo switcher or Mailpit).
5. Confirm `/admin/events/[eventId]` loads and a Manager cannot open it.
6. Sign in as a Manager and confirm `/manage` and `/manage/teams/[teamId]`
   only show assigned teams.
7. Run the Owner demo reset action; confirm the success state and seeded data.
8. Start `pnpm worker`, enqueue or observe a job, and confirm it is marked
   completed without logging payload contents.
9. Check the main screens at mobile width with keyboard focus and visible
   focus rings.

## Current scope and next tickets

This ticket is the runnable foundation. Later tickets add invitation acceptance,
roster editing, registration closure, seeded draw generation and swapping,
scheduling/conflict validation, Scoresheet PDF generation/upload/extraction,
Owner review and publication, corrections, disputes, and full lifecycle controls.
The schema, feature folders, read models and guards are shaped so those screens
can be added without a wholesale rewrite.

Public hosting is intentionally out of scope until the localhost demo is
accepted.

## Troubleshooting

- **Port already in use:** PostgreSQL is mapped to `5433` deliberately. Change the
  compose port and `DATABASE_URL` together if it still collides.
- **Schema out of sync after experimenting:** `docker compose down -v` removes
  the local database volume, then `pnpm compose:up && pnpm db:reset` rebuilds
  everything from the checked-in migration.
- **Magic link missing:** confirm Mailpit is running on `8025` and the latest
  message is the one you requested. The check-email page links to Mailpit only in
  demo mode.
- **Demo switcher missing:** you are probably running `pnpm start` or a production
  build. Use `pnpm dev` with `DEMO_MODE=true`.

## Caveats

- This is local-only demonstration software: plain SMTP, local files, permissive
  demo data, and no production hardening.
- `pnpm start` intentionally hides demo controls; use `pnpm dev`.
- The Manager roster screen is read-only in this ticket.
- The public competition football page intentionally shows “waiting for the
  draw” until the tournament-generation ticket runs.
- If Docker is unavailable, PostgreSQL and Mailpit can be run externally and
  pointed at with `DATABASE_URL`/`SMTP_*`; the app and `pnpm build` still work.
