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
    registrationOpen: boolean;
    registrationClosedByDeadline: boolean;
    registrationDeadline: string | null;
    drawGeneratedAt: string | null;
    rosterMin: number | null;
    rosterMax: number | null;
    birthDateFrom: string | null;
    birthDateTo: string | null;
  };
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  managers: string[];
  participants: RosterParticipant[];
  eligibilityOk: boolean;
};

export type InvitationKind = "email" | "link";

export type InvitationStatus =
  | "pending"
  | "active"
  | "accepted"
  | "revoked"
  | "expired";

export type AccessTeamRef = {
  id: string;
  name: string;
  sport: "football" | "tennis";
  competitionName: string;
};

export type EventTeamAccess = {
  id: string;
  name: string;
  shortName: string | null;
  sport: "football" | "tennis";
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  participantCount: number;
  managers: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
};

export type EventInvitation = {
  id: string;
  kind: InvitationKind;
  email: string | null;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  lastSentAt: string | null;
  createdByName: string | null;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  teams: AccessTeamRef[];
};

export type AccessHistoryEntry = {
  id: string;
  type: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  subjectName: string | null;
  subjectEmail: string | null;
  teamName: string | null;
  invitationKind: InvitationKind | null;
  invitationEmail: string | null;
  teams: string[];
};

export type EventAccessData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  teams: EventTeamAccess[];
  invitations: EventInvitation[];
  history: AccessHistoryEntry[];
  counts: {
    teams: number;
    managers: number;
    pendingEmailInvitations: number;
    activeLinks: number;
  };
};

export type InvitationView = {
  id: string;
  kind: InvitationKind;
  email: string | null;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdByName: string | null;
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  teams: AccessTeamRef[];
};
