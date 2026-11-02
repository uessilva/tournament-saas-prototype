import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db/client";
import { competitions, events, matches, venues } from "@/lib/db/schema";
import { getSupportedTimeZones, utcToZonedDateTimeInput } from "@/lib/timezone";
import {
  mapPublicMatch,
  publicMatchQuery,
} from "@/features/public/matches";
import type {
  ScheduleCompetition,
  ScheduleMatch,
  ScheduleVenue,
  ScheduleWorkspaceData,
} from "@/features/matches/types";

export async function getScheduleWorkspace(
  eventId: string,
): Promise<ScheduleWorkspaceData | null> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return null;
  }

  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.id, eventId))
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
      defaultMatchDurationMinutes: competitions.defaultMatchDurationMinutes,
      sortOrder: competitions.sortOrder,
      matchCount: sql<number>`count(${matches.id})::int`,
      scheduledCount: sql<number>`count(${matches.startsAt})::int`,
    })
    .from(competitions)
    .leftJoin(
      matches,
      and(eq(matches.competitionId, competitions.id), eq(matches.isBye, false)),
    )
    .where(eq(competitions.eventId, event.id))
    .groupBy(
      competitions.id,
      competitions.name,
      competitions.slug,
      competitions.sport,
      competitions.defaultMatchDurationMinutes,
      competitions.sortOrder,
    )
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const venueRows: ScheduleVenue[] = await db
    .select({ id: venues.id, name: venues.name })
    .from(venues)
    .where(eq(venues.eventId, event.id))
    .orderBy(asc(venues.sortOrder), asc(venues.name));

  const rows = await publicMatchQuery()
    .where(
      and(eq(competitions.eventId, event.id), eq(matches.isBye, false)),
    )
    .orderBy(
      sql`${matches.startsAt} asc nulls last`,
      asc(competitions.sortOrder),
      asc(matches.matchNumber),
    );

  const scheduleMatches: ScheduleMatch[] = rows.map((row) => {
    const match = mapPublicMatch(row);
    return {
      ...match,
      startsAtInput: match.startsAt
        ? utcToZonedDateTimeInput(new Date(match.startsAt), event.timezone)
        : null,
    };
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
    },
    competitions: competitionRows.map(
      (competition): ScheduleCompetition => ({
        id: competition.id,
        name: competition.name,
        slug: competition.slug,
        sport: competition.sport,
        defaultMatchDurationMinutes:
          competition.defaultMatchDurationMinutes,
        matchCount: competition.matchCount,
        scheduledCount: competition.scheduledCount,
      }),
    ),
    venues: venueRows,
    matches: scheduleMatches,
    timezones: getSupportedTimeZones(),
  };
}
