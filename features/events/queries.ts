import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  managerInvitations,
  matches,
  participants,
  teamManagers,
  teams,
  venues,
} from "@/lib/db/schema";
import type {
  AdminCompetition,
  AdminEventData,
  ChecklistItem,
} from "@/features/events/types";

export async function getAdminEventData(
  eventId: string,
): Promise<AdminEventData | null> {
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
      format: competitions.format,
      status: competitions.status,
      registrationState: competitions.registrationState,
      drawGeneratedAt: competitions.drawGeneratedAt,
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
      competitions.status,
      competitions.registrationState,
      competitions.drawGeneratedAt,
      competitions.sortOrder,
    )
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const competitionData: AdminCompetition[] = competitionRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    sport: row.sport,
    format: row.format,
    status: row.status,
    registrationState: row.registrationState,
    teamCount: row.teamCount,
    participantCount: row.participantCount,
    matchCount: row.matchCount,
    publishedCount: row.publishedCount,
    sortOrder: row.sortOrder,
  }));

  const football = competitionRows.find(
    (competition) => competition.sport === "football",
  );
  const footballTeamIds = football
    ? await db
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.competitionId, football.id))
    : [];
  const footballTeamIdList = footballTeamIds.map((team) => team.id);

  const acceptedManagerRows = footballTeamIdList.length
    ? await db
        .select({ count: sql<number>`count(distinct ${teamManagers.userId})::int` })
        .from(teamManagers)
        .where(inArray(teamManagers.teamId, footballTeamIdList))
    : [{ count: 0 }];

  const pendingInvitationRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(managerInvitations)
    .where(
      and(
        eq(managerInvitations.eventId, event.id),
        eq(managerInvitations.kind, "email"),
        isNull(managerInvitations.acceptedAt),
        isNull(managerInvitations.revokedAt),
        gt(managerInvitations.expiresAt, new Date()),
      ),
    );

  const venueRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(venues)
    .where(eq(venues.eventId, event.id));

  const eventStatsRows = await db
    .select({
      matches: sql<number>`count(distinct ${matches.id})::int`,
      published: sql<number>`count(distinct case when ${matches.status} = 'published' then ${matches.id} end)::int`,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(eq(competitions.eventId, event.id));

  const metrics = {
    teams: competitionData.reduce((sum, row) => sum + row.teamCount, 0),
    participants: competitionData.reduce(
      (sum, row) => sum + row.participantCount,
      0,
    ),
    pendingInvitations: pendingInvitationRows[0]?.count ?? 0,
    venues: venueRows[0]?.count ?? 0,
    matches: eventStatsRows[0]?.matches ?? 0,
    publishedResults: eventStatsRows[0]?.published ?? 0,
  };

  const acceptedManagers = acceptedManagerRows[0]?.count ?? 0;
  const totalManagers = football?.teamCount ?? 0;
  const footballPublished = football?.publishedCount ?? 0;
  const footballDrawDone = Boolean(football?.drawGeneratedAt);
  const footballRegistrationOpen =
    football?.registrationState === "open";

  const rawChecklist: Array<Omit<ChecklistItem, "state"> & { done: boolean }> = [
    {
      key: "event",
      labelKey: "admin.checklistEvent",
      done: true,
    },
    {
      key: "venues",
      labelKey: "admin.checklistVenues",
      done: metrics.venues > 0,
    },
    {
      key: "competitions",
      labelKey: "admin.checklistCompetitions",
      done: competitionData.length > 0,
    },
    {
      key: "registration",
      labelKey: "admin.checklistRegistration",
      done: footballRegistrationOpen,
    },
    {
      key: "managers",
      labelKey: "admin.checklistManagers",
      done: acceptedManagers >= totalManagers && totalManagers > 0,
      detail: `${acceptedManagers}/${totalManagers}`,
    },
    {
      key: "draw",
      labelKey: "admin.checklistDraw",
      done: footballDrawDone,
    },
    {
      key: "results",
      labelKey: "admin.checklistResults",
      done: footballPublished > 0,
    },
  ];

  let foundCurrent = false;
  const checklist: ChecklistItem[] = rawChecklist.map((item) => {
    if (item.done) {
      return { ...item, state: "done" };
    }
    if (!foundCurrent) {
      foundCurrent = true;
      return { ...item, state: "current" };
    }
    return { ...item, state: "next" };
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
    },
    competitions: competitionData,
    metrics,
    checklist,
    managers: {
      accepted: acceptedManagers,
      total: totalManagers,
    },
  };
}
