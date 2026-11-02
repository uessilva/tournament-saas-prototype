# Summer Cup 2026 prototype

A locally runnable, seeded tournament prototype for the fictitious **Summer Cup 2026**. It contains a no-login public Event hub, email magic-link sign-in through Mailpit, protected Event Owner and Team Manager areas, PostgreSQL/Drizzle persistence, a local job worker with synchronous fallback, fillable PDF Scoresheets, and a one-command demo reset.

The primary guided journey is **Under-12 Football**. **Tennis Open** is the secondary Competition and demonstrates individual entrants, tennis scoring, standings and sport-specific leaders.

This is throwaway demonstration software. There is deliberately no automated test suite, CI pipeline, deployment configuration, or production-hardening work.

## What is seeded

`pnpm db:reset` restores the same starting point on every run:

- **Under-12 Football** — 8 Teams, 96 Participants, open registration, 6 accepted Team Managers, 2 pending email invitations, and one reusable Team-scoped share link. The seeded draw is previewable immediately, but the tournament is **not generated** until the Owner closes registration. This is intentional: the guided path needs the draw step.
- **Tennis Open** — 8 individual entrants, each represented by a one-Participant Team. Two groups, 12 group fixtures (8 published), semifinal/final knockout matches, and aces/double-fault leaders are ready to explore. The final stays TBD until the semifinals are published.
- **Venues** — Campo Principal, Campo 2, Quadra Central and Quadra 2.
- **Event** — `Summer Cup 2026`, `America/Sao_Paulo`, Parque Esportivo do Sol, São Paulo. Event and fixture dates are relative to the reset time so the demo always feels current.
- **Accounts** — one Owner and six accepted Team Managers. All people, emails, teams and results are fictitious.

The reset leaves exactly this state. Football’s ungenerated draw is expected; nothing else needs manual database preparation.

## Prerequisites

- Node.js 20 or newer (verified with Node 24)
- pnpm 12 (the repo pins `pnpm@12.16.1`; `corepack enable` installs the matching shim)
- Docker with the Compose plugin
- Free local ports: `3000` (app), `5433` (PostgreSQL), `1025` and `8025` (Mailpit)

PostgreSQL is exposed on **5433**, not 5432, to avoid colliding with an existing local database.

## First run

```bash
corepack enable
pnpm install

cp .env.example .env
# Optional: replace AUTH_SECRET with a long random local value.

pnpm compose:up        # PostgreSQL + Mailpit
pnpm db:reset          # apply checked-in migrations, then recreate the seed
pnpm dev               # http://localhost:3000
```

For background jobs, run a second terminal:

```bash
pnpm worker
```

The guided demo also works without the worker because job processing has a synchronous local fallback (`lib/jobs/run.ts`). Emails and extraction jobs are still persisted in PostgreSQL either way.

### Use `pnpm dev` for demonstrations

The seeded account switcher, demo Scoresheet buttons and protected reset controls are **development-only**. They are disabled when `NODE_ENV=production`, including `pnpm build && pnpm start`. Use `pnpm dev` for stakeholder demonstrations.

### If port 3000 is already in use

Next.js automatically chooses another port (for example `3001`). When that happens, start it with a matching Auth.js origin so magic links and invitations point at the same app:

```bash
AUTH_URL=http://localhost:3001 pnpm dev
```

Use `http://localhost:3001` everywhere in that session. A magic link that opens a different port will not share the development session.

## Demo entry points

`eventId` is deterministic and can be used directly:

- Event: `10000000-0000-4000-8000-000000000001`
- Under-12 Football: `20000000-0000-4000-8000-000000000001`
- Tennis Open: `20000000-0000-4000-8000-000000000002`

