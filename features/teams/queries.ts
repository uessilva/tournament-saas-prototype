import { asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  participants,
  teamManagers,
  teams,
  users,
} from "@/lib/db/schema";
import type { TeamRosterData } from "@/features/teams/types";

export async function getTeamRoster(
  teamId: string,
): Promise<TeamRosterData | null> {
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      registrationState: competitions.registrationState,
      rosterMin: competitions.rosterMin,
      rosterMax: competitions.rosterMax,
      birthDateFrom: competitions.birthDateFrom,
      birthDateTo: competitions.birthDateTo,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
    })
    .from(teams)
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .innerJoin(events, eq(competitions.eventId, events.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    return null;
  }

  const roster = await db
    .select({
      id: participants.id,
      firstName: participants.firstName,
      lastName: participants.lastName,
      dateOfBirth: participants.dateOfBirth,
      shirtNumber: participants.shirtNumber,
      position: participants.position,
      isCaptain: participants.isCaptain,
    })
    .from(participants)
    .where(eq(participants.teamId, teamId))
    .orderBy(asc(participants.shirtNumber), asc(participants.firstName));

  const managerRows = await db
    .select({ name: users.name, email: users.email })
    .from(teamManagers)
    .innerJoin(users, eq(teamManagers.userId, users.id))
    .where(eq(teamManagers.teamId, teamId))
    .orderBy(asc(users.name));

  const count = roster.length;
  const withinSize =
    (team.rosterMin == null || count >= team.rosterMin) &&
    (team.rosterMax == null || count <= team.rosterMax);
  const withinBirthDates = roster.every((participant) => {
    if (team.birthDateFrom && participant.dateOfBirth < team.birthDateFrom) {
      return false;
    }
    if (team.birthDateTo && participant.dateOfBirth > team.birthDateTo) {
      return false;
    }
    return true;
  });

  return {
    team: {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
    },
    competition: {
      id: team.competitionId,
      name: team.competitionName,
      slug: team.competitionSlug,
      sport: team.sport,
      registrationState: team.registrationState,
      rosterMin: team.rosterMin,
      rosterMax: team.rosterMax,
      birthDateFrom: team.birthDateFrom,
      birthDateTo: team.birthDateTo,
    },
    event: {
      id: team.eventId,
      name: team.eventName,
      slug: team.eventSlug,
    },
    managers: managerRows
      .map((manager) => manager.name ?? manager.email)
      .filter(Boolean),
    participants: roster,
    eligibilityOk: withinSize && withinBirthDates,
  };
}
