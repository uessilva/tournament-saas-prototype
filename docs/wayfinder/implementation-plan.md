# Prototype implementation plan

## Outcome

Deliver a polished, locally runnable Summer Cup 2026 prototype with one reliable guided journey: an Event Owner configures Under-12 Football, invites a Team Manager, generates and schedules fixtures, reviews an uploaded Scoresheet, and publishes results to a no-login public Event hub. Tennis Open demonstrates individual entrants and sport-specific results. Public deployment follows after localhost acceptance.

The visual source is the approved [Event-hub wireframe](prototype/demo-experience-prototype.html). Decisions in the [wayfinder map](map.md) and its closed tickets are requirements; this plan does not reopen them.

## Prototype constraints

This is throwaway demonstration code. Optimize for the shortest path to a convincing, repeatable demo—not reuse, maintainability, production readiness, or comprehensive edge-case coverage.

- Do not build a test suite, CI pipeline, formal release process, or production-hardening work.
- Prefer direct feature code and small local helpers over generalized frameworks, abstraction layers, or speculative configurability.
- Use the real database, authentication, uploads, and extraction path needed for the demo, but seed difficult or slow steps where that makes the demonstration reliable.
- Check behavior by running the guided demo and a short manual smoke checklist. Fix issues encountered on that path; do not expand into exhaustive verification.

## 1. Application shape

Build one feature-oriented pnpm package:

- **Web:** Next.js App Router, React, TypeScript, Tailwind CSS; server components for reads and server actions or route handlers for validated mutations.
- **Data:** PostgreSQL, Drizzle ORM, straightforward migrations, Docker Compose, and a one-command demo seed/reset.
- **Identity:** Auth.js magic links through Mailpit, plus a development-only seeded account switcher. Check Event Owner and Team Manager permissions on mutations.
- **Files:** local storage for original PDFs, rendered previews, and source-image crops; only metadata in PostgreSQL. Ignore stored files in Git.
- **Work:** the agreed PostgreSQL-backed jobs and local worker, with synchronous execution as the simple demo fallback. Prefer seeded extraction results over making OCR reliability a project of its own.
- **Verification:** manual exercise of the demo path only; no unit, integration, end-to-end, or CI test setup.

Suggested feature boundaries:

```text
app/                         Public, authenticated, and auth routes
features/events/             Event hub and owner settings
features/competitions/       Registration, draws, lifecycle, standings
features/teams/              Rosters, managers, invitations
features/matches/            Scheduling, results, disputes
features/scoresheets/        Templates, uploads, extraction, review
features/public/             Localized fixtures, results, and leaders
lib/auth/                    Session and authorization guards
lib/db/                      Schema, migrations, transactions, seed/reset
lib/jobs/                    Job queue and worker
lib/storage/                 Small local file-storage helper
lib/i18n/                    en and pt-BR dictionaries and browser preference
workers/                     Local job-worker entry point
```

Keep tournament, eligibility, result-validation, standing, tie-breaker, advancement, and overlap logic in pure TypeScript domain modules called by both preview and persistence code.

## 2. Routes and demo navigation

### Public, no login

- `/` — entry to the seeded Summer Cup 2026.
- `/events/[slug]` — editorial Event hub with overview, Competition navigation, language switcher, and current highlights.
- `/events/[slug]/fixtures` — date-grouped fixtures, Competition filters, Event time zone, unscheduled Matches, and cancelled labels.
- `/events/[slug]/results` — published results only.
- `/events/[slug]/standings` — groups, rankings, tie-break explanation, and visible seeded-draw resolution.
- `/events/[slug]/leaders` — football goals/assists and tennis aces/double faults.
- `/events/[slug]/competitions/[competitionSlug]` — Competition status, public cancellation note, entrants, and format.

### Authenticated Owner

