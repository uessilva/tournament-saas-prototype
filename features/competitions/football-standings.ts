/**
 * Pure football group standings.
 *
 * Only confirmed current result versions reach this function. Tie-breakers run
 * in the agreed order: points, head-to-head points and goal difference among the
 * tied Teams only, overall goal difference, goals scored, then a reproducible
 * seeded draw based on the Competition's visible draw seed.
 */

import { hashSeed } from "@/features/competitions/draw";

export type FootballStandingTeam = {
  teamId: string;
  teamName: string;
  seedPosition: number;
};

export type FootballStandingMatch = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isWalkover: boolean;
  walkoverWinnerTeamId: string | null;
};

export type FootballStandingRow = {
  teamId: string;
  teamName: string;
  seedPosition: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  headToHeadPoints: number;
  headToHeadGoalDifference: number;
};

export type SeededStandingDraw = {
  teamIds: string[];
  teamNames: string[];
};

export type FootballStandingsResult = {
  rows: FootballStandingRow[];
  seededDraws: SeededStandingDraw[];
};

const WIN_POINTS = 3;
const DRAW_POINTS = 1;

type PairResult = {
  goalsFor: number;
  goalsAgainst: number;
  points: number;
};

/**
 * Walkovers are always 3–0 regardless of any defensive fallback values.
 * A missing walkover winner forfeits the distinction, so raw scores are kept.
 */
function matchScore(match: FootballStandingMatch) {
  if (match.isWalkover && match.walkoverWinnerTeamId) {
    return match.walkoverWinnerTeamId === match.homeTeamId
      ? { home: 3, away: 0 }
      : { home: 0, away: 3 };
  }
  return { home: match.homeScore, away: match.awayScore };
}

function seededTieBreakKey(seed: string, teamId: string) {
  return hashSeed(`${seed}:${teamId}`);
}

export function calculateFootballStandings(
  teams: FootballStandingTeam[],
  matches: FootballStandingMatch[],
  drawSeed: string,
): FootballStandingsResult {
  const rows = new Map<string, FootballStandingRow>();

  for (const team of teams) {
    rows.set(team.teamId, {
      teamId: team.teamId,
      teamName: team.teamName,
      seedPosition: team.seedPosition,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      headToHeadPoints: 0,
      headToHeadGoalDifference: 0,
    });
  }

  for (const match of matches) {
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) {
      continue;
    }

    const score = matchScore(match);
    home.played += 1;
    away.played += 1;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;

    if (score.home > score.away) {
      home.won += 1;
      away.lost += 1;
      home.points += WIN_POINTS;
    } else if (score.away > score.home) {
      away.won += 1;
      home.lost += 1;
      away.points += WIN_POINTS;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += DRAW_POINTS;
      away.points += DRAW_POINTS;
    }
  }

  for (const row of rows.values()) {
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  // Head-to-head only ever considers matches played between Teams that are
  // level on overall points. It is recalculated per tie group, never globally.
  const headToHead = (bucket: FootballStandingRow[]) => {
    const ids = new Set(bucket.map((row) => row.teamId));
    const stats = new Map<string, PairResult>(
      bucket.map((row) => [
        row.teamId,
        { goalsFor: 0, goalsAgainst: 0, points: 0 },
      ]),
    );

    for (const match of matches) {
      if (!ids.has(match.homeTeamId) || !ids.has(match.awayTeamId)) {
        continue;
      }
      const score = matchScore(match);
      const home = stats.get(match.homeTeamId)!;
      const away = stats.get(match.awayTeamId)!;
      home.goalsFor += score.home;
      home.goalsAgainst += score.away;
      away.goalsFor += score.away;
      away.goalsAgainst += score.home;
      if (score.home > score.away) {
        home.points += WIN_POINTS;
      } else if (score.away > score.home) {
        away.points += WIN_POINTS;
      } else {
        home.points += DRAW_POINTS;
        away.points += DRAW_POINTS;
      }
    }

    for (const row of bucket) {
      const pair = stats.get(row.teamId)!;
      row.headToHeadPoints = pair.points;
      row.headToHeadGoalDifference = pair.goalsFor - pair.goalsAgainst;
    }
  };

  const seededDraws: SeededStandingDraw[] = [];
  const sorted: FootballStandingRow[] = [];
  const byPoints = [...rows.values()].sort(
    (a, b) => b.points - a.points || a.teamName.localeCompare(b.teamName),
  );

  let index = 0;
  while (index < byPoints.length) {
    let end = index + 1;
    while (end < byPoints.length && byPoints[end]!.points === byPoints[index]!.points) {
      end += 1;
    }

    const bucket = byPoints.slice(index, end);
    if (bucket.length === 1) {
      sorted.push(bucket[0]!);
      index = end;
      continue;
    }

    headToHead(bucket);
    const ordered = [...bucket].sort((a, b) => {
      const criteria =
        b.headToHeadPoints - a.headToHeadPoints ||
        b.headToHeadGoalDifference - a.headToHeadGoalDifference ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor;
      if (criteria !== 0) {
        return criteria;
      }
      return (
        seededTieBreakKey(drawSeed, a.teamId) -
          seededTieBreakKey(drawSeed, b.teamId) ||
        a.teamId.localeCompare(b.teamId)
      );
    });

    // A bucket whose first three criteria are identical is separated by the
    // seeded draw. Record it so the public table can explain the resolution.
    const unresolved = ordered.filter((row, position) => {
      if (position === 0) {
        return false;
      }
      const previous = ordered[position - 1]!;
      return (
        previous.headToHeadPoints === row.headToHeadPoints &&
        previous.headToHeadGoalDifference === row.headToHeadGoalDifference &&
        previous.goalDifference === row.goalDifference &&
        previous.goalsFor === row.goalsFor
      );
    });
    if (unresolved.length) {
      const seededTeams = new Set<string>();
      for (let position = 0; position < ordered.length; position += 1) {
        const row = ordered[position]!;
        const previous = ordered[position - 1];
        if (
          !previous ||
          (previous.headToHeadPoints === row.headToHeadPoints &&
            previous.headToHeadGoalDifference ===
              row.headToHeadGoalDifference &&
            previous.goalDifference === row.goalDifference &&
            previous.goalsFor === row.goalsFor)
        ) {
          seededTeams.add(row.teamId);
          if (previous) {
            seededTeams.add(previous.teamId);
          }
        }
      }
      const seededRows = ordered.filter((row) => seededTeams.has(row.teamId));
      seededDraws.push({
        teamIds: seededRows.map((row) => row.teamId),
        teamNames: seededRows.map((row) => row.teamName),
      });
    }

    sorted.push(...ordered);
    index = end;
  }

  return { rows: sorted, seededDraws };
}
