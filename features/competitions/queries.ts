import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  groupEntries,
  groups,
  matches,
  participants,
  teams,
  venues,
} from "@/lib/db/schema";
import { calculateTennisStandings } from "@/features/competitions/tennis-standings";
import type {
  CompetitionGroup,
  CompetitionPageData,
} from "@/features/competitions/types";
import { mapPublicMatch, publicMatchQuery } from "@/features/public/matches";

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

  const groupRows = await db
    .select({ id: groups.id, name: groups.name, sortOrder: groups.sortOrder })
    .from(groups)
    .where(eq(groups.competitionId, competition.id))
    .orderBy(asc(groups.sortOrder), asc(groups.name));

  const groupIds = groupRows.map((group) => group.id);
  const groupEntryRows = groupIds.length
    ? await db
        .select({
          groupId: groupEntries.groupId,
          teamId: groupEntries.teamId,
          teamName: teams.name,
          seedPosition: groupEntries.seedPosition,
        })
        .from(groupEntries)
        .innerJoin(teams, eq(groupEntries.teamId, teams.id))
        .where(inArray(groupEntries.groupId, groupIds))
        .orderBy(asc(groupEntries.seedPosition))
    : [];

  const resultRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        eq(matches.status, "published"),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`);

  const upcomingRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        inArray(matches.status, ["scheduled", "awaiting_result", "in_review"]),
        isNotNull(matches.startsAt),
      ),
    )
    .orderBy(asc(matches.startsAt));

  const cancelledRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        eq(matches.status, "cancelled"),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`);

  const results = resultRows.map(mapPublicMatch);

  const competitionGroups: CompetitionGroup[] = groupRows.map((group) => {
    const standingsTeams = groupEntryRows
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        seedPosition: entry.seedPosition,
      }));

    const standingsMatches = results
      .filter((match) => match.groupId === group.id)
      .map((match) => ({
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerTeamId: match.winnerTeamId,
        sets: match.sets,
        isWalkover: match.isWalkover,
      }));

    return {
      id: group.id,
      name: group.name,
      standings: calculateTennisStandings(standingsTeams, standingsMatches),
    };
  });

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
      registrationState: competition.registrationState,
      registrationDeadline: toIso(competition.registrationDeadline),
      qualifiersPerGroup: competition.qualifiersPerGroup,
      defaultMatchDurationMinutes: competition.defaultMatchDurationMinutes,
      drawSeed: competition.drawSeed,
      drawGeneratedAt: toIso(competition.drawGeneratedAt),
      status: competition.status,
      publicNote: competition.publicNote,
      cancelledAt: toIso(competition.cancelledAt),
    },
    venues: competitionVenues,
    entrants,
    groups: competitionGroups,
    results,
    upcoming: upcomingRows.map(mapPublicMatch),
    cancelled: cancelledRows.map(mapPublicMatch),
    stats: {
      matchCount:
        results.length + upcomingRows.length + cancelledRows.length,
      publishedCount: results.length,
    },
  };
}
