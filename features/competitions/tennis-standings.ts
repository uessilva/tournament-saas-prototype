import type { SetScore } from "../public/types";

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
};

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
};

/**
 * Provisional tennis standings for the foundation demo.
 * 2 points per win; ties break on wins, set difference, game difference, then name.
 */
export function calculateTennisStandings(
  teams: TennisStandingTeam[],
  matches: TennisStandingMatch[],
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
    });
  }

  for (const match of matches) {
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away) {
      continue;
    }

    home.played += 1;
    away.played += 1;

    if (match.isWalkover) {
      if (match.winnerTeamId === home.teamId) {
        home.wins += 1;
        home.points += 2;
        away.losses += 1;
      } else {
        away.wins += 1;
        away.points += 2;
        home.losses += 1;
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
      } else {
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

  return [...rows.values()]
    .map((row) => ({
      ...row,
      setDifference: row.setsWon - row.setsLost,
      gameDifference: row.gamesWon - row.gamesLost,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.setDifference - a.setDifference ||
        b.gameDifference - a.gameDifference ||
        a.teamName.localeCompare(b.teamName),
    );
}
