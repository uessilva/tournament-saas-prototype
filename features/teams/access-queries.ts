import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "@/lib/db/client";
import {
  accessEvents,
  competitions,
  events,
  invitationTeams,
  managerInvitations,
  participants,
  teamManagers,
  teams,
  users,
} from "@/lib/db/schema";
import { deriveInvitationStatus } from "@/features/teams/invitations";
import type {
  AccessHistoryEntry,
  AccessTeamRef,
  EventAccessData,
  EventInvitation,
  EventTeamAccess,
} from "@/features/teams/types";

export async function getEventAccessData(
  eventId: string,
): Promise<EventAccessData | null> {
  if (!z.string().uuid().safeParse(eventId).success) {
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

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      shortName: teams.shortName,
      sport: competitions.sport,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      participantCount: sql<number>`count(distinct ${participants.id})::int`,
      competitionSort: competitions.sortOrder,
    })
    .from(teams)
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .leftJoin(participants, eq(participants.teamId, teams.id))
    .where(eq(competitions.eventId, eventId))
    .groupBy(
      teams.id,
      teams.name,
      teams.shortName,
      competitions.sport,
      competitions.id,
      competitions.name,
      competitions.slug,
      competitions.sortOrder,
    )
    .orderBy(asc(competitions.sortOrder), asc(teams.name));

  const teamIds = teamRows.map((team) => team.id);
  const managerRows = teamIds.length
    ? await db
        .select({
          teamId: teamManagers.teamId,
          userId: users.id,
          name: users.name,
          email: users.email,
        })
        .from(teamManagers)
        .innerJoin(users, eq(teamManagers.userId, users.id))
        .where(inArray(teamManagers.teamId, teamIds))
        .orderBy(asc(users.name))
    : [];

  const managersByTeam = new Map<
    string,
    Array<{ userId: string; name: string; email: string }>
  >();
  for (const manager of managerRows) {
    const list = managersByTeam.get(manager.teamId) ?? [];
    list.push({
      userId: manager.userId,
      name: manager.name ?? manager.email,
      email: manager.email,
    });
    managersByTeam.set(manager.teamId, list);
  }

  const eventTeams: EventTeamAccess[] = teamRows.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    sport: team.sport,
    competitionId: team.competitionId,
    competitionName: team.competitionName,
    competitionSlug: team.competitionSlug,
    participantCount: team.participantCount,
    managers: managersByTeam.get(team.id) ?? [],
  }));

  const invitationRows = await db
    .select({
      id: managerInvitations.id,
      kind: managerInvitations.kind,
      email: managerInvitations.email,
      expiresAt: managerInvitations.expiresAt,
      acceptedAt: managerInvitations.acceptedAt,
      acceptedByUserId: managerInvitations.acceptedByUserId,
      revokedAt: managerInvitations.revokedAt,
      lastSentAt: managerInvitations.lastSentAt,
      createdAt: managerInvitations.createdAt,
      createdByName: users.name,
    })
    .from(managerInvitations)
    .leftJoin(users, eq(managerInvitations.createdByUserId, users.id))
    .where(eq(managerInvitations.eventId, eventId))
    .orderBy(desc(managerInvitations.createdAt));

  const invitationIds = invitationRows.map((invitation) => invitation.id);
  const invitationTeamRows = invitationIds.length
    ? await db
        .select({
          invitationId: invitationTeams.invitationId,
          id: teams.id,
          name: teams.name,
          sport: competitions.sport,
          competitionName: competitions.name,
        })
        .from(invitationTeams)
        .innerJoin(teams, eq(invitationTeams.teamId, teams.id))
        .innerJoin(competitions, eq(teams.competitionId, competitions.id))
        .where(inArray(invitationTeams.invitationId, invitationIds))
        .orderBy(asc(teams.name))
    : [];

  const teamsByInvitation = new Map<string, AccessTeamRef[]>();
  for (const row of invitationTeamRows) {
    const list = teamsByInvitation.get(row.invitationId) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      sport: row.sport,
      competitionName: row.competitionName,
    });
    teamsByInvitation.set(row.invitationId, list);
  }

  const acceptedUserIds = [
    ...new Set(
      invitationRows
        .map((invitation) => invitation.acceptedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const acceptedUsers = acceptedUserIds.length
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, acceptedUserIds))
    : [];
  const acceptedUserById = new Map(
    acceptedUsers.map((user) => [user.id, user]),
  );

  const now = new Date();
  const invitations: EventInvitation[] = invitationRows.map((invitation) => {
    const acceptedUser = invitation.acceptedByUserId
      ? acceptedUserById.get(invitation.acceptedByUserId)
      : null;
    return {
      id: invitation.id,
      kind: invitation.kind,
      email: invitation.email,
      status: deriveInvitationStatus(invitation, now),
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
      lastSentAt: invitation.lastSentAt?.toISOString() ?? null,
      createdByName: invitation.createdByName,
      acceptedByName: acceptedUser?.name ?? null,
      acceptedByEmail: acceptedUser?.email ?? null,
      teams: teamsByInvitation.get(invitation.id) ?? [],
    };
  });

  const actor = alias(users, "access_actor");
  const subject = alias(users, "access_subject");
  const historyRows = await db
    .select({
      id: accessEvents.id,
      type: accessEvents.type,
      createdAt: accessEvents.createdAt,
      actorName: actor.name,
      actorEmail: actor.email,
      subjectName: subject.name,
      subjectEmail: subject.email,
      teamName: teams.name,
      invitationId: accessEvents.invitationId,
      invitationKind: managerInvitations.kind,
      invitationEmail: managerInvitations.email,
    })
    .from(accessEvents)
    .leftJoin(teams, eq(accessEvents.teamId, teams.id))
    .leftJoin(actor, eq(accessEvents.actorUserId, actor.id))
    .leftJoin(subject, eq(accessEvents.subjectUserId, subject.id))
    .leftJoin(
      managerInvitations,
      eq(accessEvents.invitationId, managerInvitations.id),
    )
    .where(eq(accessEvents.eventId, eventId))
    .orderBy(desc(accessEvents.createdAt))
    .limit(150);

  const history: AccessHistoryEntry[] = historyRows.map((row) => ({
    id: row.id,
    type: row.type,
    createdAt: row.createdAt.toISOString(),
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    subjectName: row.subjectName,
    subjectEmail: row.subjectEmail,
    teamName: row.teamName,
    invitationKind: row.invitationKind,
    invitationEmail: row.invitationEmail,
    teams:
      row.invitationId != null
        ? (teamsByInvitation.get(row.invitationId) ?? []).map((team) => team.name)
        : row.teamName
          ? [row.teamName]
          : [],
  }));

  return {
    event,
    teams: eventTeams,
    invitations,
    history,
    counts: {
      teams: eventTeams.length,
      managers: managerRows.length,
      pendingEmailInvitations: invitations.filter(
        (invitation) => invitation.status === "pending",
      ).length,
      activeLinks: invitations.filter(
        (invitation) => invitation.status === "active",
      ).length,
    },
  };
}
