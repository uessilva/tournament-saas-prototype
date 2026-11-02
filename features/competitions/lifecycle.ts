export const COMPETITION_STATUSES = [
  "setup",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const MATCH_RESTORE_STATUSES = [
  "scheduled",
  "awaiting_result",
  "in_review",
] as const;

export type MatchRestoreStatus = (typeof MATCH_RESTORE_STATUSES)[number];

export function isCompetitionCancelled(status: string | null | undefined) {
  return status === "cancelled";
}

export function isMatchCancelled(status: string | null | undefined) {
  return status === "cancelled";
}

export function isMatchCancellable(match: {
  status: string;
  isBye: boolean;
  hasCurrentResult: boolean;
}) {
  return (
    !match.isBye &&
    !match.hasCurrentResult &&
    match.status !== "published" &&
    match.status !== "cancelled"
  );
}

export function restoreMatchStatus(
  previousStatus: unknown,
  fallback: MatchRestoreStatus,
): MatchRestoreStatus {
  return MATCH_RESTORE_STATUSES.includes(previousStatus as MatchRestoreStatus)
    ? (previousStatus as MatchRestoreStatus)
    : fallback;
}

export function fallbackMatchRestoreStatus(input: {
  hasActiveScoresheet: boolean;
  hasAnyScoresheet: boolean;
}): MatchRestoreStatus {
  if (input.hasActiveScoresheet) {
    return "in_review";
  }
  if (input.hasAnyScoresheet) {
    return "awaiting_result";
  }
  return "scheduled";
}

export function restoreCompetitionStatus(
  previousStatus: unknown,
  fallback: CompetitionStatus,
): CompetitionStatus {
  return COMPETITION_STATUSES.includes(previousStatus as CompetitionStatus) &&
    previousStatus !== "cancelled"
    ? (previousStatus as CompetitionStatus)
    : fallback;
}