| URL | Purpose |
| --- | --- |
| `http://localhost:3000/` | Public Summer Cup 2026 hub, no login |
| `/events/summer-cup-2026` | Editorial Event hub |
| `/events/summer-cup-2026/fixtures` | Date-grouped fixtures, Competition filters, unscheduled Matches, Event-time-zone labels |
| `/events/summer-cup-2026/results` | Published results only |
| `/events/summer-cup-2026/standings` | Group/league standings, tie-break rules and seeded-draw resolutions |
| `/events/summer-cup-2026/leaders` | Football goals/assists and tennis aces/double faults |
| `/events/summer-cup-2026/competitions/under-12-football` | Football Competition overview, public cancellation note, entrants, fixtures and bracket |
| `/events/summer-cup-2026/competitions/tennis-open` | Tennis Competition overview, standings, results and leaders |
| `/signin` | Magic-link sign-in, Mailpit shortcut and seeded account switcher |
| `/invitations/[token]` | Email-bound invitation or reusable Team link acceptance |
| `/invitations/redeem` | Invitation destination after magic-link sign-in |
| `/manage` | Protected Team Manager area |
| `/manage/teams/[teamId]` | Roster editing while registration is open |
| `/manage/matches` | Manager fixtures, Scoresheet upload/replacement and private disputes |
| `/admin` | Protected Owner entry; redirects to the seeded Event |
| `/admin/events/[eventId]` | Owner dashboard, checklist, demo account switcher and demo reset |
| `/admin/events/[eventId]/teams` | Teams, Managers, invitations, reusable links and access history |
| `/admin/events/[eventId]/competitions/[competitionId]` | Registration, draw preview/generation, entrants and Competition cancellation |
| `/admin/events/[eventId]/schedule` | Venues, Match times, duration overrides and conflict errors |
| `/admin/events/[eventId]/review` | Review queue, processing/rejection recovery and manual entry |
| `/admin/events/[eventId]/review/[matchId]` | Side-by-side Scoresheet review, publication, corrections and reopening |
| `/admin/events/[eventId]/disputes` | Private dispute queue, Owner response and audit activity |
| `http://localhost:8025` | Mailpit inbox |

## Seeded accounts

All seeded addresses are at `example.com`. There are no passwords. Use a magic link or the development-only account switcher.

| Person | Email | Role |
| --- | --- | --- |
| Alex Moreira | `alex.moreira@example.com` | Event Owner |
| Maya Chen | `maya.chen@example.com` | Manager, Riverside Rovers |
| Samuel Okoye | `samuel.okoye@example.com` | Manager, Harbour Athletic |
| Beatriz Nunes | `beatriz.nunes@example.com` | Manager, Westfield Juniors |
| Lucas Ferreira | `lucas.ferreira@example.com` | Manager, Northgate United |
| Priya Raman | `priya.raman@example.com` | Manager, Meadow Park FC |
| Tomás Silva | `tomas.silva@example.com` | Manager, Stonebridge City |
| Nadia Haddad | `nadia.haddad@example.com` | Pending invitation, Kingsway Colts |
| João Pedro Alves | `joao.alves@example.com` | Pending invitation, Lakeside Rangers |

Nadia and João do not have accepted accounts until someone follows their invitation and signs in with the invited email.

### Magic-link flow

1. Open `/signin` and enter a seeded email, or use the demo switcher.
2. Auth.js sends a branded magic link through Mailpit.
3. Open `http://localhost:8025`, open the newest message, and follow the link.
4. The original destination is preserved through sign-in (for example `/manage` or `/invitations/redeem`).

Raw magic-link and invitation tokens are not written to application logs. Invitation rows persist only SHA-256 token hashes.

### Owner demo controls

In `pnpm dev`, sign in as Alex Moreira and open `/admin`:

- Switch between the Owner and the six seeded Team Managers in one click. The switcher sends Managers to `/manage` and Owners to `/admin`, so it never lands on an unauthorized page.
- Trigger **Reset demo**; only that Event’s Owner can do it.
- Open the public hub, Event checklist, Teams/access, schedule, review queue and private disputes.
- On **Teams and access**, use the demo shortcuts to Mailpit, or replace a pending invitation to reveal a fresh raw link once.

The reset action recreates deterministic Event, Competition and Owner IDs, so the current Owner session survives the reset. Team IDs are recreated by the seed; use links from the UI rather than deep-linking a Team URL across resets.

## Stakeholder demo script

This is the recommended 10–15 minute guided path. Use `pnpm dev` and `pnpm db:reset` first.

