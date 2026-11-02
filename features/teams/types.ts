export type ManagedTeam = {
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: "football" | "tennis";
  competitionStatus: string;
  registrationState: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventTimezone: string;
};

export type RosterParticipant = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  shirtNumber: number | null;
  position: string | null;
  isCaptain: boolean;
};

export type TeamRosterData = {
  team: {
    id: string;
    name: string;
    shortName: string | null;
  };
  competition: {
    id: string;
    name: string;
    slug: string;
    sport: "football" | "tennis";
    registrationState: string;
    rosterMin: number | null;
    rosterMax: number | null;
    birthDateFrom: string | null;
    birthDateTo: string | null;
  };
  event: {
    id: string;
    name: string;
    slug: string;
  };
  managers: string[];
  participants: RosterParticipant[];
  eligibilityOk: boolean;
};
