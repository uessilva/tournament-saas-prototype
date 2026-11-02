import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  disputes,
  events,
  matchEntries,
  matches,
  resultVersions,
  teams,
  users,
} from "@/lib/db/schema";

const opener = alias(users, "dispute_opener");
const resolver = alias(users, "dispute_resolver");
const disputeTeam = alias(teams, "dispute_team");
const homeEntry = alias(matchEntries, "dispute_home_entry");
const awayEntry = alias(matchEntries, "dispute_away_entry");
const homeTeam = alias(teams, "dispute_home_team");
const awayTeam = alias(teams, "dispute_away_team");

export type DisputeRecord = {
  id: string;
  matchId: string;
  matchNumber: number;
  matchStatus: string;
  matchStartsAt: string | null;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: "football" | "tennis";
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventTimezone: string;
  teamId: string;
  teamName: string;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  status: "open" | "resolved" | "dismissed";
  explanation: string;
  response: string | null;
  openedByUserId: string;
  openedByName: string | null;
  openedByEmail: string | null;
  openedAt: string;
  resolvedByName: string | null;
  resolvedByEmail: string | null;
  resolvedAt: string | null;
  correctionResultVersionId: string | null;
  correctionVersion: number | null;
  correctionReason: string | null;
  correctionConfirmedAt: string | null;
};

export type DisputeCorrectionOption = {
  id: string;
  version: number;
  reason: string;
  confirmedAt: string;
};

export type DisputeActivity = {
  id: string;
  type: string;
  summary: string | null;
  actorName: string | null;
  createdAt: string;
};

