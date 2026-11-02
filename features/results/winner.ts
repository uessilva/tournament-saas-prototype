export type FootballWinnerInput = {
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
  isWalkover: boolean;
  walkoverWinnerTeamId: string | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
};

/**
 * The single football winner derivation used by validation, advancement and
 * public score summaries. A shootout decides a drawn knockout Match; it never
 * changes the published scoreline.
 */
export function footballWinnerTeamId(
  input: FootballWinnerInput,
): string | null {
  if (input.isWalkover) {
    return input.walkoverWinnerTeamId;
  }

  if (
    input.penaltyHome != null &&
    input.penaltyAway != null &&
    input.penaltyHome !== input.penaltyAway
  ) {
    return input.penaltyHome > input.penaltyAway
      ? input.homeTeamId
      : input.awayTeamId;
  }

  if (input.homeScore == null || input.awayScore == null) {
    return null;
  }

  if (input.homeScore > input.awayScore) {
    return input.homeTeamId;
  }
  if (input.awayScore > input.homeScore) {
    return input.awayTeamId;
  }
  return null;
}
