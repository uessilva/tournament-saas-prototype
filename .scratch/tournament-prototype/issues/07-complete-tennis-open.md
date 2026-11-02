# 07: Complete the Tennis Open journey

**What to build:** An Event Owner can run Tennis Open with singles entrants and best-of-three results, review or manually confirm scores, and publish tennis standings and statistic leaders.

**Blocked by:** 05 — Review a Football Scoresheet and publish its result.

**Status:** done

- [x] Tennis Open uses one-Participant Teams and enforces singles eligibility without introducing doubles or team tennis.
- [x] Tennis results support best-of-three standard tie-break sets, a full third set, set scores, and tie-break scores without individual-point recording.
- [x] Tennis Scoresheets use the same QR-identified, competition-specific generation, upload, extraction, and Owner-review journey as Football.
- [x] The Owner can manually enter and explicitly confirm a valid tennis result.
- [x] Confirmation publishes the Match and immediately updates public results.
- [x] Tennis standings award 2/0 points for wins/losses.
- [x] Ties resolve by points, head-to-head result when exactly two are tied, set difference, game difference, then a visible reproducible seeded draw.
- [x] Walkovers are distinct outcomes scored as 6–0, 6–0 for standings and contribute no Participant statistics.
- [x] Public statistic leaders show tennis aces and double faults.
- [x] Reasoned result versions and corrections recalculate tennis standings, advancement, and leaders using the shared publication behavior.
- [x] Knockout winner corrections obey downstream-result guards.