- `/admin/events/[eventId]` — guided setup checklist and Event settings.
- `/admin/events/[eventId]/competitions/[competitionId]` — rules, registration, entrants, draw preview/generation, and cancellation.
- `/admin/events/[eventId]/teams` — Teams, Managers, invitations, share links, and access history.
- `/admin/events/[eventId]/schedule` — Venue and Match scheduling with conflict errors.
- `/admin/events/[eventId]/review` — extraction review queue, side-by-side Scoresheet review, manual entry, and corrections.
- `/admin/events/[eventId]/activity` — result versions, reviewer edits, disputes, cancellations, and job retry.

### Authenticated Team Manager

- `/manage/teams` — assigned Teams and open invitation destinations.
- `/manage/teams/[teamId]` — roster editing while registration is open.
- `/manage/matches` — own fixtures, Scoresheet upload/replacement, published results, and private disputes.
- `/invitations/[token]` — authenticated, email-bound or reusable-link acceptance with safe error states.

Use the same domain read models for authenticated and public fixtures/results, with publication filtering at the query boundary. Show pending-invitation and Mailpit shortcuts only in the protected demo UI.

## 3. Persistence and invariants

Use Auth.js's required account/session tables plus these application records:

| Area | Records | Essential constraints |
| --- | --- | --- |
| Events | `events`, `venues`, `competitions` | Unique Event slug; one Event time zone; Event-scoped Venues; Competition sport, format, durations, eligibility, registration state/deadline, seed, and cancellation data |
| Entrants | `teams`, `participants`, `team_managers` | A Team belongs to one Competition; tennis singles has exactly one Participant; Participant uniqueness and roster/birth-date rules within a Competition |
| Access | `manager_invitations`, `invitation_teams`, `access_events` | Hashed opaque tokens, kind, recipient email when required, expiry, revocation, single-use redemption, selected Teams, and idempotent acceptance |
| Tournament | `groups`, `group_entries`, `matches`, `match_entries` | Stable draw/round/slot positions, home/away or entrant slots, Byes, group qualifiers, optional scheduling, and Competition lifecycle state |
| Results | `result_versions`, `football_results`, `tennis_results`, `participant_statistics` | One current confirmed version per Match, sport-specific score data, source, correction reason, reviewer/edit provenance, and walkover/shootout distinction |
| Scoresheets | `scoresheets`, `extracted_fields` | Template/page/QR identity, active upload, separate processing state, original file, confidence, crop, extracted and reviewed values, failure/rejection details |
| Operations | `jobs`, `disputes`, `audit_events` | Leased idempotent jobs; one active dispute per published Match; private dispute text; structured audit metadata without raw tokens |

Enforce the following in server-side transactions:

- Closing registration blocks entrant and roster changes. Generation requires closed registration, valid entrants, at least two entrants per Competition/group, and valid qualifier counts.
- Draw preview/regeneration/manual swaps are allowed only before any confirmed result. The stored seed makes every random resolution reproducible.
- A Match is `awaiting_result → in_review → published`; its active Scoresheet independently follows `uploaded → processing → needs_review → confirmed`, with `extraction_failed`/`rejected` returning the Match to `awaiting_result`.
- Valid Owner confirmation/manual entry and Match publication are atomic. Recompute standings, advancement, and leaders from all current confirmed versions in that same transaction.
- Corrections require a reason and create a version. Knockout winner corrections fail if a downstream result exists; corrections proceed in reverse round order.
- Walkovers use the specified standings scores but produce no Participant statistics. Football shootout goals affect advancement only.
- Team and Venue overlap validation shares one implementation across create/update operations; no Owner override.
- Competition cancellation blocks mutations and makes public content read-only until reversible restoration. Match cancellation excludes the Match from standings/results while retaining history.

## 4. Scoresheet pipeline

1. Generate competition-specific fillable AcroForm PDFs with `pdf-lib`, stable field names, and QR identifiers containing sheet, template-version, and page identity.
2. Accept an authenticated upload for an eligible Match; persist the original and create a leased extraction job. Keep previous uploads but designate only one active Scoresheet.
3. For digital PDFs, read AcroForm values directly. For scans, decode QR identity and pass fixed regions through a replaceable local Tesseract adapter.
4. Store raw values, normalized values, confidence, validation flags, and source-image crops. Seed representative extraction fixtures so the demo never depends on OCR availability or timing.
5. Require side-by-side Owner review for every hand-filled scan and every flagged digital extraction. Owner edits remain attributable and auditable.
6. On confirmation, validate the complete sport-specific result and publish/recalculate in one transaction. On rejection/failure, offer replacement upload or manual entry.

