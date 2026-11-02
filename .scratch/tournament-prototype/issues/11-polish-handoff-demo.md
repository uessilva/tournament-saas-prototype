# 11: Polish and hand off the stakeholder demo

**What to build:** A presenter can deliver a coherent, polished Summer Cup demonstration in Portuguese or English, on desktop or mobile, using documented local commands and a reliable reset.

**Blocked by:** 04 — Schedule Matches with Venues and conflict prevention; 06 — Correct results and calculate Football standings; 08 — Support the remaining tournament formats; 09 — Cancel and restore Matches and Competitions; 10 — Handle private Match disputes.

**Status:** ready-for-agent

- [ ] The implemented Event-hub experience has a bespoke Summer Cup identity, distinctive display typography, sport-specific accents, and original visual assets.
- [ ] Guided screens have no placeholder content or dead controls and work at mobile and desktop widths.
- [ ] Brazilian Portuguese is the default, English is available throughout, and the header switcher persists its selection locally across reloads.
- [ ] Application chrome, validation messages, and seeded display content are translated; user-entered content remains in its original language.
- [ ] Keyboard operation, visible focus, semantic labels, sufficient contrast, accessible form errors, and 200% zoom/reflow receive a lightweight manual check on guided screens.
- [ ] The README documents local setup, migrations, seed/reset, seeded accounts, Mailpit, worker and synchronous/OCR fallback, and the stakeholder demo script.
- [ ] A manual walkthrough completes the guided Football journey from reset through invitation, roster, draw, schedule, Scoresheet review, publication, correction, standings/leaders, dispute, cancellation, and final reset.
- [ ] Tennis Open and any additional behavior intended for presentation receive a brief manual smoke check.
- [ ] The demo runs without manual database edits, external OCR/AI services, or timing-dependent retries.
- [ ] No automated test suite, CI, production-hardening work, or public deployment is added as part of this ticket.
