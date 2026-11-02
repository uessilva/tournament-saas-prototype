# 08: Support the remaining tournament formats

**What to build:** Beyond the guided groups + knockout journey, an Event Owner can configure and run single round-robin or single-elimination Competitions for either Football or tennis using the same fixtures, results, and public pages.

**Blocked by:** 03 — Generate the Football tournament and publish fixtures; 07 — Complete the Tennis Open journey.

**Status:** done

- [x] An Owner can select single round-robin, single-elimination, or groups + knockout for Football and tennis.
- [x] Single round-robin generates each entrant pairing once and feeds the appropriate sport's standings.
- [x] Single-elimination generates a next-power-of-two bracket with automatic Byes and seeded otherwise-random positions.
- [x] Every format requires valid entrants and at least two entrants per Competition.
- [x] Seeded preview, regeneration, and manual entrant swaps work consistently until any Match has a confirmed result.
- [x] Football and tennis published results advance knockout entrants correctly in every supported format.
- [x] Existing scheduling, Scoresheet review, corrections, cancellation, and public pages work without format-specific duplicate workflows.
- [x] The guided Summer Cup seed continues to use Football groups + knockout and remains resettable.
