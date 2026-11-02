import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  accessEvents,
  auditEvents,
  competitions,
  events,
  invitationTeams,
  managerInvitations,
  teamManagers,
  teams,
  users,
} from "@/lib/db/schema";
import { hashInvitationToken, looksLikeInvitationToken } from "@/lib/invitations/tokens";
import type {
  AccessTeamRef,
  InvitationStatus,
  InvitationView,
} from "@/features/teams/types";

type InvitationRow = typeof managerInvitations.$inferSelect;

export function deriveInvitationStatus(
  invitation: Pick<
    InvitationRow,
    "kind" | "expiresAt" | "acceptedAt" | "revokedAt"
  >,
  now = new Date(),
): InvitationStatus {
  if (invitation.revokedAt) {
    return "revoked";
  }

  if (invitation.kind === "email" && invitation.acceptedAt) {
    return "accepted";
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  return invitation.kind === "email" ? "pending" : "active";
}

type InvitationTeamQuery = Pick<typeof db, "select">;

async function loadInvitationTeamsWith(
  query: InvitationTeamQuery,
  invitationId: string,
) {
  const rows = await query
    .select({
      id: teams.id,
      name: teams.name,
      sport: competitions.sport,
      competitionName: competitions.name,
    })
    .from(invitationTeams)
    .innerJoin(teams, eq(invitationTeams.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(eq(invitationTeams.invitationId, invitationId))
    .orderBy(teams.name);

  return rows satisfies AccessTeamRef[];
}

async function loadInvitationTeams(invitationId: string) {
  return loadInvitationTeamsWith(db, invitationId);
}

export async function getInvitationViewByToken(
  rawToken: string,
): Promise<InvitationView | null> {
  if (!looksLikeInvitationToken(rawToken)) {
    return null;
  }

  const tokenHash = hashInvitationToken(rawToken);
  const [row] = await db
    .select({
      invitation: managerInvitations,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
      eventTimezone: events.timezone,
      createdByName: users.name,
    })
    .from(managerInvitations)
    .innerJoin(events, eq(managerInvitations.eventId, events.id))
    .leftJoin(users, eq(managerInvitations.createdByUserId, users.id))
    .where(eq(managerInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return null;
  }

  const teamRows = await loadInvitationTeams(row.invitation.id);

  return {
    id: row.invitation.id,
    kind: row.invitation.kind,
    email: row.invitation.email,
    status: deriveInvitationStatus(row.invitation),
    expiresAt: row.invitation.expiresAt.toISOString(),
    acceptedAt: row.invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: row.invitation.revokedAt?.toISOString() ?? null,
    createdByName: row.createdByName,
    event: {
      id: row.eventId,
      name: row.eventName,
      slug: row.eventSlug,
      timezone: row.eventTimezone,
    },
    teams: teamRows,
  };
}

export type RedeemResult =
  | {
      ok: true;
      alreadyAccepted: boolean;
      teams: AccessTeamRef[];
    }
  | {
      ok: false;
      reason:
        | "not_found"
        | "revoked"
        | "expired"
        | "already_accepted"
        | "email_mismatch"
        | "no_teams";
      invitedEmail?: string;
    };

export async function redeemInvitation(
  rawToken: string,
  user: { id: string; email: string | null },
): Promise<RedeemResult> {
  if (!looksLikeInvitationToken(rawToken)) {
    return { ok: false, reason: "not_found" };
  }

  const tokenHash = hashInvitationToken(rawToken);

  return db.transaction(async (tx) => {
    const [invitation] = await tx
      .select()
      .from(managerInvitations)
      .where(eq(managerInvitations.tokenHash, tokenHash))
      .limit(1)
      .for("update");

    if (!invitation) {
      return { ok: false, reason: "not_found" };
    }

    const now = new Date();

    if (invitation.revokedAt) {
      return { ok: false, reason: "revoked" };
    }

    if (invitation.kind === "email" && invitation.acceptedAt) {
      if (invitation.acceptedByUserId === user.id) {
        const repeatedTeams = await loadInvitationTeamsWith(
          tx,
          invitation.id,
        );

        return {
          ok: true,
          alreadyAccepted: true,
          teams: repeatedTeams,
        };
      }

      return { ok: false, reason: "already_accepted" };
    }

    if (invitation.expiresAt.getTime() <= now.getTime()) {
      await tx.insert(accessEvents).values({
        eventId: invitation.eventId,
        invitationId: invitation.id,
        actorUserId: user.id,
        subjectUserId: user.id,
        type: "invitation_expired",
        metadata: {
          kind: invitation.kind,
          email: invitation.email,
          expiresAt: invitation.expiresAt.toISOString(),
        },
        createdAt: now,
      });

      return { ok: false, reason: "expired" };
    }

    if (invitation.kind === "email") {
      const invitedEmail = invitation.email?.trim().toLowerCase() ?? "";
      const userEmail = user.email?.trim().toLowerCase() ?? "";

      if (!invitedEmail || invitedEmail !== userEmail) {
        return {
          ok: false,
          reason: "email_mismatch",
          invitedEmail: invitation.email ?? undefined,
        };
      }
    }

    const teamRows = await loadInvitationTeamsWith(tx, invitation.id);

    if (!teamRows.length) {
      return { ok: false, reason: "no_teams" };
    }

    const alreadyManagerRows = await tx
      .select({ teamId: teamManagers.teamId })
      .from(teamManagers)
      .where(
        and(
          eq(teamManagers.userId, user.id),
          inArray(
            teamManagers.teamId,
            teamRows.map((team) => team.id),
          ),
        ),
      );
    const alreadyManagerTeamIds = new Set(
      alreadyManagerRows.map((row) => row.teamId),
    );

    await tx
      .insert(teamManagers)
      .values(
        teamRows.map((team) => ({
          teamId: team.id,
          userId: user.id,
          createdAt: now,
        })),
      )
      .onConflictDoNothing();

    await tx
      .update(managerInvitations)
      .set({
        acceptedAt: now,
        acceptedByUserId: user.id,
      })
      .where(eq(managerInvitations.id, invitation.id));

    const eventLabel = invitation.kind === "email" ? "invitation_accepted" : "link_accepted";

    await tx.insert(accessEvents).values(
      teamRows.map((team) => ({
        eventId: invitation.eventId,
        teamId: team.id,
        invitationId: invitation.id,
        actorUserId: user.id,
        subjectUserId: user.id,
        type: eventLabel as "invitation_accepted" | "link_accepted",
        metadata: {
          email: user.email,
          team: team.name,
          alreadyManager: alreadyManagerTeamIds.has(team.id),
        },
        createdAt: now,
      })),
    );

    await tx.insert(auditEvents).values({
      eventId: invitation.eventId,
      actorUserId: user.id,
      type:
        invitation.kind === "email"
          ? "invitation.accepted"
          : "link.accepted",
      entityType: "manager_invitation",
      entityId: invitation.id,
      summary: `${user.email ?? "A user"} accepted ${
        invitation.kind === "email" ? "an email invitation" : "a reusable link"
      } for ${teamRows.map((team) => team.name).join(", ")}.`,
      metadata: {
        kind: invitation.kind,
        teamIds: teamRows.map((team) => team.id),
      },
      createdAt: now,
    });

    return {
      ok: true,
      alreadyAccepted: false,
      teams: teamRows,
    };
  });
}

export async function getInvitationTeamsForEvent(eventId: string) {
  return db
    .select({
      invitationId: invitationTeams.invitationId,
      teamId: teams.id,
      teamName: teams.name,
    })
    .from(invitationTeams)
    .innerJoin(teams, eq(invitationTeams.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(eq(competitions.eventId, eventId));
}
