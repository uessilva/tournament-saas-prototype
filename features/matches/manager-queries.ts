import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  matches,
  scoresheets,
  teamManagers,
  teams,
} from "@/lib/db/schema";
import {
  mapPublicMatch,
  publicMatchQueryForTeams,
} from "@/features/public/matches";
import type { PublicMatch } from "@/features/public/types";

export type ManagerFixtureTeam = {
  id: string;
  name: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: "football" | "tennis";
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventTimezone: string;
};

export type ManagerScoresheetSummary = {
  id: string;
  status: string;
  isActive: boolean;
  createdAt: string;
  extractionSource: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
};

export type ManagerFixturesData = {
  teams: ManagerFixtureTeam[];
  fixtures: PublicMatch[];
  scoresheetsByMatch: Record<string, ManagerScoresheetSummary[]>;
};

export async function getManagerFixtures(
  userId: string,
): Promise<ManagerFixturesData> {
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
      eventTimezone: events.timezone,
    })
    .from(teamManagers)
    .innerJoin(teams, eq(teamManagers.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .innerJoin(events, eq(competitions.eventId, events.id))
    .where(eq(teamManagers.userId, userId))
    .orderBy(asc(teams.name));

  if (!teamRows.length) {
    return { teams: [], fixtures: [], scoresheetsByMatch: {} };
  }

  const rows = await publicMatchQueryForTeams(
    teamRows.map((team) => team.id),
  ).orderBy(
    sql`${matches.startsAt} asc nulls last`,
    asc(matches.matchNumber),
  );

  const fixtures = rows.map(mapPublicMatch).filter((match) => !match.isBye);
  const matchIds = fixtures.map((match) => match.id);
  const sheetRows = matchIds.length
    ? await db
        .select({
          id: scoresheets.id,
          matchId: scoresheets.matchId,
          status: scoresheets.status,
          isActive: scoresheets.isActive,
          createdAt: scoresheets.createdAt,
          extractionSource: scoresheets.extractionSource,
          failureReason: scoresheets.failureReason,
          rejectionReason: scoresheets.rejectionReason,
        })
        .from(scoresheets)
        .where(inArray(scoresheets.matchId, matchIds))
        .orderBy(desc(scoresheets.createdAt))
    : [];

  const scoresheetsByMatch: Record<string, ManagerScoresheetSummary[]> = {};
  for (const sheet of sheetRows) {
    const list = scoresheetsByMatch[sheet.matchId] ?? [];
    list.push({
      id: sheet.id,
      status: sheet.status,
      isActive: sheet.isActive,
      createdAt: sheet.createdAt.toISOString(),
      extractionSource: sheet.extractionSource,
      failureReason: sheet.failureReason,
      rejectionReason: sheet.rejectionReason,
    });
    scoresheetsByMatch[sheet.matchId] = list;
  }

  return {
    teams: teamRows,
    fixtures,
    scoresheetsByMatch,
  };
}
