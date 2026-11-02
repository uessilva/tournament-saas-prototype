# 04: Schedule Matches with Venues and conflict prevention

**What to build:** An Event Owner can incrementally assign Match times, durations, and Event-scoped Venues, with impossible Team or Venue overlaps blocked and changes immediately visible to Managers and public visitors.

**Blocked by:** 03 — Generate the Football tournament and publish fixtures.

**Status:** ready-for-agent

- [ ] An Owner can create and reuse simple Event-scoped Venue labels.
- [ ] Matches support optional start times, optional Venue assignments, and durations overriding the Competition default.
- [ ] Unscheduled and partially scheduled Matches remain valid and visible.
- [ ] Overlapping Matches involving the same Team are rejected regardless of Venue.
- [ ] Overlapping Matches assigned to the same Venue are rejected, with no Owner override or bypass.
- [ ] Conflict checks run whenever sufficient start-time, duration, Team, and Venue data is available.
- [ ] Schedule errors explain the conflict and allow correction through time, duration, Venue, or entrant changes permitted by tournament state.
- [ ] Summer Cup 2026 displays scheduling in America/Sao_Paulo and labels fixture times with the Event time zone.
- [ ] Changing the Event time zone preserves every Match's local wall-clock date and time.
- [ ] Public fixtures are grouped by date, filterable by Competition, and display duration-derived end times where available.
- [ ] Schedule changes immediately update authenticated and public views without separate publication or notifications.
