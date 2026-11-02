/**
 * Pure scheduling overlap rules.
 *
 * Team conflicts apply regardless of Venue. Venue conflicts apply only when
 * both Matches are assigned to the same Venue. Touching intervals do not
 * overlap: a Match may start exactly when another ends.
 */

export type ScheduleTeam = {
  id: string;
  name: string;
};

export type ScheduleCandidate = {
  matchId: string;
  matchNumber: number;
  competitionName: string;
  startsAt: Date;
  durationMinutes: number;
  venueId: string | null;
  venueName: string | null;
  teams: ScheduleTeam[];
};

export type ScheduleExistingMatch = ScheduleCandidate;

export type ScheduleConflict = {
  kind: "team" | "venue";
  candidateMatchId: string;
  otherMatchId: string;
  otherMatchNumber: number;
  otherCompetitionName: string;
  teams: ScheduleTeam[];
  venueId: string | null;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  otherStartsAt: string;
  otherEndsAt: string;
};

export function effectiveDurationMinutes(
  override: number | null | undefined,
  competitionDefault: number | null | undefined,
) {
  if (override != null && override > 0) {
    return override;
  }
  if (competitionDefault != null && competitionDefault > 0) {
    return competitionDefault;
  }
  return null;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function intervalsOverlap(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

/**
 * Returns every conflict for a candidate schedule against other Matches in the
 * same Event. Callers pass Matches that already have a start and duration and
 * exclude byes, cancelled Matches, and the candidate itself.
 */
export function findScheduleConflicts(
  candidate: ScheduleCandidate,
  existingMatches: ScheduleExistingMatch[],
): ScheduleConflict[] {
  if (!(candidate.durationMinutes > 0)) {
    return [];
  }

  const candidateStart = candidate.startsAt;
  const candidateEnd = addMinutes(candidateStart, candidate.durationMinutes);
  const candidateTeamIds = new Set(candidate.teams.map((team) => team.id));
  const conflicts: ScheduleConflict[] = [];

  for (const existing of existingMatches) {
    if (existing.matchId === candidate.matchId) {
      continue;
    }
    if (!(existing.durationMinutes > 0)) {
      continue;
    }

    const existingStart = existing.startsAt;
    const existingEnd = addMinutes(existingStart, existing.durationMinutes);

    if (
      !intervalsOverlap(
        candidateStart,
        candidateEnd,
        existingStart,
        existingEnd,
      )
    ) {
      continue;
    }

    const sharedTeams = existing.teams.filter((team) =>
      candidateTeamIds.has(team.id),
    );

    if (sharedTeams.length) {
      conflicts.push({
        kind: "team",
        candidateMatchId: candidate.matchId,
        otherMatchId: existing.matchId,
        otherMatchNumber: existing.matchNumber,
        otherCompetitionName: existing.competitionName,
        teams: sharedTeams,
        venueId: existing.venueId,
        venueName: existing.venueName,
        startsAt: candidateStart.toISOString(),
        endsAt: candidateEnd.toISOString(),
        otherStartsAt: existingStart.toISOString(),
        otherEndsAt: existingEnd.toISOString(),
      });
    }

    if (
      candidate.venueId != null &&
      existing.venueId != null &&
      candidate.venueId === existing.venueId
    ) {
      conflicts.push({
        kind: "venue",
        candidateMatchId: candidate.matchId,
        otherMatchId: existing.matchId,
        otherMatchNumber: existing.matchNumber,
        otherCompetitionName: existing.competitionName,
        teams: [],
        venueId: existing.venueId,
        venueName: candidate.venueName ?? existing.venueName,
        startsAt: candidateStart.toISOString(),
        endsAt: candidateEnd.toISOString(),
        otherStartsAt: existingStart.toISOString(),
        otherEndsAt: existingEnd.toISOString(),
      });
    }
  }

  return conflicts;
}
