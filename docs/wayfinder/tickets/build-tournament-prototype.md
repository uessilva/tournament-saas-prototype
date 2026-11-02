---
labels:
  - wayfinder:ready-for-agent
parent: ../map.md
assignee:
blocked_by: []
status: open
---

# Build the tournament SaaS prototype

## Problem Statement

A stakeholder needs to experience how the tournament product works before committing to a production application. There is currently no working software: only product decisions, a visual wireframe, and an implementation plan. The prototype must make the complete journey tangible for an Event Owner, Team Managers, and public visitors while remaining quick to build and easy to reset for repeated demonstrations.

## Solution

Build a polished but throwaway web prototype for the seeded Summer Cup 2026. Its primary guided journey follows Under-12 Football from Event and Competition setup through Team invitation, roster management, tournament generation, scheduling, Scoresheet upload and review, result publication, standings, and statistic leaders. Tennis Open demonstrates individual entrants and tennis-specific scoring. Public Event pages require no login; Owner and Manager areas are authenticated. The application runs locally with a real PostgreSQL database, Mailpit, local files, seeded data, and a one-command reset. Public deployment is a later follow-up.

## User Stories

1. As a stakeholder, I want a seeded Summer Cup 2026, so that I can immediately explore a realistic Event without creating demonstration data.
2. As a stakeholder, I want a one-command demo reset, so that every presentation starts from the same known state.
3. As a stakeholder, I want a guided Under-12 Football journey, so that I can understand the product's complete workflow in one coherent scenario.
4. As a stakeholder, I want Tennis Open as a secondary Competition, so that I can see that the product supports individual sports as well as Teams.
5. As a public visitor, I want to open an Event hub without signing in, so that I can follow Summer Cup 2026 easily.
6. As a public visitor, I want an editorial Event overview with bespoke Summer Cup styling, so that the experience feels like a real sporting Event rather than a generic administration tool.
7. As a public visitor, I want Competition-specific navigation, so that I can find Under-12 Football and Tennis Open content.
8. As a public visitor, I want date-grouped fixtures with Competition filters, so that I can find Matches that interest me.
9. As a public visitor, I want fixture times labelled with the Event time zone, so that I know when Matches occur.
10. As a public visitor, I want unscheduled and partially scheduled Matches to remain visible, so that incomplete scheduling does not hide fixtures.
11. As a public visitor, I want published Match results, so that I can follow completed competition.
12. As a public visitor, I want current group standings and rankings, so that I can understand each entrant's position.
13. As a public visitor, I want visible tie-break and seeded-draw resolutions, so that standings are understandable.
14. As a public visitor, I want football goals and assists leaders, so that I can follow individual performance.
15. As a public visitor, I want tennis aces and double-faults leaders, so that I can follow sport-specific performance.
16. As a public visitor, I want cancelled Matches and Competitions clearly labelled, so that I do not mistake them for active competition.
17. As a public visitor, I want a public Competition cancellation note, so that I understand why a Competition stopped.
18. As a public visitor, I want private disputes and correction reasons excluded from public pages, so that sensitive administration remains private.
19. As a visitor, I want Brazilian Portuguese by default and an English language switcher, so that I can use the prototype in my preferred supported language.
20. As a visitor, I want my language selection retained in my browser, so that I do not need to change it after every reload.
21. As a keyboard user, I want operable controls, visible focus, semantic labels, and accessible errors, so that I can complete the demonstrated journeys.
22. As a mobile or zoomed-in user, I want responsive reflow and readable contrast, so that the guided screens remain usable.
23. As an Event Owner, I want to sign in with an email magic link, so that I can access Event administration without a password.
24. As a demo presenter, I want seeded account switching, so that I can move quickly between Owner and Team Manager perspectives.
25. As an Event Owner, I want a guided setup checklist, so that I know the next step in preparing my Event.
26. As an Event Owner, I want to configure an Event time zone, so that scheduling and fixture display use a consistent local time.
27. As an Event Owner, I want changing the Event time zone to preserve Match wall-clock times, so that a display-time-zone change does not unexpectedly reschedule fixtures.
28. As an Event Owner, I want reusable Event-scoped Venues, so that I can assign Matches to named playing areas.
29. As an Event Owner, I want to configure a Competition's sport, format, eligibility, registration, and default Match duration, so that it behaves appropriately for its entrants.
30. As an Event Owner, I want football Team and tennis singles entrants, so that both supported sport models are represented.
31. As an Event Owner, I want optional birth-date ranges and roster-size limits, so that entrants meet Competition eligibility rules.
32. As an Event Owner, I want Participant uniqueness within a Competition, so that a person cannot be entered twice improperly.
33. As an Event Owner, I want manual registration open/close controls and an optional deadline, so that I can control when entrant and roster changes stop.
34. As an Event Owner, I want an elapsed registration deadline to close registration until extended, so that cutoff behavior is automatic.
35. As an Event Owner, I want to reopen registration only before tournament generation, so that generated competition remains consistent.
36. As an Event Owner, I want registration closure to block entrant additions, removals, and roster edits, so that tournament input is stable.
37. As an Event Owner, I want to invite Team Managers by email for selected Teams, so that roster and Scoresheet responsibilities can be delegated.
38. As an Event Owner, I want reusable Team-scoped share links, so that I can onboard Managers through an alternative authenticated flow.
39. As an Event Owner, I want invitations and links to expire after seven days and support revocation or replacement, so that access can be controlled.
40. As an Event Owner, I want revoking a link to block future acceptance without removing existing Managers, so that link management and access removal remain distinct.
41. As an Event Owner, I want to remove a Team Manager explicitly, so that I can revoke that User's existing Team access.
42. As an Event Owner, I want invitation creation, acceptance, revocation, expiry, accepting Users, and Team assignments visible in an audit history, so that I can understand access activity.
43. As an Event Owner, I want multiple Managers per Team, so that responsibility can be shared.
44. As a Team Manager, I want an email invitation to require authentication as the invited email, so that only the intended recipient can accept it.
45. As a Team Manager, I want my invitation destination preserved through magic-link sign-in, so that authentication does not lose my original task.
46. As a Team Manager, I want repeated invitation acceptance to be idempotent, so that retries do not create duplicate access or errors.
47. As a Team Manager, I want to edit only my assigned Teams' rosters while registration is open, so that I can manage Participants without administering the Event.
48. As a Team Manager, I want to see my Teams' fixtures, so that I know which Matches require action.
49. As a Team Manager, I want to upload Scoresheets only for my own Matches, so that result submission stays within my responsibilities.
50. As a Team Manager, I want to replace a failed or rejected Scoresheet, so that I can still submit the Match result for review.
51. As an Event Owner, I want tournament generation to validate all entrants and configuration first, so that invalid Competitions do not produce fixtures.
52. As an Event Owner, I want single round-robin, single-elimination, and groups + knockout formats for both sports, so that the agreed tournament models are available.
53. As an Event Owner, I want a reproducible seeded random draw with preview, regeneration, and manual entrant swaps, so that I can shape the draw before results exist.
54. As an Event Owner, I want draw changes blocked after any confirmed result, so that recorded competition cannot be invalidated casually.
55. As an Event Owner, I want groups + knockout with one or two qualifiers per group and crossed qualifier positions, so that group advancement produces a coherent bracket.
56. As an Event Owner, I want automatic Byes using the next power-of-two knockout bracket, so that incomplete brackets advance entrants correctly.
57. As an Event Owner, I want optional Match start times, duration overrides, and Venue assignments, so that I can schedule fixtures incrementally.
58. As an Event Owner, I want Team and Venue overlaps blocked without an override, so that I cannot create impossible schedules.
59. As an Event Owner, I want schedule changes to update authenticated and public views immediately, so that no separate publication step is needed.
60. As an Event Owner, I want football standings to use 3/1/0 points and the agreed tie-break sequence, so that Competition rankings follow football rules.
61. As an Event Owner, I want tennis standings to use 2/0 points and the agreed tie-break sequence, so that individual Competition rankings follow the specified rules.
62. As an Event Owner, I want distinct walkovers with the specified standing scores and no Participant statistics, so that forfeits advance entrants without distorting leaders.
63. As an Event Owner, I want drawn football knockout Matches resolved by penalty shootout, so that a winner advances without changing the Match score or statistics.
64. As an Event Owner, I want best-of-three tennis results with set and tie-break scores, so that tennis outcomes can be recorded without point-by-point scoring.
65. As a Team Manager, I want a competition-specific fillable PDF Scoresheet with a QR identity, so that I can print or digitally complete a standardized Match record.
66. As an Event Owner, I want direct extraction of digital AcroForm values, so that digitally completed Scoresheets do not require OCR.
67. As an Event Owner, I want scan extraction through QR identity and fixed-region OCR, so that hand-filled Scoresheets can enter the same review flow.
68. As an Event Owner, I want extraction confidence, source-image crops, and conservative validation flags, so that uncertain values are visible during review.
69. As an Event Owner, I want side-by-side source and extracted-value review, so that I can confirm or correct a Scoresheet confidently.
70. As an Event Owner, I want every hand-filled scan and flagged digital extraction to require review, so that extraction never publishes uncertain results unattended.
71. As an Event Owner, I want separate Match and Scoresheet states, so that processing and review progress is clear.
72. As an Event Owner, I want extraction failure or rejection to return the Match to awaiting result, so that replacement upload or manual entry can proceed.
73. As an Event Owner, I want previous Scoresheet uploads retained with only one active, so that I can inspect history without ambiguous input.
74. As an Event Owner, I want manual result entry with explicit confirmation, so that extraction is not required to publish a result.
75. As an Event Owner, I want valid Scoresheet confirmation to publish the Match and recalculate public competition data immediately, so that review leads directly to visible results.
76. As an Event Owner, I want published corrections to require a reason and retain previous versions and reviewer edits, so that changes remain auditable.
77. As an Event Owner, I want corrections to recalculate standings, advancement, and leaders immediately, so that public pages reflect the current result.
78. As an Event Owner, I want knockout winner corrections guarded by downstream results, so that bracket history cannot become inconsistent.
79. As an Event Owner, I want downstream Matches corrected in reverse order when necessary, so that a bracket can be repaired safely.
80. As an Event Owner, I want to cancel and restore an unplayed Match with an internal reason, so that exceptional scheduling circumstances can be represented without deleting history.
81. As an Event Owner, I want cancelled Matches excluded from standings and results but retained on schedules, so that public audiences see the cancellation without distorted calculations.
82. As an Event Owner, I want to cancel and restore an entire Competition with a required public note, so that the Competition becomes read-only while its history remains available.
83. As a Team Manager, I want one active private dispute per published Match with a required explanation, so that I can raise a concern without changing the public result.
84. As an Event Owner, I want to resolve or dismiss disputes with a required response, so that Manager concerns receive a recorded outcome.
85. As an Event Owner, I want an upheld dispute optionally linked to a separate reasoned correction, so that dispute handling and result correction remain distinct but connected.
86. As an involved Owner or Team Manager, I want dispute explanations and responses restricted to the Owner and involved Teams, so that other Users cannot see private discussions.
87. As an Event Owner, I want failed background jobs visible with a manual retry, so that a failed demonstration step can be recovered.
88. As a demo presenter, I want representative seeded extraction results and synchronous job fallback, so that the demo does not depend on OCR speed or availability.
89. As a demo presenter, I want pending-invitation and Mailpit shortcuts in the protected demo UI, so that email onboarding is easy to demonstrate.
90. As a demo presenter, I want no placeholder screens or dead controls on the guided path, so that the prototype feels complete to stakeholders.

