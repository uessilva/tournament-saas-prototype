import type { TennisStandingRow } from "@/features/competitions/tennis-standings";
import type { PublicMatch, Sport } from "@/features/public/types";

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
