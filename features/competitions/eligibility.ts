export type EntrantRosterStatus =
  | "ok"
  | "empty"
  | "below_min"
  | "above_max"
  | "birth_range";

export type EntrantEligibilityInput = {
  participantCount: number;
  dateOfBirths: string[];
  birthDateFrom: string | null;
  birthDateTo: string | null;
  rosterMin: number | null;
  rosterMax: number | null;
};

export function getEntrantRosterStatus({
  participantCount,
  dateOfBirths,
  birthDateFrom,
  birthDateTo,
  rosterMin,
  rosterMax,
}: EntrantEligibilityInput): EntrantRosterStatus {
  if (participantCount === 0) {
    return "empty";
  }
  if (rosterMin != null && participantCount < rosterMin) {
    return "below_min";
  }
  if (rosterMax != null && participantCount > rosterMax) {
    return "above_max";
  }

  const birthRangeOk = dateOfBirths.every((dateOfBirth) => {
    if (birthDateFrom && dateOfBirth < birthDateFrom) {
      return false;
    }
    if (birthDateTo && dateOfBirth > birthDateTo) {
      return false;
    }
    return true;
  });

  return birthRangeOk ? "ok" : "birth_range";
}
