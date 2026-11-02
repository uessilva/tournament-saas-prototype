---
labels:
  - wayfinder:map
---

# Tournament SaaS Prototype

## Destination

A build-ready plan for a polished, working web prototype demonstrating registration, event and competition setup, invitations, tournament generation, reviewed PDF result extraction, and public leaderboards. Wayfinding resolves decisions; it does not implement the prototype.

**Build plan:** [Prototype implementation plan](implementation-plan.md).

## Notes

- Local Markdown tracker stored in Git. Tickets are child files in `tickets/`; `map.md` is their parent.
- Consult the `grilling` and `domain-modeling` skills for HITL decision tickets and the skill named by each ticket type.
- Optimize for a convincing stakeholder demo and one guided end-to-end scenario, not production readiness.
- Persist prototype data in a real application database and provide a seeded, resettable demo event.
- Only `wayfinder:` labels are used. Open, unassigned, unblocked tickets form the frontier. Blocking is recorded in ticket frontmatter because Markdown has no native dependency relationship.

## Decisions so far

<!-- One line per closed ticket: gist the answer and link to its detail. -->

- [Investigate reviewed PDF scoresheet extraction](tickets/investigate-pdf-extraction.md): Use fillable AcroForm PDFs with stable fields and QR identifiers; directly extract digital values, use fixed-region OCR/document AI for scans, and require human review for hand-filled scans and flagged fields.
- [Choose the prototype application architecture](tickets/choose-application-architecture.md): Use a feature-oriented Next.js/TypeScript application with PostgreSQL/Drizzle, Auth.js magic links and demo account switching, database-backed local jobs, local file storage, Mailpit, and a real AcroForm path plus replaceable Tesseract scan extraction.
- [Specify competition and tournament behavior](tickets/specify-competition-rules.md): Support football teams and tennis singles across round-robin, single-elimination, and groups + knockout; use seeded draws, explicit eligibility validation, deterministic advancement and tie-breakers, distinct walkovers, football shootouts, best-of-three tennis, and guarded knockout-result corrections.
- [Define result review and publication behavior](tickets/define-results-publication.md): Separate Match and Scoresheet states; Event Owners confirm or manually enter results for immediate atomic publication, with replacement uploads, versioned reasoned corrections, and transactional recalculation of standings and sport-specific leaders.
- [Define invitation and access behavior](tickets/define-invitation-security.md): Use email-bound single-use invitations and revocable Team-scoped reusable links with seven-day expiry, authenticated acceptance, multiple Team Managers, explicit access removal, idempotent redemption, opaque hashed tokens, and owner-visible audit history.
- [Define the guided demo experience](tickets/define-demo-experience.md): Use the public-first Event hub direction with a seeded Summer Cup 2026, Under-12 Football as the guided journey and Tennis Open as the secondary Competition; ship on localhost first, then deploy authenticated administration and no-login public event pages for external audiences.
- [Specify scheduling and venue behavior](tickets/specify-scheduling-venues.md): Use optional per-Match times, durations, and Event-scoped Venues; block Team and Venue overlaps without overrides, display fixtures in one Event time zone, and exclude external calendars and automated scheduling.
- [Define accessibility, localization, and visual brand requirements](tickets/define-presentation-requirements.md): Target WCAG 2.2 AA essentials, support English and Brazilian Portuguese with Portuguese as the default and a locally persisted language switcher, translate the UI and seeded content, and evolve the Event-hub wireframe into a bespoke Summer Cup identity.
- [Define additional competition lifecycle controls](tickets/define-competition-lifecycle.md): Combine manual registration controls with optional deadlines, support reversible Match and Competition cancellation, and use private Manager-opened disputes with Owner responses and optional linked result corrections.

## Not yet specified

- External demo-hosting provider and URL; public deployment is a follow-up after the localhost prototype.

## Out of scope

- Billing, payments, and subscription management: not needed to validate the prototype journey.
- Multi-organization administration: one Event Owner administering an event is sufficient.
- Live scoring and native mobile applications: outside the guided prototype scenario.
- Production-grade PDF verification and unattended extraction: uploaded scoresheets require human confirmation.
- Production hardening and scale: the destination is a demonstrable prototype, not a production launch.