## 5. Delivery sequence

### Milestone 1 — Runnable foundation

- Scaffold the app, Compose services, Drizzle migrations, Auth.js/Mailpit, local file storage, job worker, and localization shell.
- Add Summer Cup 2026 resettable seeds, fictitious Owner/Managers, Football and Tennis Open, and protected demo reset/account switching.
- **Exit:** the app starts locally, sign-in and role guards work, and reset restores the demo.

### Milestone 2 — Event, access, and registration

- Implement the public Event shell, Owner Event/Competition setup, Teams/rosters, eligibility, registration controls, invitations/reusable links, and access audit.
- **Exit:** a recipient can accept through magic-link authentication and manage only assigned Teams; expired/revoked/repeated redemption behaves as specified.

### Milestone 3 — Tournament and schedule vertical slice

- Implement seeded draw preview/regeneration/swap, groups + knockout, Byes/advancement, Venue scheduling, and public fixtures.
- Add the pure rules engine for all three formats and both sports, even though the guided path uses Football groups + knockout.
- **Exit:** valid Football and Tennis fixtures survive reload, public pages update immediately, and Team/Venue conflicts are rejected.

### Milestone 4 — Reviewed results and public calculations

- Implement PDF generation, upload/jobs/extraction adapters, Owner review/manual entry, versioned publication/correction, standings, advancement, and statistic leaders.
- **Exit:** one uploaded Football Scoresheet becomes a published result and immediately updates public standings and leaders; correction preserves history and obeys downstream guards.

### Milestone 5 — Lifecycle controls and complete demo polish

- Add Match/Competition cancellation, private disputes, Owner responses, job retry, review/audit history, and Tennis result entry.
- Evolve the wireframe into the Summer Cup identity with responsive layouts, original assets, sport accents, and complete `pt-BR`/`en` dictionaries.
- **Exit:** the full guided scenario is coherent on mobile and desktop with no placeholder screens or dead controls.

### Milestone 6 — Demo handoff

- Walk through the guided scenario, fix anything that interrupts it, and document setup, worker/OCR fallback, seeded accounts, reset, and the demo script in `README.md`.
- Deploy authenticated administration and no-login public pages only after the localhost demo works; choose the provider/URL as that follow-up begins.

## 6. Manual demo checklist

Use this as a quick pre-demo smoke check, not as a request for automated browser testing or exhaustive edge-case coverage.

1. Reset and open Summer Cup 2026 in Portuguese; switch to English and confirm the choice survives reload.
2. Sign in as Owner, invite a Manager, and accept through Mailpit as that recipient.
3. As Manager, edit the assigned roster and upload the guided Match Scoresheet.
4. As Owner, close registration, generate the seeded groups + knockout draw, and schedule a Match.
5. Process the representative Scoresheet, correct a flagged field, confirm, and check the public result, standings, and leaders without signing in.
6. Make one reasoned correction, open/respond to one private dispute, and demonstrate Match/Competition cancellation if those controls are part of the presentation.
7. Check the screens used in the demo at mobile width, with keyboard navigation, visible focus, readable contrast, and usable form errors.
8. Reset once more so the seeded starting point is ready for the stakeholder demo.

## 7. Definition of done

- The documented local start, seed, worker, and reset commands work.
- The guided demo completes without manual database edits, external OCR/AI services, or timing-dependent retries.
- The secondary Tennis Open screens and agreed lifecycle controls work well enough to support the demo.
- Public visitors require no account and cannot see private or administrative demo data.
- The guided screens meet the agreed accessibility essentials and display both languages without obvious missing copy.
- No test suite, CI, production hardening, or exhaustive acceptance matrix is required.
- Hosting remains a follow-up and does not block localhost completion.