## Implementation Decisions

- Deliver one feature-oriented Next.js App Router package using React, TypeScript, Tailwind CSS, and pnpm. This is demonstration code, not the foundation for a production architecture.
- Use PostgreSQL through Drizzle ORM with Docker Compose, straightforward migrations, and a repeatable seed/reset command. Persist prototype behavior in the real database rather than browser-only state.
- Organize code by Event, Competition, Team, Match, Scoresheet, and public viewing concerns. Prefer direct feature implementations and small helpers over generalized frameworks or speculative abstractions.
- Keep draw generation, eligibility, scoring, standings, advancement, and schedule-overlap calculations in focused domain functions so preview and persistence use the same behavior.
- Use Auth.js email magic links with Mailpit. Add a development-only seeded account switcher and protected demo reset controls. Enforce Owner and assigned-Team Manager permissions on mutations.
- Use opaque cryptographically random invitation tokens, store only token hashes, and keep raw tokens out of logs and audit records. Email invitations are single-use and recipient-bound; reusable links are Team-scoped. Both default to seven-day expiry and authenticated idempotent acceptance.
- Model Event Owner administration at Event scope and Team Manager access per Team. Participants are roster records without accounts.
- Persist Events, Venues, Competitions, Teams, Participants, Team Manager assignments, invitations and their Team selections, access history, groups and draw positions, Matches and entrant slots, versioned results, sport-specific scores, Participant statistics, Scoresheets and extracted fields, jobs, disputes, and audit events.
- A Team belongs to one Competition. Tennis singles uses a one-Participant Team. Competition configuration includes sport, format, eligibility, registration state/deadline, seed, default Match duration, and cancellation data.
- Matches support optional schedule data and distinct awaiting-result, in-review, and published states. Scoresheets independently track upload, processing, review, confirmation, failure, and rejection. Only one Scoresheet is active, while history is retained.
- Result confirmation/manual entry, publication, and recalculation occur atomically. Standings and leaders derive from all current confirmed result versions. Published corrections append versions with a reason and reviewer provenance.
- Knockout winner correction updates the next-round slot only if no downstream confirmed result exists; otherwise downstream results must be reopened or corrected in reverse order first.
- Registration closes manually or at its Event-time-zone deadline. Entrant/roster mutations stop while closed, and reopening is allowed only before generation.
- Seeded draws are reproducible. Groups + knockout supports one or two fixed qualifiers, no best-third advancement, crossed group-qualifier positions, next-power-of-two brackets, and automatic Byes.
- Football and tennis use the agreed points and ordered tie-breakers. Walkovers use the agreed standing scores but create no Participant statistics. Football shootouts determine advancement only. Tennis uses best-of-three standard tie-break sets with a full third set.
- Team overlap validation applies regardless of Venue; Venue overlap applies to the same assigned Venue. There is no administrative bypass. Event time-zone changes preserve local Match wall-clock values.
- Generate competition-specific fillable AcroForm PDFs using stable fields and QR identifiers for sheet, template version, and page. Extract digital fields directly and scans through a small replaceable local Tesseract adapter.
- Store original PDFs, previews, and crops locally with metadata in PostgreSQL. Use seeded representative extraction outcomes for reliable demonstrations.
- Process extraction and email through the agreed PostgreSQL-backed local worker with leases, attempts, errors, and manual retry. Allow synchronous execution as a demo fallback.
- Match cancellation retains Scoresheet history and excludes the Match from calculations. Competition cancellation blocks further changes, makes public content read-only, and displays the required public note. Restoration preserves audit history when no conflicting activity blocks it.
- Disputes are private to the Owner and involved Team Managers. Opening one does not unpublish or change a result. An upheld dispute may link to a separate correction.
- Build public Event-hub pages and authenticated Owner/Manager areas around the approved wireframe. Use the same underlying fixture/result read models, with publication filtering at the public query boundary.
- Provide Brazilian Portuguese and English dictionaries for chrome, validation, and seeded display content. Default to Portuguese and store the browser selection locally; do not add account locale preferences or localized routes.
- Apply bespoke Summer Cup visual assets and sport-specific accents. Meet the agreed WCAG 2.2 AA essentials on guided screens through lightweight manual checks.
- Optimize implementation order for a working vertical slice: foundation and seeds; access and registration; tournament and schedule; reviewed results; lifecycle and polish; demo handoff.

