import type { TennisSetScore } from "@/lib/db/schema";

export type TennisResultInput = {
  sets: TennisSetScore[];
  isWalkover?: boolean;
  walkoverWinnerSide?: "home" | "away" | null;
  homeAces?: number | null;
  awayAces?: number | null;
  homeDoubleFaults?: number | null;
  awayDoubleFaults?: number | null;
  notes?: string | null;
};

export type TennisValidationContext = {
  stage: "group" | "knockout";
  homeTeamId: string;
  awayTeamId: string;
};

export type TennisValidationResult = {
  valid: boolean;
  errors: string[];
  winnerTeamId: string | null;
  /** Walkovers are normalised to the agreed 6–0, 6–0 standing score. */
  sets: TennisSetScore[];
  homeAces: number;
  awayAces: number;
  homeDoubleFaults: number;
  awayDoubleFaults: number;
};

export const TENNIS_WALKOVER_SETS: TennisSetScore[] = [
  { home: 6, away: 0 },
  { home: 6, away: 0 },
];

export function tennisWalkoverSets(winnerSide: "home" | "away"): TennisSetScore[] {
  return winnerSide === "home"
    ? TENNIS_WALKOVER_SETS.map((set) => ({ ...set }))
    : TENNIS_WALKOVER_SETS.map((set) => ({ home: set.away, away: set.home }));
}

const MAX_TIEBREAK_POINTS = 30;
const MAX_STAT_VALUE = 100;

function integerInRange(value: number | null | undefined, max: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

function statValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : 0;
}

function tiebreakValid(
  set: TennisSetScore,
  winner: "home" | "away",
  errors: string[],
  index: number,
) {
  const home = set.tiebreakHome;
  const away = set.tiebreakAway;

  if (
    !integerInRange(home, MAX_TIEBREAK_POINTS) ||
    !integerInRange(away, MAX_TIEBREAK_POINTS)
  ) {
    errors.push(`set_${index + 1}_tiebreak_required`);
    return;
  }

  const winnerScore = winner === "home" ? home! : away!;
  const loserScore = winner === "home" ? away! : home!;

  if (winnerScore < 7 || winnerScore - loserScore < 2) {
    errors.push(`set_${index + 1}_tiebreak_invalid`);
  }
}

type SetWinner = "home" | "away" | null;

function validateSet(
  set: TennisSetScore,
  index: number,
  errors: string[],
): SetWinner {
  const home = set.home;
  const away = set.away;
  const label = `set_${index + 1}`;

  if (
    !Number.isInteger(home) ||
    !Number.isInteger(away) ||
    home < 0 ||
    away < 0 ||
    home > 7 ||
    away > 7
  ) {
    errors.push(`${label}_invalid_games`);
    return null;
  }

  let winner: SetWinner = null;

  if (home === 6 && away <= 4) {
    winner = "home";
  } else if (away === 6 && home <= 4) {
    winner = "away";
  } else if (home === 7 && away === 5) {
    winner = "home";
  } else if (away === 7 && home === 5) {
    winner = "away";
  } else if (home === 7 && away === 6) {
    winner = "home";
    tiebreakValid(set, "home", errors, index);
  } else if (away === 7 && home === 6) {
    winner = "away";
    tiebreakValid(set, "away", errors, index);
  } else if (home === 6 && away === 6) {
    errors.push(`${label}_tiebreak_required`);
  } else {
    errors.push(`${label}_invalid_score`);
  }

  return winner;
}

/**
 * Validates a tennis result entered by the Owner or extracted from a
 * Scoresheet. Only best-of-three standard tie-break sets are accepted, the
 * third set is always a full set, and the winner is derived from set wins.
 */
export function validateTennisResult(
  input: TennisResultInput,
  context: TennisValidationContext,
): TennisValidationResult {
  const errors: string[] = [];
  const isWalkover = Boolean(input.isWalkover);
  const homeAces = statValue(input.homeAces);
  const awayAces = statValue(input.awayAces);
  const homeDoubleFaults = statValue(input.homeDoubleFaults);
  const awayDoubleFaults = statValue(input.awayDoubleFaults);

  if (
    input.homeAces != null &&
    !integerInRange(input.homeAces, MAX_STAT_VALUE)
  ) {
    errors.push("invalid_home_aces");
  }
  if (
    input.awayAces != null &&
    !integerInRange(input.awayAces, MAX_STAT_VALUE)
  ) {
    errors.push("invalid_away_aces");
  }
  if (
    input.homeDoubleFaults != null &&
    !integerInRange(input.homeDoubleFaults, MAX_STAT_VALUE)
  ) {
    errors.push("invalid_home_double_faults");
  }
  if (
    input.awayDoubleFaults != null &&
    !integerInRange(input.awayDoubleFaults, MAX_STAT_VALUE)
  ) {
    errors.push("invalid_away_double_faults");
  }

  if (isWalkover) {
    if (input.walkoverWinnerSide !== "home" && input.walkoverWinnerSide !== "away") {
      errors.push("walkover_winner_required");
    }

    const winnerTeamId =
      input.walkoverWinnerSide === "home"
        ? context.homeTeamId
        : input.walkoverWinnerSide === "away"
          ? context.awayTeamId
          : null;

    return {
      valid: errors.length === 0,
      errors,
      winnerTeamId,
      sets:
        input.walkoverWinnerSide === "home" || input.walkoverWinnerSide === "away"
          ? tennisWalkoverSets(input.walkoverWinnerSide)
          : [],
      homeAces: 0,
      awayAces: 0,
      homeDoubleFaults: 0,
      awayDoubleFaults: 0,
    };
  }

  if (input.sets.length !== 2 && input.sets.length !== 3) {
    errors.push("tennis_sets_required");
  }

  const setWinners = input.sets.map((set, index) =>
    validateSet(set, index, errors),
  );

  let winnerTeamId: string | null = null;

  if (setWinners.length === 2) {
    if (setWinners[0] && setWinners[1] && setWinners[0] !== setWinners[1]) {
      errors.push("third_set_required");
    } else if (setWinners[0] && setWinners[0] === setWinners[1]) {
      winnerTeamId =
        setWinners[0] === "home" ? context.homeTeamId : context.awayTeamId;
    }
  } else if (setWinners.length === 3) {
    if (setWinners[0] && setWinners[1] && setWinners[0] === setWinners[1]) {
      errors.push("unnecessary_third_set");
    } else if (setWinners[2]) {
      winnerTeamId =
        setWinners[2] === "home" ? context.homeTeamId : context.awayTeamId;
    }
  }

  if (!winnerTeamId && !errors.length) {
    errors.push("tennis_winner_undetermined");
  }

  return {
    valid: errors.length === 0,
    errors,
    winnerTeamId,
    sets: input.sets,
    homeAces,
    awayAces,
    homeDoubleFaults,
    awayDoubleFaults,
  };
}

export function tennisSetCounts(sets: TennisSetScore[]) {
  let home = 0;
  let away = 0;
  for (const set of sets) {
    if (set.home > set.away) {
      home += 1;
    } else if (set.away > set.home) {
      away += 1;
    }
  }
  return { home, away };
}
