---
labels:
  - wayfinder:grilling
parent: ../map.md
assignee:
blocked_by: []
status: closed
---

# Specify competition and tournament behavior

## Question

How should football and tennis entrants, age and roster eligibility, round-robin, single-elimination, and groups + knockout behave? Define draws, byes, advancement, tie-breakers, walkovers, result correction, and which of these cases the prototype must support.

## Resolution

Support football Teams and tennis singles, with a singles player represented by a one-Participant Team. Exclude doubles and team tennis. A Competition may define an allowed birth-date range and roster-size limits; Participants must be unique within it, and all entrants must pass validation before generation.

Support single round-robin, single-elimination, and groups + knockout for both sports, using groups + knockout for the guided demo. Use a reproducible seeded random draw with preview, regeneration, and manual entrant swaps until any Match has a confirmed result. Require at least two entrants per Competition and group and enough entrants for the selected qualifiers.

Football round-robin awards 3/1/0 points for wins/draws/losses; tennis awards 2/0 for wins/losses. Groups + knockout allows one or two fixed qualifiers per group, with no best-third advancement. Knockout brackets use the next power-of-two size, automatic byes, crossed group-qualifier positions, and seeded resolution of otherwise random positions.

Order tied football Teams by points, head-to-head points, head-to-head goal difference, overall goal difference, goals scored, then a visible seeded random draw. Order tied tennis entrants by points, head-to-head result when exactly two are tied, set difference, game difference, then a visible seeded random draw.

Record walkovers distinctly, score them as 3–0 in football or 6–0, 6–0 in tennis for standings, and exclude their Participant statistics. Resolve drawn football knockout Matches directly by penalty shootout; shootout goals determine advancement but do not affect Match score or statistics. Tennis uses best-of-three standard tie-break sets, including a full third set, with set and tie-break scores but no individual point recording.

Correcting a confirmed knockout winner updates the next-round slot only when no downstream Match has a confirmed result. Otherwise, downstream results must be reopened or corrected in reverse order first.