1. **Start in Portuguese.** Open `/`. Confirm the Summer Cup hero, Competition cards, tennis results, fixtures and leaders. Switch to **EN** in the header, reload, and confirm the choice persists and the seeded event/competition copy switches. Switch back to **PT**.
2. **Sign in as the Owner.** Open `/signin`, choose Alex Moreira, and land on `/admin/events/10000000-0000-4000-8000-000000000001`. Point out the checklist, the two pending manager invitations and the protected demo panel.
3. **Demonstrate invitation acceptance.** Open **Equipes e acessos** (`/admin/events/[eventId]/teams`). In the pending Nadia Haddad invitation, choose **Substituir** and copy the raw link that appears once. Open it, choose **Trocar de conta**, sign in as `nadia.haddad@example.com` through Mailpit, confirm the destination is preserved, and choose **Aceitar e gerenciar equipes**. The Manager lands on `/manage`.
4. **Edit a roster.** As Nadia, open Kingsway Colts and add a Participant, or edit an existing one. Show one validation error (for example a birth date outside 2014–2015), then save a valid change. Birth-date, squad-size and duplicate rules are enforced on the server.
5. **Close registration.** Sign out and return as Alex. Open the Football Competition admin page (`/admin/events/[eventId]/competitions/20000000-0000-4000-8000-000000000001`) and choose **Encerrar inscrições**. The Manager roster becomes read-only and reopening is blocked after generation.
6. **Preview and generate the draw.** On the same page, inspect the seeded groups + knockout preview. Optionally show **Regerar semente** and swap two entrants. Choose **Gerar torneio**. The page reports the generated draw; public fixtures now appear even though they are unscheduled.
7. **Schedule with a conflict.** Open **Agenda dos jogos** (`/admin/events/[eventId]/schedule`). Set a date, time and Venue on one Football Match and save. Then set an overlapping time for another Match involving one of the same Teams or the same Venue. The server rejects it with the exact Team/Venue conflict; there is no override. Restore a valid schedule afterwards if desired.
8. **Upload a Scoresheet.** Sign in as a Manager of one of the scheduled Teams. On `/manage/matches`, choose **Baixar folha**, fill the PDF form, then **Enviar folha**. Alternatively, the Owner review queue has clearly labelled **Demo: folha digital** and **Demo: digitalização** shortcuts that create representative extraction inputs without external OCR. The Match moves to **Em revisão** and the Scoresheet to **Aguardando revisão**.
9. **Review and publish.** As Alex, open **Revisar resultados** (`/admin/events/[eventId]/review`), open the pending Match, compare the original with the extracted values, correct a flagged field, choose **Salvar revisão**, then **Confirmar e publicar resultado**. Add a couple of goals/assists if you want the football leaders to be populated. The public result, standings and leaders update immediately.
10. **Show the public experience without login.** Open `/events/summer-cup-2026/results`, `/standings` and `/leaders`. Point out the competition filters, tie-break explanation, seeded-draw resolution and the published result. Open the Competition page to show the generated groups and bracket.
11. **Make one reasoned correction.** Return to the published Match review page, use **Corrigir resultado publicado**, enter the reason, confirm, and publish the correction. Verify the new version and the recalculated public standings/leaders. Reasons stay in the Owner audit area.
12. **Open and answer a private dispute.** As an involved Manager, open `/manage/matches`, use **Contestações privadas**, write an explanation and choose **Abrir contestação**. As Alex, open **Contestações** (`/admin/events/[eventId]/disputes`), choose **Acatada** or **Improcedente**, write the required response and register the decision. Confirm the dispute text never appears on public pages.
13. **Cancel and restore lifecycle controls.** On an unplayed Match review page, cancel it with an internal reason and restore it. On the Competition admin page, cancel the Competition with a required public note; show the public read-only notice; then restore it. Match reasons stay internal; Competition notes are public.
14. **Reset for the next presentation.** Use the protected **Redefinir demonstração** button on the Owner dashboard, or run `pnpm db:reset`. Confirm the seeded starting point, including the ungenerated Football draw.

### Useful Tennis smoke check

- Open `/events/summer-cup-2026/competitions/tennis-open` and confirm the 8 entrants, groups, 12 fixtures, 8 published results, group standings and aces/double-fault leaders.
- For an unplayed tennis Match, use the Owner review page to enter a best-of-three result manually (including aces and double faults) and publish it. Verify the Tennis standings and leaders recalculate.
- W.O. results intentionally produce no Participant statistics.

### Format smoke check (not part of the stakeholder story)

The seed has no ungenerated round-robin or single-elimination Competition, so smoke-test these paths only from a fresh reset:

1. `pnpm db:reset`.
2. On the Football Competition admin page, close registration.
3. Change **Formato da competição** to **Todos contra todos**, save, generate, and confirm the public Competition page, fixtures and league standings render.
4. Reset again and repeat with **Eliminatória simples**; confirm the bracket renders, Byes are hidden as playable fixtures, and a published result updates the bracket/standings views.
5. Run `pnpm db:reset` once more to leave the stakeholder starting point ready.

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

The reset is idempotent. Run it as many times as needed.

## Environment

