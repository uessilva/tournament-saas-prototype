import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { competitions, events, matches, teamManagers, teams } from "@/lib/db/schema";
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

export type ManagerFixturesData = {
  teams: ManagerFixtureTeam[];
  fixtures: PublicMatch[];
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
    return { teams: [], fixtures: [] };
  }

  const rows = await publicMatchQueryForTeams(
    teamRows.map((team) => team.id),
  ).orderBy(
    sql`${matches.startsAt} asc nulls last`,
    asc(matches.matchNumber),
  );

  return {
    teams: teamRows,
    fixtures: rows.map(mapPublicMatch).filter((match) => !match.isBye),
  };
}
