# 06: Correct results and calculate Football standings

**What to build:** Published Football results drive standings, statistic leaders, and knockout advancement, and an Event Owner can make reasoned, versioned corrections without leaving inconsistent bracket history.

**Blocked by:** 05 — Review a Football Scoresheet and publish its result.

**Status:** done

- [x] Football round-robin standings award 3/1/0 points for wins/draws/losses.
- [x] Ties resolve by points, head-to-head points, head-to-head goal difference, overall goal difference, goals scored, then a visible reproducible seeded draw.
- [x] Public standings update immediately from all current confirmed result versions after publication or correction.
- [x] Football goals and assists leaders update immediately, and walkovers contribute no Participant statistics.
- [x] Walkovers are distinct outcomes scored as 3–0 for standings.
- [x] Drawn knockout Matches use penalty shootouts for advancement without changing Match score or Participant statistics.
- [x] Group qualifiers and knockout winners populate the correct subsequent entrant slots.
- [x] A published correction requires a reason, creates a new confirmed result version, and retains previous versions and reviewer edits.
- [x] Correction reasons are visible in Owner audit history but never publicly.
- [x] Correcting a knockout winner updates the next-round slot only when no downstream Match has a confirmed result.
- [x] When downstream results exist, correction is blocked until those Matches are reopened or corrected in reverse order.
- [x] Result confirmation/correction, current-version selection, advancement, standings, and leaders update in one database transaction.
