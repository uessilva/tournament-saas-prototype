import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
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
} from "@/lib/db/schema";
import type {
  LeaderRow,
  LeadersPageData,
  Sport,
} from "@/features/public/types";

export async function leaderRows(
  eventId: string,
  sport: Sport,
  column: AnyPgColumn,
  {
    limit = 5,
    competitionId,
  }: { limit?: number; competitionId?: string | null } = {},
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
      matches,
      and(
        eq(participantStatistics.matchId, matches.id),
        ne(matches.status, "cancelled"),
        isNull(matches.cancelledAt),
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
        competitionId ? eq(competitions.id, competitionId) : undefined,
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
    .limit(limit);

  return rows.map((row) => ({
    participantId: row.participantId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    teamName: row.teamName,
    total: row.total,
  }));
}

export async function getLeadersPage(
  eventSlug: string,
  competitionSlug?: string | null,
): Promise<LeadersPageData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, eventSlug), eq(events.isPublished, true)))
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
    })
    .from(competitions)
    .where(eq(competitions.eventId, event.id))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const active = competitionSlug
    ? (competitionRows.find(
        (competition) => competition.slug === competitionSlug,
      ) ?? null)
    : null;

  const competitionId = active?.id ?? null;
  const [goals, assists, aces, doubleFaults] = await Promise.all([
    leaderRows(event.id, "football", participantStatistics.goals, {
      limit: 12,
      competitionId,
    }),
    leaderRows(event.id, "football", participantStatistics.assists, {
      limit: 12,
      competitionId,
    }),
    leaderRows(event.id, "tennis", participantStatistics.aces, {
      limit: 12,
      competitionId,
    }),
    leaderRows(event.id, "tennis", participantStatistics.doubleFaults, {
      limit: 12,
      competitionId,
    }),
  ]);

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
    },
    competitions: competitionRows,
    activeCompetitionSlug: active?.slug ?? null,
    leaders: { goals, assists, aces, doubleFaults },
  };
}
