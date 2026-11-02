export type Sport = "football" | "tennis";

export type SetScore = {
  home: number;
  away: number;
  tiebreakHome?: number;
  tiebreakAway?: number;
};

export type PublicMatchSource =
  | { type: "group_qualifier"; groupName: string; position: number }
  | { type: "match_winner"; roundNumber: number; bracketSlot: number }
  | { type: "bye" };

export type PublicMatch = {
  id: string;
  matchNumber: number;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: Sport;
  stage: "group" | "knockout";
  groupId: string | null;
  groupName: string | null;
  roundLabel: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  bracketSize: number;
  knockoutRoundCount: number;
  isBye: boolean;
  startsAt: string | null;
  /** Effective duration: the per-Match override or the Competition default. */
  durationMinutes: number | null;
  durationOverrideMinutes: number | null;
  status: string;
  venueId: string | null;
  venueName: string | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  homeSource: PublicMatchSource | null;
  awaySource: PublicMatchSource | null;
  homeScore: string | null;
  awayScore: string | null;
  scoreDetail: string | null;
  winnerTeamId: string | null;
  isWalkover: boolean;
  isCancelled: boolean;
  sets: SetScore[] | null;
};

export type CompetitionSummary = {
  id: string;
  name: string;
  slug: string;
  sport: Sport;
  format: string;
  description: string | null;
  status: string;
  publicNote: string | null;
  cancelledAt: string | null;
  registrationState: string;
  registrationDeadline: string | null;
  teamCount: number;
  participantCount: number;
  matchCount: number;
  publishedCount: number;
  sortOrder: number;
};

export type LeaderRow = {
  participantId: string;
  name: string;
  teamName: string;
  total: number;
};

export type EventHubData = {
  event: {
    id: string;
    name: string;
    slug: string;
    tagline: string | null;
    description: string | null;
    timezone: string;
    locationLabel: string | null;
    startsAt: string;
    endsAt: string;
  };
  competitions: CompetitionSummary[];
  venues: Array<{ id: string; name: string }>;
  recentResults: PublicMatch[];
  upcoming: PublicMatch[];
  leaders: {
    aces: LeaderRow[];
    doubleFaults: LeaderRow[];
    goals: LeaderRow[];
    assists: LeaderRow[];
  };
  stats: {
    competitions: number;
    entrants: number;
    matches: number;
    publishedResults: number;
    venues: number;
  };
};

export type FixturesPageData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    startsAt: string;
    locationLabel: string | null;
  };
  competitions: Array<{
    id: string;
    name: string;
    slug: string;
    sport: Sport;
    status: string;
    publicNote: string | null;
    matchCount: number;
  }>;
  activeCompetitionSlug: string | null;
  fixtures: PublicMatch[];
};

export type ResultsPageData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locationLabel: string | null;
  };
  competitions: Array<{
    id: string;
    name: string;
    slug: string;
    sport: Sport;
    status: string;
    publicNote: string | null;
    resultCount: number;
  }>;
  activeCompetitionSlug: string | null;
  results: PublicMatch[];
};