Copy `.env.example` to `.env`.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (`localhost:5433` by default) |
| `AUTH_SECRET` | Auth.js JWT/session secret and key material for sealed email job payloads; replace for shared machines. Local development falls back to a known placeholder when it is unset; production requires it. |
| `AUTH_URL` | Local app origin, `http://localhost:3000` by default |
| `AUTH_TRUST_HOST` | Trust the local host header |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit SMTP, default `127.0.0.1:1025` |
| `EMAIL_FROM` | Sender used by magic-link and worker email |
| `STORAGE_DIR` | Local file-storage root, default `.storage` (git-ignored) |
| `DEMO_MODE` | `true` enables development-only demo tools |

## Localization

- Brazilian Portuguese is the default locale.
- The PT/EN header switcher writes the choice to `localStorage` and a cookie, so it survives a reload and server rendering agrees with the client after hydration.
- Application chrome, validation messages, demo statuses and seeded display content are translated. Seeded event/competition descriptions, seeded venue names and generated round labels follow the selected language.
- User-entered names, descriptions, reasons, notes and Participant data remain in their original language, as agreed in the prototype scope.
- There are no account-level locale preferences and no localized URL routes.

## Accessibility notes

The guided screens are checked manually rather than audited formally. They include:

- a locale-aware skip link, semantic landmarks, heading hierarchy and table captions/scope;
- visible `:focus-visible` outlines and keyboard-operable links, buttons, forms and disclosures;
- labelled inputs, `aria-invalid`/`aria-describedby` on key form errors, and `role="alert"`/`role="status"` feedback;
- responsive single-column reflow at mobile widths, scrollable data tables with keyboard focus, readable contrast, and reduced-motion support.

Before a stakeholder session, tab through the public hub, sign-in, Teams/access, Competition admin, schedule, review, and Manager roster at desktop width and at a 390–430 px viewport or 200% zoom.

## Architecture

```text
app/                         Public, auth, Owner, and Manager routes
  api/auth/[...nextauth]/    Auth.js route handler
  api/matches/.../template   Fillable AcroForm Scoresheet PDF
  api/scoresheets/...        Original, preview and source-crop downloads
  admin/events/[eventId]/    Owner dashboard, teams, competition, schedule,
                             review and disputes
  events/[slug]/             Public Event hub, fixtures, results, standings,
                             leaders and Competition pages
  manage/                    Protected Team Manager area
components/                  Shared and feature UI
features/
  auth/                      Sign-in, demo account switching and reset
  competitions/              Registration, eligibility, draws, formats,
                             lifecycle, football/tennis standings
  disputes/                  Private dispute read models and actions
  events/                    Owner Event dashboard and checklist
  matches/                   Scheduling, cancellation, manager fixtures,
                             knockout advancement
  public/                    Public read models and localized labels
  results/                   Versioned publication, corrections, reopening,
                             recalculation and tennis results
  scoresheets/               PDF templates, uploads, extraction, review crops
  teams/                     Rosters, managers, invitations and access history
lib/
  auth/                      Auth.js config, guards, email delivery
  db/                        Drizzle schema, client, deterministic demo seed
  i18n/                      pt-BR/en dictionaries, browser locale, seed copy
  jobs/                      PostgreSQL queue, handlers, synchronous fallback
  storage/                   Local file-storage helper with traversal protection
workers/index.ts             Local leased job worker
drizzle/                     Checked-in SQL migrations and snapshots
scripts/seed.ts              CLI seed entry point
```

### Database and invariants

The schema includes Auth.js tables and application records for Events, Venues, Competitions, Teams, Participants, Team Managers, invitations, access history, groups, draw positions, Matches, slots, versioned results, sport scores, Participant statistics, Scoresheets, extracted fields, jobs, disputes and audit events.

Important protections include:

- registration closes manually or at its Event-time-zone deadline and blocks entrant/roster changes;
- generation requires closed registration, eligible entrants and valid group/qualifier configuration;
- draws are seeded and reproducible; generation and swaps are blocked after a confirmed result;
- Team overlap and Venue overlap use the same validation for create and update, with no override;
- only one active Scoresheet exists per Match while previous uploads and results remain in history;
- publication and recalculation run atomically; corrections require a reason and create versions;
- Match cancellation retains Scoresheet history and excludes the Match from calculations;
- Competition cancellation makes public content read-only until restoration;
- disputes are private to the Owner and involved Teams, and do not alter public results.

### Jobs, Scoresheets and OCR fallback