export type EventDisputesData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  disputes: DisputeRecord[];
  activity: DisputeActivity[];
  correctionOptionsByMatch: Record<string, DisputeCorrectionOption[]>;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function disputeSelection() {
  return db
    .select({
      id: disputes.id,
      matchId: disputes.matchId,
      matchNumber: matches.matchNumber,
      matchStatus: matches.status,
      matchStartsAt: matches.startsAt,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
      eventTimezone: events.timezone,
      teamId: disputes.teamId,
      teamName: disputeTeam.name,
      homeTeamId: homeEntry.teamId,
      homeTeamName: homeTeam.name,
      awayTeamId: awayEntry.teamId,
      awayTeamName: awayTeam.name,
      status: disputes.status,
      explanation: disputes.explanation,
      response: disputes.response,
      openedByUserId: disputes.openedByUserId,
      openedByName: opener.name,
      openedByEmail: opener.email,
      openedAt: disputes.createdAt,
      resolvedByName: resolver.name,
      resolvedByEmail: resolver.email,
      resolvedAt: disputes.resolvedAt,
      correctionResultVersionId: disputes.correctionResultVersionId,
      correctionVersion: resultVersions.version,
      correctionReason: resultVersions.reason,
      correctionConfirmedAt: resultVersions.confirmedAt,
    })
    .from(disputes)
    .innerJoin(matches, eq(matches.id, disputes.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .innerJoin(events, eq(events.id, competitions.eventId))
    .innerJoin(disputeTeam, eq(disputeTeam.id, disputes.teamId))
    .leftJoin(
      homeEntry,
      and(eq(homeEntry.matchId, matches.id), eq(homeEntry.side, "home")),
    )
    .leftJoin(homeTeam, eq(homeTeam.id, homeEntry.teamId))
    .leftJoin(
      awayEntry,
      and(eq(awayEntry.matchId, matches.id), eq(awayEntry.side, "away")),
    )
    .leftJoin(awayTeam, eq(awayTeam.id, awayEntry.teamId))
    .leftJoin(opener, eq(opener.id, disputes.openedByUserId))
    .leftJoin(resolver, eq(resolver.id, disputes.resolvedByUserId))
    .leftJoin(
      resultVersions,
      eq(resultVersions.id, disputes.correctionResultVersionId),
    );
}

function mapDispute(
  row: Awaited<ReturnType<typeof disputeSelection>>[number],
): DisputeRecord {
  return {
    id: row.id,
    matchId: row.matchId,
    matchNumber: row.matchNumber,
    matchStatus: row.matchStatus,
    matchStartsAt: toIso(row.matchStartsAt),
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    competitionSlug: row.competitionSlug,
    sport: row.sport,
    eventId: row.eventId,
    eventName: row.eventName,
    eventSlug: row.eventSlug,
    eventTimezone: row.eventTimezone,
    teamId: row.teamId,
    teamName: row.teamName,
    homeTeamId: row.homeTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamId: row.awayTeamId,
    awayTeamName: row.awayTeamName,
    status: row.status,
    explanation: row.explanation,
    response: row.response,
    openedByUserId: row.openedByUserId,
    openedByName: row.openedByName,
    openedByEmail: row.openedByEmail,
    openedAt: row.openedAt.toISOString(),
    resolvedByName: row.resolvedByName,
    resolvedByEmail: row.resolvedByEmail,
    resolvedAt: toIso(row.resolvedAt),
    correctionResultVersionId: row.correctionResultVersionId,
    correctionVersion: row.correctionVersion,
    correctionReason: row.correctionReason,
    correctionConfirmedAt: toIso(row.correctionConfirmedAt),
  };
}

/**
 * Private dispute records for Matches the caller has already authorized. The
 * caller must only pass Match ids involving one of the viewer's Teams.
 */
export async function getDisputesForMatches(
  matchIds: string[],
): Promise<DisputeRecord[]> {
  if (!matchIds.length) {
    return [];
  }

  const rows = await disputeSelection()
    .where(inArray(disputes.matchId, matchIds))
    .orderBy(desc(disputes.createdAt));

  return rows.map(mapDispute);
}

export async function getEventDisputes(
  eventId: string,
): Promise<EventDisputesData | null> {
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      timezone: events.timezone,
      ownerId: events.ownerId,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return null;
  }

  const [rows, activityRows] = await Promise.all([
    disputeSelection()
      .where(eq(events.id, event.id))
      .orderBy(desc(disputes.createdAt)),
    db
      .select({
        id: auditEvents.id,
        type: auditEvents.type,
        summary: auditEvents.summary,
        actorName: users.name,
        actorEmail: users.email,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(
        and(
          eq(auditEvents.eventId, event.id),
          inArray(auditEvents.type, [
            "dispute.opened",
            "dispute.resolved",
            "dispute.dismissed",
          ]),
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(20),
  ]);

  const disputeRows = rows.map(mapDispute);
  const activeMatchIds = [
    ...new Set(
      disputeRows
        .filter((dispute) => dispute.status === "open")
        .map((dispute) => dispute.matchId),
    ),
  ];

  const correctionRows = activeMatchIds.length
    ? await db
        .select({
          id: resultVersions.id,
          matchId: resultVersions.matchId,
          version: resultVersions.version,
          reason: resultVersions.reason,
          confirmedAt: resultVersions.confirmedAt,
        })
        .from(resultVersions)
        .where(
          and(
            inArray(resultVersions.matchId, activeMatchIds),
            gt(resultVersions.version, 1),
            isNotNull(resultVersions.reason),
          ),
        )
        .orderBy(desc(resultVersions.version))
    : [];

  const correctionOptionsByMatch: Record<string, DisputeCorrectionOption[]> = {};
  for (const row of correctionRows) {
    if (!row.reason) {
      continue;
    }
    const options = correctionOptionsByMatch[row.matchId] ?? [];
    options.push({
      id: row.id,
      version: row.version,
      reason: row.reason,
      confirmedAt: row.confirmedAt.toISOString(),
    });
    correctionOptionsByMatch[row.matchId] = options;
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
    },
    disputes: disputeRows,
    activity: activityRows.map((row) => ({
      id: row.id,
      type: row.type,
      summary: row.summary,
      actorName: row.actorName ?? row.actorEmail,
      createdAt: row.createdAt.toISOString(),
    })),
    correctionOptionsByMatch,
  };
}

export async function getOpenDisputeCount(eventId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(disputes)
    .innerJoin(matches, eq(matches.id, disputes.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(
      and(eq(competitions.eventId, eventId), eq(disputes.status, "open")),
    );

  return row?.count ?? 0;
}
