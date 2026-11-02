export type AdminCompetition = {
  id: string;
  name: string;
  slug: string;
  sport: "football" | "tennis";
  format: string;
  status: string;
  registrationState: string;
  teamCount: number;
  participantCount: number;
  matchCount: number;
  publishedCount: number;
  sortOrder: number;
};

export type ChecklistItem = {
  key: string;
  labelKey: string;
  state: "done" | "current" | "next";
  detail?: string;
};

export type AdminEventData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locationLabel: string | null;
    startsAt: string;
    endsAt: string;
  };
  competitions: AdminCompetition[];
  metrics: {
    teams: number;
    participants: number;
    pendingInvitations: number;
    venues: number;
    matches: number;
    publishedResults: number;
  };
  checklist: ChecklistItem[];
  managers: {
    accepted: number;
    total: number;
  };
};
