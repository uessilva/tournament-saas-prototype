# 04: Schedule Matches with Venues and conflict prevention

**What to build:** An Event Owner can incrementally assign Match times, durations, and Event-scoped Venues, with impossible Team or Venue overlaps blocked and changes immediately visible to Managers and public visitors.

**Blocked by:** 03 — Generate the Football tournament and publish fixtures.

**Status:** done

- [x] An Owner can create and reuse simple Event-scoped Venue labels.
- [x] Matches support optional start times, optional Venue assignments, and durations overriding the Competition default.
- [x] Unscheduled and partially scheduled Matches remain valid and visible.
- [x] Overlapping Matches involving the same Team are rejected regardless of Venue.
- [x] Overlapping Matches assigned to the same Venue are rejected, with no Owner override or bypass.
- [x] Conflict checks run whenever sufficient start-time, duration, Team, and Venue data is available.
- [x] Schedule errors explain the conflict and allow correction through time, duration, Venue, or entrant changes permitted by tournament state.
- [x] Summer Cup 2026 displays scheduling in America/Sao_Paulo and labels fixture times with the Event time zone.
- [x] Changing the Event time zone preserves every Match's local wall-clock date and time.
- [x] Public fixtures are grouped by date, filterable by Competition, and display duration-derived end times where available.
- [x] Schedule changes immediately update authenticated and public views without separate publication or notifications.
