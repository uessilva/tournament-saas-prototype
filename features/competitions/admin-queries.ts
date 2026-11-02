import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  participants,
  teamManagers,
  teams,
  users,
} from "@/lib/db/schema";
import { utcToZonedDateTimeInput } from "@/lib/timezone";
import { getRegistrationStatus } from "@/features/competitions/registration";
import { getEntrantRosterStatus } from "@/features/competitions/eligibility";
import { getAdminDrawData } from "@/features/competitions/draw-queries";
import { loadCompetitionStandings } from "@/features/competitions/standings-queries";
import type {
  AdminCompetitionData,
  AdminCompetitionEntrant,
} from "@/features/competitions/types";

export async function getAdminCompetitionData(
  eventId: string,
  competitionId: string,
): Promise<AdminCompetitionData | null> {
  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(competitionId).success
  ) {
    return null;
  }

  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      timezone: events.timezone,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return null;
  }

  const [competition] = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.id, competitionId),
        eq(competitions.eventId, event.id),
      ),
    )
    .limit(1);

  if (!competition) {
    return null;
  }

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      seedPosition: teams.seedPosition,
    })
    .from(teams)
    .where(eq(teams.competitionId, competition.id))
    .orderBy(asc(teams.seedPosition), asc(teams.name));

  const teamIds = teamRows.map((team) => team.id);
  const participantRows = await db
    .select({
      teamId: participants.teamId,
      dateOfBirth: participants.dateOfBirth,
    })
    .from(participants)
    .where(eq(participants.competitionId, competition.id));

  const managerRows = teamIds.length
    ? await db
        .select({
          teamId: teamManagers.teamId,
          name: users.name,
          email: users.email,
        })
        .from(teamManagers)
        .innerJoin(users, eq(teamManagers.userId, users.id))
        .where(inArray(teamManagers.teamId, teamIds))
        .orderBy(asc(users.name))
    : [];

  const managersByTeam = new Map<string, string[]>();
  for (const manager of managerRows) {
    const list = managersByTeam.get(manager.teamId) ?? [];
    list.push(manager.name ?? manager.email);
    managersByTeam.set(manager.teamId, list);
  }

  const participantsByTeam = new Map<string, string[]>();
  for (const participant of participantRows) {
    const list = participantsByTeam.get(participant.teamId) ?? [];
    list.push(participant.dateOfBirth);
    participantsByTeam.set(participant.teamId, list);
  }

  const entrants: AdminCompetitionEntrant[] = teamRows.map((team) => {
    const birthDates = participantsByTeam.get(team.id) ?? [];
    const participantCount = birthDates.length;

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      participantCount,
      managerNames: managersByTeam.get(team.id) ?? [],
      rosterStatus: getEntrantRosterStatus({
        participantCount,
        dateOfBirths: birthDates,
        birthDateFrom: competition.birthDateFrom,
        birthDateTo: competition.birthDateTo,
        rosterMin: competition.rosterMin,
        rosterMax: competition.rosterMax,
      }),
    };
  });

  const registration = getRegistrationStatus(competition);
  const eligibleEntrantCount = entrants.filter(
    (entrant) => entrant.rosterStatus === "ok",
  ).length;
  const draw = await getAdminDrawData({
    competition,
    entrants: teamRows.map((team, index) => ({
      id: team.id,
      name: team.name,
      seedPosition: team.seedPosition ?? index + 1,
    })),
    eligibleEntrantCount,
  });
  const standings = competition.drawGeneratedAt
    ? await loadCompetitionStandings(competition)
    : [];

  return {
    event,
    competition: {
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      sport: competition.sport,
      format: competition.format,
      description: competition.description,
      eligibilityNotes: competition.eligibilityNotes,
      birthDateFrom: competition.birthDateFrom,
      birthDateTo: competition.birthDateTo,
      rosterMin: competition.rosterMin,
      rosterMax: competition.rosterMax,
      registrationState: competition.registrationState,
      registrationOpen: registration.open,
      registrationClosedByDeadline: registration.closedByDeadline,
      deadlinePassed: registration.deadlinePassed,
      registrationDeadline: competition.registrationDeadline?.toISOString() ?? null,
      registrationDeadlineInput: competition.registrationDeadline
        ? utcToZonedDateTimeInput(competition.registrationDeadline, event.timezone)
        : null,
      groupCount: competition.groupCount,
      qualifiersPerGroup: competition.qualifiersPerGroup,
      defaultMatchDurationMinutes: competition.defaultMatchDurationMinutes,
      drawSeed: competition.drawSeed,
      drawGeneratedAt: competition.drawGeneratedAt?.toISOString() ?? null,
      status: competition.status,
    },
    entrants,
    draw,
    standings,
    counts: {
      entrants: entrants.length,
      participants: participantRows.length,
      eligibleEntrants: eligibleEntrantCount,
    },
  };
}