- `lib/jobs/queue.ts` implements leased claims with `FOR UPDATE SKIP LOCKED`, attempts, backoff, failure visibility and manual retry.
- `workers/index.ts` is a local polling worker. It logs job type and ID, never job payloads.
- `lib/jobs/run.ts` is the synchronous demo fallback; it still records a real job row and leaves failures retryable.
- `lib/jobs/sealing.ts` encrypts `email.send` body fields with AES-256-GCM before the job is inserted. Only recipient, Event, invitation, purpose and subject stay readable for filtering and manual retry. The key is derived from `AUTH_SECRET`; legacy plaintext jobs still process, and a decryption failure becomes a generic retryable job failure.
- Scoresheet PDFs use stable AcroForm fields and a QR identity. Digital PDFs are read directly; the demo scan path uses representative fixed-region extraction rather than an external OCR service.
- The Owner review queue exposes clearly labelled **Demo: folha digital** and **Demo: digitalização** shortcuts. The demo does not require Tesseract, an external AI service, or timing-dependent retries.
- `lib/storage/local.ts` stores originals, previews and crops under `STORAGE_DIR`, rejects path traversal, and keeps only metadata in PostgreSQL.

## Manual verification status

Verified on 2 November 2026 against the real local stack:

- `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build` and `pnpm db:reset` completed successfully.
- `pnpm db:reset` restored 7 users, 16 Teams, 104 Participants, 12 tennis Matches, 8 published tennis results, 2 pending invitations and the expected ungenerated Football draw.
- The full Football journey was exercised: invitation replacement and Mailpit magic-link acceptance, Manager roster edit with an accessible validation error, registration closure, seeded draw regeneration and generation, scheduling with a rejected Team/Venue conflict, Manager Scoresheet upload, flag correction, publication, public results/standings/leaders, one reasoned correction, one private dispute and Owner response, Match cancellation/restoration, and Competition cancellation/restoration.
- Tennis was smoke-tested by publishing an additional manual tennis result and confirming standings and leaders recalculated.
- PT default, EN switching through reload, seeded-copy translation, mobile reflow at 390 px, keyboard focus and visible form errors were checked manually.

There is no automated test suite by design.

## Troubleshooting

- **Port already in use:** PostgreSQL is mapped to `5433` deliberately. If the app cannot use `3000`, Next.js picks another port; set `AUTH_URL` to that exact origin or stop the other process.
- **Magic link or invitation opens the wrong port:** `AUTH_URL` must match the origin printed by `pnpm dev`. Restart the app with the matching value.
- **Schema out of sync after experimenting:** `docker compose down -v` removes the local database volume, then `pnpm compose:up && pnpm db:reset` rebuilds everything from the checked-in migration.
- **Magic link missing:** confirm Mailpit is running on `8025`, request a fresh link, and use the newest message. The check-email page links to Mailpit only in demo mode.
- **Raw invitation link lost:** invitation rows store only hashes. In **Teams and access**, replace the pending invitation to reveal a fresh copyable link once.
- **Demo switcher or demo Scoresheet buttons missing:** you are probably running `pnpm start` or a production build. Use `pnpm dev` with `DEMO_MODE` not set to `false`.
- **Scoresheet looks stuck:** with the worker stopped, demo actions use synchronous fallback. Reload the review queue; if extraction failed, use **Repetir extração**, ask the Manager for a replacement, or publish a manual result.
- **Language choice appears stale:** the switcher stores both a cookie and `localStorage`. Clear site data for the localhost origin if an old value was left by an experiment.
- **Reset refuses to run:** check `NODE_ENV`, `DATABASE_URL` and the local-host safety checks above.

## Known prototype limits

- Local-only demonstration software: plain SMTP, local files, permissive seeded data, JWT sessions and no production hardening.
- `pnpm start` intentionally hides all demo affordances; use `pnpm dev` for the presentation.
- No public hosting, deployment, billing, payments, subscriptions or multi-organisation administration.
- No live scoring, native apps, calendar feeds, `.ics` export, automated scheduling or conflict optimisation.
- No doubles or team tennis, no individual-point scoring, no best-third advancement and no scheduling-conflict override.
- Seeded pending invitations cannot reveal their original raw link because only hashes are stored.
- The public Football Competition shows “waiting for the draw” until the Owner closes registration and generates the tournament.
- Seeded display copy is translated through a small deterministic display map; arbitrary user-entered content is not translated.
- OCR is represented by a local fixed-region/demo fallback, not a production document-AI service or formal PDF verification.
- Automated publication of extracted results is intentionally not implemented: every uncertain extraction requires Owner review.
