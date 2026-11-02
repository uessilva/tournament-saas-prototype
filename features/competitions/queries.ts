import {
  and,
  asc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
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
import { getRegistrationStatus } from "@/features/competitions/registration";
import { loadCompetitionStandings } from "@/features/competitions/standings-queries";
import type { CompetitionPageData } from "@/features/competitions/types";
import type { LeaderRow, Sport } from "@/features/public/types";
import { mapPublicMatch, publicMatchQuery } from "@/features/public/matches";

async function competitionLeaders(
  competitionId: string,
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
    .innerJoin(matches, eq(participantStatistics.matchId, matches.id))
    .innerJoin(
      participants,
      eq(participantStatistics.participantId, participants.id),
    )
    .innerJoin(teams, eq(participantStatistics.teamId, teams.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        ne(matches.status, "cancelled"),
        isNull(matches.cancelledAt),
        gt(column, 0),
      ),
    )
    .groupBy(
      participants.id,
      participants.firstName,
      participants.lastName,
      teams.name,
    )
    .orderBy(sql`sum(${column}) desc`, asc(participants.firstName))
    .limit(5);

  return rows.map((row) => ({
    participantId: row.participantId,
    name: `${row.firstName} ${row.lastName}`.trim(),
    teamName: row.teamName,
    total: row.total,
  }));
}

async function getCompetitionLeaders(competitionId: string, sport: Sport) {
  const [aces, doubleFaults, goals, assists] = await Promise.all([
    competitionLeaders(competitionId, participantStatistics.aces),
    competitionLeaders(competitionId, participantStatistics.doubleFaults),
    sport === "football"
      ? competitionLeaders(competitionId, participantStatistics.goals)
      : Promise.resolve([]),
    sport === "football"
      ? competitionLeaders(competitionId, participantStatistics.assists)
      : Promise.resolve([]),
  ]);

  return { aces, doubleFaults, goals, assists };
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function getCompetitionPage(
  eventSlug: string,
  competitionSlug: string,
): Promise<CompetitionPageData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, eventSlug), eq(events.isPublished, true)))
    .limit(1);

  if (!event) {
    return null;
  }

  const [competition] = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.eventId, event.id),
        eq(competitions.slug, competitionSlug),
      ),
    )
    .limit(1);

  if (!competition) {
    return null;
  }

  const registration = getRegistrationStatus(competition);
  const effectiveStatus =
    competition.status === "registration_open" && !registration.open
      ? "registration_closed"
      : competition.status;

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      seedPosition: teams.seedPosition,
      participantCount: sql<number>`count(distinct ${participants.id})::int`,
    })
    .from(teams)
    .leftJoin(participants, eq(participants.teamId, teams.id))
    .where(eq(teams.competitionId, competition.id))
    .groupBy(teams.id, teams.name, teams.shortName, teams.seedPosition)
    .orderBy(asc(teams.seedPosition), asc(teams.name));

  const entrants = teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    participantCount: team.participantCount,
  }));

  const resultRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        eq(matches.status, "published"),
        eq(matches.isBye, false),
        isNull(matches.cancelledAt),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`);

  const upcomingRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        inArray(matches.status, ["scheduled", "awaiting_result", "in_review"]),
        eq(matches.isBye, false),
      ),
    )
    .orderBy(sql`${matches.startsAt} asc nulls last`, asc(matches.matchNumber));

  const cancelledRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        eq(matches.status, "cancelled"),
        eq(matches.isBye, false),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`);

  const results = resultRows.map(mapPublicMatch);
  const competitionGroups = await loadCompetitionStandings(competition);
  const bracket =
    competition.format === "single_elimination"
      ? (
          await publicMatchQuery()
            .where(
              and(
                eq(matches.competitionId, competition.id),
                eq(matches.isBye, false),
              ),
            )
            .orderBy(asc(matches.roundNumber), asc(matches.bracketSlot))
        ).map(mapPublicMatch)
      : [];

  const leaders = await getCompetitionLeaders(competition.id, competition.sport);

  const venueRows = await db
    .select({ id: venues.id, name: venues.name })
    .from(venues)
    .where(eq(venues.eventId, event.id))
    .orderBy(asc(venues.sortOrder));

  const usedVenueRows = await db
    .selectDistinct({
      id: venues.id,
      name: venues.name,
      sortOrder: venues.sortOrder,
    })
    .from(matches)
    .innerJoin(venues, eq(matches.venueId, venues.id))
    .where(
      and(
        eq(matches.competitionId, competition.id),
        isNotNull(matches.venueId),
      ),
    )
    .orderBy(asc(venues.sortOrder));

  const competitionVenues = (usedVenueRows.length ? usedVenueRows : venueRows).map(
    (venue) => ({ id: venue.id, name: venue.name }),
  );

  const siblingCompetitions = await db
    .select({
      name: competitions.name,
      slug: competitions.slug,
      sport: competitions.sport,
    })
    .from(competitions)
    .where(eq(competitions.eventId, event.id))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
      competitions: siblingCompetitions,
    },
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
      registrationState: registration.open ? "open" : "closed",
      registrationDeadline: toIso(competition.registrationDeadline),
      groupCount: competition.groupCount,
      qualifiersPerGroup: competition.qualifiersPerGroup,
      defaultMatchDurationMinutes: competition.defaultMatchDurationMinutes,
      drawSeed: competition.drawSeed,
      drawGeneratedAt: toIso(competition.drawGeneratedAt),
      status: effectiveStatus,
      publicNote: competition.publicNote,
      cancelledAt: toIso(competition.cancelledAt),
    },
    venues: competitionVenues,
    entrants,
    groups: competitionGroups,
    bracket,
    results,
    upcoming: upcomingRows.map(mapPublicMatch),
    cancelled: cancelledRows.map(mapPublicMatch),
    leaders,
    stats: {
      matchCount:
        results.length + upcomingRows.length + cancelledRows.length,
      publishedCount: results.length,
    },
  };
}
