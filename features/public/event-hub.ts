import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  ne,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  matches,
  participantStatistics,
  participants,
  resultVersions,
  teams,
  venues,
} from "@/lib/db/schema";
import { mapPublicMatch, publicMatchQuery } from "@/features/public/matches";
import type {
  CompetitionSummary,
  EventHubData,
  LeaderRow,
  Sport,
} from "@/features/public/types";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

async function leaderRows(
  eventId: string,
  sport: Sport,
  column: AnyPgColumn,
): Promise<LeaderRow[]> {
  const rows = await db
    .select({
      participantId: participants.id,
      firstName: participants.firstName,
      lastName: participants.lastName,
      teamName: teams.name,
      total: sql<number>`coalesce(sum(${column}), 0)::int`,
    })
    .from(participantStatistics)
    .innerJoin(
      resultVersions,
      and(
        eq(participantStatistics.resultVersionId, resultVersions.id),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .innerJoin(
      participants,
      eq(participantStatistics.participantId, participants.id),
    )
    .innerJoin(teams, eq(participantStatistics.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(
      and(
        eq(competitions.eventId, eventId),
        eq(competitions.sport, sport),
        gt(column, 0),
      ),
    )
    .groupBy(
      participants.id,
      participants.firstName,
      participants.lastName,
      teams.name,
    )
    .orderBy(desc(sql`sum(${column})`), asc(participants.firstName))
    .limit(5);

  return rows.map((row) => ({
    participantId: row.participantId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    teamName: row.teamName,
    total: row.total,
  }));
}

export async function getEventHubBySlug(
  slug: string,
): Promise<EventHubData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.isPublished, true)))
    .limit(1);

  if (!event) {
    return null;
  }

  const competitionRows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      sport: competitions.sport,
      format: competitions.format,
      description: competitions.description,
      status: competitions.status,
      registrationState: competitions.registrationState,
      registrationDeadline: competitions.registrationDeadline,
      sortOrder: competitions.sortOrder,
      teamCount: sql<number>`count(distinct ${teams.id})::int`,
      participantCount: sql<number>`count(distinct ${participants.id})::int`,
      matchCount: sql<number>`count(distinct ${matches.id})::int`,
      publishedCount: sql<number>`count(distinct case when ${matches.status} = 'published' then ${matches.id} end)::int`,
    })
    .from(competitions)
    .leftJoin(teams, eq(teams.competitionId, competitions.id))
    .leftJoin(participants, eq(participants.teamId, teams.id))
    .leftJoin(matches, eq(matches.competitionId, competitions.id))
    .where(eq(competitions.eventId, event.id))
    .groupBy(
      competitions.id,
      competitions.name,
      competitions.slug,
      competitions.sport,
      competitions.format,
      competitions.description,
      competitions.status,
      competitions.registrationState,

      competitions.registrationDeadline,
      competitions.sortOrder,
    )
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const competitionSummaries: CompetitionSummary[] = competitionRows.map(
    (row) => ({
      ...row,
      registrationDeadline: toIso(row.registrationDeadline),
    }),
  );

  const recentRows = await publicMatchQuery()
    .where(
      and(
        eq(competitions.eventId, event.id),
        eq(matches.status, "published"),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`)
    .limit(6);

  const upcomingRows = await publicMatchQuery()
    .where(
      and(
        eq(competitions.eventId, event.id),
        inArray(matches.status, ["scheduled", "awaiting_result", "in_review"]),
        isNotNull(matches.startsAt),
        eq(matches.isBye, false),
        ne(competitions.status, "cancelled"),
      ),
    )
    .orderBy(asc(matches.startsAt))
    .limit(6);

  const venueRows = await db
    .select({ id: venues.id, name: venues.name })
    .from(venues)
    .where(eq(venues.eventId, event.id))
    .orderBy(asc(venues.sortOrder));

  const [aces, doubleFaults, goals, assists] = await Promise.all([
    leaderRows(event.id, "tennis", participantStatistics.aces),
    leaderRows(event.id, "tennis", participantStatistics.doubleFaults),
    leaderRows(event.id, "football", participantStatistics.goals),
    leaderRows(event.id, "football", participantStatistics.assists),
  ]);

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      tagline: event.tagline,
      description: event.description,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    },
    competitions: competitionSummaries,
    venues: venueRows,
    recentResults: recentRows.map(mapPublicMatch),
    upcoming: upcomingRows.map(mapPublicMatch),
    leaders: { aces, doubleFaults, goals, assists },
    stats: {
      competitions: competitionSummaries.length,
      entrants: competitionSummaries.reduce(
        (total, competition) => total + competition.teamCount,
        0,
      ),
      matches: competitionSummaries.reduce(
        (total, competition) => total + competition.matchCount,
        0,
      ),
      publishedResults: competitionSummaries.reduce(
        (total, competition) => total + competition.publishedCount,
        0,
      ),
      venues: venueRows.length,
    },
  };
}
