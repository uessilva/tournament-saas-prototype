export type Sport = "football" | "tennis";

export type SetScore = {
  home: number;
  away: number;
  tiebreakHome?: number;
  tiebreakAway?: number;
};

export type PublicMatch = {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: Sport;
  groupId: string | null;
  roundLabel: string | null;
  startsAt: string | null;
  status: string;
  venueName: string | null;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
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
