# 03: Generate the Football tournament and publish fixtures

**What to build:** An Event Owner can validate Under-12 Football entrants, preview and adjust a reproducible groups + knockout draw, generate the tournament, and let Managers and public visitors view its fixtures.

**Blocked by:** 02 — Invite Team Managers and complete registration.

**Status:** done

- [x] Generation requires closed registration, valid entrants, at least two entrants per Competition and group, and enough entrants for the configured qualifiers.
- [x] The Owner can configure groups + knockout with one or two fixed qualifiers per group and no best-third advancement.
- [x] A stored seed makes group and bracket draws reproducible.
- [x] The Owner can preview, regenerate, and manually swap entrants until any Match in the Competition has a confirmed result.
- [x] Generated group fixtures and knockout starting positions persist in PostgreSQL and survive reloads.
- [x] Knockout brackets use the next power-of-two size, automatic Byes, crossed group-qualifier positions, and seeded resolution of otherwise random positions.
- [x] Advancing group qualifiers populate the correct later-round entrant slots.
- [x] Managers can view fixtures involving their assigned Teams.
- [x] Public visitors can view generated fixtures without signing in, including unscheduled Matches and Competition filtering.
- [x] Draw preview, regeneration, and entrant swaps are blocked after the first confirmed result.