## Testing Decisions

- Do not create a unit, integration, end-to-end, CI, or other automated test suite. This is throwaway prototype code.
- Use the highest-level and only verification seam: the application running in a browser against the real local PostgreSQL database, Mailpit, local storage, and worker/fallback.
- Manually walk the complete guided Under-12 Football journey before demonstration: reset, language switching, Owner login, invitation acceptance, Manager roster editing, registration closure, seeded draw generation, scheduling, Scoresheet upload, flagged-field review, publication, public standings/leaders, and reset.
- Manually smoke-check Tennis Open result entry and the lifecycle controls that will be shown, including one correction, private dispute, and cancellation/restoration.
- Check the screens used in the demo at mobile width and with keyboard navigation, visible focus, contrast, form errors, and zoom/reflow.
- Treat seeded extraction fixtures as demo inputs, not fixtures for an automated test framework.
- There is no existing codebase test prior art to follow, and none should be introduced for this prototype.

## Out of Scope

- Production readiness, maintainability investment, exhaustive edge-case verification, automated testing, CI, formal release processes, scale, and production hardening.
- Public hosting provider selection and deployment until the localhost demo is accepted.
- Billing, payments, subscriptions, and multi-organization administration.
- Live scoring, native mobile applications, external calendar feeds, `.ics` exports, personal calendar synchronization, automated scheduling, and conflict optimization.
- Venue addresses, capacities, maps, and independent availability management.
- Doubles or team tennis and individual-point tennis scoring.
- Best-third advancement and overrides for scheduling conflicts.
- Automated publication of extracted Scoresheet results or production-grade PDF verification.
- External OCR or document-AI dependencies for a reliable guided demonstration.
- Account-level locale preferences, localized URL routes, and translation of user-entered names or descriptions.

## Further Notes

- The closed wayfinder tickets remain the source of detailed product decisions; this specification consolidates them into the implementation request.
- The approved Event-hub wireframe is the visual starting point, with bespoke Summer Cup refinement rather than a new navigation direction.
- All seeded people and contact details must be fictitious.
- The prototype is complete when the documented local commands work and the guided stakeholder demo is reliable, not when it meets production engineering standards.
