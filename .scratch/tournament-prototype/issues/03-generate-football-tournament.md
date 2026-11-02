# 03: Generate the Football tournament and publish fixtures

**What to build:** An Event Owner can validate Under-12 Football entrants, preview and adjust a reproducible groups + knockout draw, generate the tournament, and let Managers and public visitors view its fixtures.

**Blocked by:** 02 — Invite Team Managers and complete registration.

**Status:** ready-for-agent

- [ ] Generation requires closed registration, valid entrants, at least two entrants per Competition and group, and enough entrants for the configured qualifiers.
- [ ] The Owner can configure groups + knockout with one or two fixed qualifiers per group and no best-third advancement.
- [ ] A stored seed makes group and bracket draws reproducible.
- [ ] The Owner can preview, regenerate, and manually swap entrants until any Match in the Competition has a confirmed result.
- [ ] Generated group fixtures and knockout starting positions persist in PostgreSQL and survive reloads.
- [ ] Knockout brackets use the next power-of-two size, automatic Byes, crossed group-qualifier positions, and seeded resolution of otherwise random positions.
- [ ] Advancing group qualifiers populate the correct later-round entrant slots.
- [ ] Managers can view fixtures involving their assigned Teams.
- [ ] Public visitors can view generated fixtures without signing in, including unscheduled Matches and Competition filtering.
- [ ] Draw preview, regeneration, and entrant swaps are blocked after the first confirmed result.
