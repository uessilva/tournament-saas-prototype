import type { TennisStandingRow } from "@/features/competitions/tennis-standings";
import type { DrawValidationError } from "@/features/competitions/draw";
import type {
  PublicMatch,
  PublicMatchSource,
  Sport,
} from "@/features/public/types";

export type CompetitionEntrant = {
  id: string;
  name: string;
  shortName: string | null;
  participantCount: number;
};

export type CompetitionGroup = {
  id: string;
  name: string;
  standings: TennisStandingRow[];
};

export type AdminCompetitionEntrant = {
  id: string;
  name: string;
  shortName: string | null;
  participantCount: number;
  managerNames: string[];
  rosterStatus: "ok" | "empty" | "below_min" | "above_max" | "birth_range";
};

export type DrawSideView = {
  teamId: string | null;
  teamName: string | null;
  source: PublicMatchSource | null;
};

export type DrawGroupView = {
  id: string | null;
  name: string;
  qualifiers: number;
  entrants: Array<{
    teamId: string;
    name: string;
    seedPosition: number;
  }>;
};

export type DrawFixtureView = {
  id: string | null;
  matchNumber: number | null;
  stage: "group" | "knockout";
  groupName: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  isBye: boolean;
  home: DrawSideView;
  away: DrawSideView;
  status: string;
  startsAt: string | null;
  venueName: string | null;
};

export type AdminDrawData = {
  generated: boolean;
  canEdit: boolean;
  confirmedResultExists: boolean;
  seed: string;
  groupCount: number;
  qualifiersPerGroup: number;
  bracketSize: number;
  knockoutRoundCount: number;
  validationErrors: DrawValidationError[];
  groups: DrawGroupView[];
  groupFixtures: DrawFixtureView[];
  knockoutFixtures: DrawFixtureView[];
};

export type AdminCompetitionData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  competition: {
    id: string;
    name: string;
    slug: string;
    sport: Sport;
    format: string;
    description: string | null;
    eligibilityNotes: string | null;
    birthDateFrom: string | null;
    birthDateTo: string | null;
    rosterMin: number | null;
    rosterMax: number | null;
    registrationState: string;
    registrationOpen: boolean;
    registrationClosedByDeadline: boolean;
    deadlinePassed: boolean;
    registrationDeadline: string | null;
    registrationDeadlineInput: string | null;
    groupCount: number;
    qualifiersPerGroup: number;
    defaultMatchDurationMinutes: number;
    drawSeed: string | null;
    drawGeneratedAt: string | null;
    status: string;
  };
  entrants: AdminCompetitionEntrant[];
  draw: AdminDrawData;
  counts: {
    entrants: number;
    participants: number;
    eligibleEntrants: number;
  };
};

export type CompetitionPageData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locationLabel: string | null;
    competitions: Array<{ name: string; slug: string; sport: Sport }>;
  };
  competition: {
    id: string;
    name: string;
    slug: string;
    sport: Sport;
    format: string;
    description: string | null;
    eligibilityNotes: string | null;
    birthDateFrom: string | null;
    birthDateTo: string | null;
    rosterMin: number | null;
    rosterMax: number | null;
    registrationState: string;
    registrationDeadline: string | null;
    groupCount: number;
    qualifiersPerGroup: number;
    defaultMatchDurationMinutes: number;
    drawSeed: string | null;
    drawGeneratedAt: string | null;
    status: string;
    publicNote: string | null;
    cancelledAt: string | null;
  };
  venues: Array<{ id: string; name: string }>;
  entrants: CompetitionEntrant[];
  groups: CompetitionGroup[];
  results: PublicMatch[];
  upcoming: PublicMatch[];
  cancelled: PublicMatch[];
  stats: {
    matchCount: number;
    publishedCount: number;
  };
};
