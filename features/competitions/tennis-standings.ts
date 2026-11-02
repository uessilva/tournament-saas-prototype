import type { SetScore } from "../public/types";
import { hashSeed } from "@/features/competitions/draw";

export type TennisStandingTeam = {
  teamId: string;
  teamName: string;
  seedPosition: number;
};

export type TennisStandingMatch = {
  homeTeamId: string;
  awayTeamId: string;
  winnerTeamId: string | null;
  sets: SetScore[] | null;
  isWalkover: boolean;
  isCancelled?: boolean;
};

export type TennisTiebreakReason =
  | "head_to_head"
  | "set_difference"
  | "game_difference"
  | "seeded_draw";

export type TennisStandingRow = {
  teamId: string;
  teamName: string;
  seedPosition: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  gamesWon: number;
  gamesLost: number;
  gameDifference: number;
  points: number;
  /** Why this entrant ranked above the next entrant with the same points. */
  tiebreakReason: TennisTiebreakReason | null;
  seededDrawKey: string;
};

/**
 * Tennis group standings: 2 points for a win, 0 for a loss.
 *
 * Ties break by head-to-head when exactly two entrants are level on points,
 * then set difference, game difference, and finally a reproducible seeded
 * draw. The draw key is derived from the competition seed and entrant id, so
 * the same draw always produces the same visible order.
 */
export function calculateTennisStandings(
  teams: TennisStandingTeam[],
  matches: TennisStandingMatch[],
  seed = "",
): TennisStandingRow[] {
  const rows = new Map<string, TennisStandingRow>();

  for (const team of teams) {
    rows.set(team.teamId, {
      teamId: team.teamId,
      teamName: team.teamName,
      seedPosition: team.seedPosition,
      played: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDifference: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDifference: 0,
      points: 0,
      tiebreakReason: null,
      seededDrawKey: `${hashSeed(`${seed}:${team.teamId}`)
        .toString(16)
        .padStart(8, "0")}:${team.teamId}`,
    });
  }

  for (const match of matches) {
    if (match.isCancelled) {
      continue;
    }
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away || !match.winnerTeamId) {
      continue;
    }

    home.played += 1;
    away.played += 1;

    if (match.isWalkover) {
      if (match.winnerTeamId === home.teamId) {
        home.wins += 1;
        home.points += 2;
        away.losses += 1;
        home.setsWon += 2;
        away.setsLost += 2;
        home.gamesWon += 12;
        away.gamesLost += 12;
      } else {
        away.wins += 1;
        away.points += 2;
        home.losses += 1;
        away.setsWon += 2;
        home.setsLost += 2;
        away.gamesWon += 12;
        home.gamesLost += 12;
      }
      continue;
    }

    for (const set of match.sets ?? []) {
      home.gamesWon += set.home;
      home.gamesLost += set.away;
      away.gamesWon += set.away;
      away.gamesLost += set.home;

      if (set.home > set.away) {
        home.setsWon += 1;
        away.setsLost += 1;
      } else if (set.away > set.home) {
        away.setsWon += 1;
        home.setsLost += 1;
      }
    }

    if (match.winnerTeamId === home.teamId) {
      home.wins += 1;
      home.points += 2;
      away.losses += 1;
    } else if (match.winnerTeamId === away.teamId) {
      away.wins += 1;
      away.points += 2;
      home.losses += 1;
    }
  }

  const results = [...rows.values()].map((row) => ({
    ...row,
    setDifference: row.setsWon - row.setsLost,
    gameDifference: row.gamesWon - row.gamesLost,
  }));

  const byPoints = new Map<number, TennisStandingRow[]>();
  for (const row of results) {
    const group = byPoints.get(row.points) ?? [];
    group.push(row);
    byPoints.set(row.points, group);
  }

  const ordered: TennisStandingRow[] = [];
  for (const points of [...byPoints.keys()].sort((a, b) => b - a)) {
    const group = byPoints.get(points)!;
    const twoWay = group.length === 2;
    const headToHead = twoWay
      ? headToHeadPoints(group[0]!, group[1]!, matches)
      : 0;
    const headToHeadWinnerId =
      headToHead === 0
        ? null
        : headToHead > 0
          ? group[0]!.teamId
          : group[1]!.teamId;

    group.sort((a, b) => {
      if (headToHeadWinnerId) {
        if (a.teamId === headToHeadWinnerId) return -1;
        if (b.teamId === headToHeadWinnerId) return 1;
      }
      return (
        b.setDifference - a.setDifference ||
        b.gameDifference - a.gameDifference ||
        a.seededDrawKey.localeCompare(b.seededDrawKey)
      );
    });

    for (let index = 0; index < group.length; index += 1) {
      const row = group[index]!;
      const next = group[index + 1];
      if (!next) {
        continue;
      }
      if (twoWay && headToHead !== 0) {
        row.tiebreakReason = "head_to_head";
      } else if (row.setDifference !== next.setDifference) {
        row.tiebreakReason = "set_difference";
      } else if (row.gameDifference !== next.gameDifference) {
        row.tiebreakReason = "game_difference";
      } else {
        row.tiebreakReason = "seeded_draw";
      }
    }

    ordered.push(...group);
  }

  return ordered;
}

/**
 * Returns the head-to-head points difference for the first entrant relative to
 * the second. Positive means the first entrant won the direct encounter(s).
 */
function headToHeadPoints(
  first: TennisStandingRow,
  second: TennisStandingRow,
  matches: TennisStandingMatch[],
) {
  let firstPoints = 0;
  let secondPoints = 0;

  for (const match of matches) {
    if (match.isCancelled || !match.winnerTeamId) {
      continue;
    }
    const pair =
      (match.homeTeamId === first.teamId &&
        match.awayTeamId === second.teamId) ||
      (match.homeTeamId === second.teamId &&
        match.awayTeamId === first.teamId);
    if (!pair) {
      continue;
    }
    if (match.winnerTeamId === first.teamId) {
      firstPoints += 2;
    } else if (match.winnerTeamId === second.teamId) {
      secondPoints += 2;
    }
  }

  return firstPoints - secondPoints;
}
