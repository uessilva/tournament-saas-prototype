# 09: Cancel and restore Matches and Competitions

**What to build:** An Event Owner can reversibly cancel an unplayed Match or an entire Competition while preserving history and clearly communicating the resulting public state.

**Blocked by:** 05 — Review a Football Scoresheet and publish its result.

**Status:** ready-for-agent

- [ ] An Owner can cancel an unplayed Match with an internal reason.
- [ ] A cancelled Match remains visible on authenticated schedules and public fixtures with a clear cancelled label.
- [ ] Cancelled Matches are excluded from standings, results, advancement calculations, and statistic leaders.
- [ ] Match Scoresheet history remains available after cancellation.
- [ ] An Owner can cancel an entire Competition only after supplying a public note.
- [ ] A cancelled Competition displays prominent status and note, keeps fixtures and published results readable, and blocks further competition mutations.
- [ ] Match and Competition cancellations are reversible by the Owner when no conflicting activity must first be corrected.
- [ ] Restoration returns the Match or Competition to its appropriate prior behavior without deleting or rewriting audit history.
- [ ] Internal Match cancellation reasons remain private.
- [ ] Public recalculation and read-only behavior update immediately after cancellation or restoration.
