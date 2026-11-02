"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { sendInvitationEmail } from "@/lib/auth/email";
import { getCurrentUser, requireEventOwner } from "@/lib/auth/guards";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  accessEvents,
  auditEvents,
  competitions,
  invitationTeams,
  jobs,
  managerInvitations,
  teamManagers,
  teams,
} from "@/lib/db/schema";
import {
  createInvitationToken,
  invitationExpiryFrom,
  looksLikeInvitationToken,
  INVITATION_COOKIE,
  INVITATION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/invitations/tokens";
import { completeJob, failJob, retryJob } from "@/lib/jobs/queue";
import { processJob } from "@/lib/jobs/handlers";
import { getInvitationViewByToken, redeemInvitation } from "@/features/teams/invitations";

export type AccessActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  rawToken?: string;
  kind?: "email" | "link";
  emailSent?: boolean;
  fieldErrors?: Record<string, string>;
};

const createSchema = z.object({
  eventId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  teamIds: z.array(z.string().uuid()).min(1),
});

const linkSchema = z.object({
  eventId: z.string().uuid(),
  teamIds: z.array(z.string().uuid()).min(1),
});

function readTeamIds(formData: FormData) {
  return formData
    .getAll("teamIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);
}

async function validateTeams(eventId: string, teamIds: string[]) {
  const rows = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionStatus: competitions.status,
    })
    .from(teams)
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(
      and(eq(competitions.eventId, eventId), inArray(teams.id, teamIds)),
    );

  if (rows.length !== new Set(teamIds).size) {
    return null;
  }

  return rows;
}

function hasCancelledCompetition(
  rows: Array<{ competitionStatus: string }>,
) {
  return rows.some((row) => row.competitionStatus === "cancelled");
}

function cancelledCompetitionError(): AccessActionState {
  return { status: "error", code: "competition_cancelled" };
}

async function appOrigin() {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ??
    headerStore.get("host") ??
    "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

function invitationPath(token: string) {
  return `/invitations/${token}`;
}

async function insertAccessEvent(
  values: Array<typeof accessEvents.$inferInsert>,
) {
  if (values.length) {
    await db.insert(accessEvents).values(values);
  }
}

export async function createEmailInvitationAction(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = createSchema.safeParse({
    eventId: formData.get("eventId"),
    email: formData.get("email"),
    teamIds: readTeamIds(formData),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] =
          field === "email" ? "email_invalid" : "teams_required";
      }
    }
    return { status: "error", code: "fix_errors", fieldErrors };
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const teamRows = await validateTeams(event.id, parsed.data.teamIds);

  if (!teamRows) {
    return { status: "error", code: "teams_invalid" };
  }

  if (hasCancelledCompetition(teamRows)) {
    return cancelledCompetitionError();
  }

  const { token, tokenHash } = createInvitationToken();
  const expiresAt = invitationExpiryFrom();
  const [invitation] = await db
    .insert(managerInvitations)
    .values({
      eventId: event.id,
      kind: "email",
      email: parsed.data.email,
      tokenHash,
      expiresAt,
      createdByUserId: user.id,
    })
    .returning({ id: managerInvitations.id });

  if (!invitation) {
    return { status: "error", code: "action_failed" };
  }

  await db.insert(invitationTeams).values(
    teamRows.map((team) => ({ invitationId: invitation.id, teamId: team.id })),
  );

  await db.insert(accessEvents).values(
    teamRows.map((team) => ({
      eventId: event.id,
      teamId: team.id,
      invitationId: invitation.id,
      actorUserId: user.id,
      type: "invitation_created" as const,
      metadata: {
        email: parsed.data.email,
        team: team.name,
      },
    })),
  );

  let emailSent = false;
  const emailJob = await sendInvitationEmail({
    to: parsed.data.email,
    eventId: event.id,
    invitationId: invitation.id,
    eventName: event.name,
    teamNames: teamRows.map((team) => team.name),
    url: `${await appOrigin()}${invitationPath(token)}`,
    expiresAt,
  });
  emailSent = emailJob.ok;
  if (emailSent) {
    await db.insert(accessEvents).values({
      eventId: event.id,
      invitationId: invitation.id,
      actorUserId: user.id,
      type: "invitation_email_sent",
      metadata: { email: parsed.data.email },
    });
  }
  // On failure the invitation remains valid and the failed job stays visible
  // for an Owner manual retry.

  await db.insert(auditEvents).values({
    eventId: event.id,
    actorUserId: user.id,
    type: "invitation.created",
    entityType: "manager_invitation",
    entityId: invitation.id,
    summary: `Email invitation created for ${parsed.data.email} for ${teamRows
      .map((team) => team.name)
      .join(", ")}.`,
    metadata: {
      email: parsed.data.email,
      teamIds: teamRows.map((team) => team.id),
    },
  });

  revalidatePath(`/admin/events/${event.id}/teams`);
  revalidatePath(`/admin/events/${event.id}`);

  return {
    status: "success",
    code: emailSent ? "invitation_created" : "invitation_created_email_failed",
    rawToken: token,
    kind: "email",
    emailSent,
  };
}

export async function createShareLinkAction(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = linkSchema.safeParse({
    eventId: formData.get("eventId"),
    teamIds: readTeamIds(formData),
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { teamIds: "teams_required" },
    };
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const teamRows = await validateTeams(event.id, parsed.data.teamIds);

  if (!teamRows) {
    return { status: "error", code: "teams_invalid" };
  }

  if (hasCancelledCompetition(teamRows)) {
    return cancelledCompetitionError();
  }

  const { token, tokenHash } = createInvitationToken();
  const expiresAt = invitationExpiryFrom();
  const [invitation] = await db
    .insert(managerInvitations)
    .values({
      eventId: event.id,
      kind: "link",
      email: null,
      tokenHash,
      expiresAt,
      createdByUserId: user.id,
    })
    .returning({ id: managerInvitations.id });

  if (!invitation) {
    return { status: "error", code: "action_failed" };
  }

  await db.insert(invitationTeams).values(
    teamRows.map((team) => ({ invitationId: invitation.id, teamId: team.id })),
  );

  await insertAccessEvent(
    teamRows.map((team) => ({
      eventId: event.id,
      teamId: team.id,
      invitationId: invitation.id,
      actorUserId: user.id,
      type: "link_created" as const,
      metadata: { team: team.name },
    })),
  );

  await db.insert(auditEvents).values({
    eventId: event.id,
    actorUserId: user.id,
    type: "link.created",
    entityType: "manager_invitation",
    entityId: invitation.id,
    summary: `Reusable Team-scoped link created for ${teamRows
      .map((team) => team.name)
      .join(", ")}.`,
    metadata: { teamIds: teamRows.map((team) => team.id) },
  });

  revalidatePath(`/admin/events/${event.id}/teams`);

  return {
    status: "success",
    code: "link_created",
    rawToken: token,
    kind: "link",
  };
}

export async function replaceInvitationAction(
  _previous: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const invitationId = String(formData.get("invitationId") ?? "");
  const parsed = z
    .object({ eventId: z.string().uuid(), invitationId: z.string().uuid() })
    .safeParse({ eventId, invitationId });

  if (!parsed.success) {
    return { status: "error", code: "action_failed" };
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const [existing] = await db
    .select()
    .from(managerInvitations)
    .where(
      and(
        eq(managerInvitations.id, parsed.data.invitationId),
        eq(managerInvitations.eventId, event.id),
      ),
    )
    .limit(1);

  if (!existing) {
    return { status: "error", code: "invitation_not_found" };
  }

  const existingTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionStatus: competitions.status,
    })
    .from(invitationTeams)
    .innerJoin(teams, eq(invitationTeams.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(eq(invitationTeams.invitationId, existing.id));

  if (!existingTeams.length) {
    return { status: "error", code: "action_failed" };
  }

  if (hasCancelledCompetition(existingTeams)) {
    return cancelledCompetitionError();
  }

  const { token, tokenHash } = createInvitationToken();
  const now = new Date();
  const expiresAt = invitationExpiryFrom(now);
  const replacement = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(managerInvitations)
      .values({
        eventId: event.id,
        kind: existing.kind,
        email: existing.email,
        tokenHash,
        expiresAt,
        createdByUserId: user.id,
      })
      .returning({ id: managerInvitations.id });

    if (!created) {
      return null;
    }

    await tx
      .update(managerInvitations)
      .set({ revokedAt: now })
      .where(eq(managerInvitations.id, existing.id));

    await tx.insert(invitationTeams).values(
      existingTeams.map((team) => ({
        invitationId: created.id,
        teamId: team.id,
      })),
    );

    await tx.insert(accessEvents).values([
      ...existingTeams.map((team) => ({
        eventId: event.id,
        teamId: team.id,
        invitationId: existing.id,
        actorUserId: user.id,
        type:
          existing.kind === "email"
            ? ("invitation_revoked" as const)
            : ("link_revoked" as const),
        metadata: { reason: "replaced", team: team.name },
      })),
      ...existingTeams.map((team) => ({
        eventId: event.id,
        teamId: team.id,
        invitationId: created.id,
        actorUserId: user.id,
        type:
          existing.kind === "email"
            ? ("invitation_created" as const)
            : ("link_created" as const),
        metadata: { reason: "replacement", team: team.name },
      })),
    ]);

    await tx.insert(auditEvents).values({
      eventId: event.id,
      actorUserId: user.id,
      type: "invitation.replaced",
      entityType: "manager_invitation",
      entityId: created.id,
      summary: `Access credential replaced for ${existingTeams
        .map((team) => team.name)
        .join(", ")}.`,
      metadata: { previousInvitationId: existing.id },
    });

    return created;
  });

  if (!replacement) {
    return { status: "error", code: "action_failed" };
  }

  let emailSent = false;
  if (existing.kind === "email" && existing.email) {
    const emailJob = await sendInvitationEmail({
      to: existing.email,
      eventId: event.id,
      invitationId: replacement.id,
      eventName: event.name,
      teamNames: existingTeams.map((team) => team.name),
      url: `${await appOrigin()}${invitationPath(token)}`,
      expiresAt,
    });
    emailSent = emailJob.ok;
    if (emailSent) {
      await db.insert(accessEvents).values({
        eventId: event.id,
        invitationId: replacement.id,
        actorUserId: user.id,
        type: "invitation_email_sent",
        metadata: { email: existing.email },
      });
    }
    // On failure the replacement remains copyable and retryable.
  }

  revalidatePath(`/admin/events/${event.id}/teams`);

  return {
    status: "success",
    code:
      existing.kind === "email" && !emailSent
        ? "invitation_replaced_email_failed"
        : existing.kind === "email"
          ? "invitation_replaced"
          : "link_replaced",
    rawToken: token,
    kind: existing.kind,
    emailSent,
  };
}

export async function revokeInvitationAction(formData: FormData) {
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      invitationId: z.string().uuid(),
    })
    .safeParse({
      eventId: formData.get("eventId"),
      invitationId: formData.get("invitationId"),
    });

  if (!parsed.success) {
    redirect("/admin?error=invalid-request");
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const invitationId = parsed.data.invitationId;

  const [invitation] = await db
    .select()
    .from(managerInvitations)
    .where(
      and(
        eq(managerInvitations.id, invitationId),
        eq(managerInvitations.eventId, event.id),
      ),
    )
    .limit(1);

  if (!invitation) {
    redirect(`/admin/events/${event.id}/teams?error=invitation-not-found`);
  }

  const invitationTeamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionStatus: competitions.status,
    })
    .from(invitationTeams)
    .innerJoin(teams, eq(invitationTeams.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(eq(invitationTeams.invitationId, invitation.id));

  if (hasCancelledCompetition(invitationTeamRows)) {
    redirect(
      `/admin/events/${event.id}/teams?error=competition-cancelled`,
    );
  }

  const now = new Date();
  await db
    .update(managerInvitations)
    .set({ revokedAt: invitation.revokedAt ?? now })
    .where(eq(managerInvitations.id, invitation.id));

  await insertAccessEvent(
    invitationTeamRows.map((team) => ({
      eventId: event.id,
      teamId: team.id,
      invitationId: invitation.id,
      actorUserId: user.id,
      type:
        invitation.kind === "email"
          ? ("invitation_revoked" as const)
          : ("link_revoked" as const),
      metadata: { team: team.name },
    })),
  );

  await db.insert(auditEvents).values({
    eventId: event.id,
    actorUserId: user.id,
    type:
      invitation.kind === "email"
        ? "invitation.revoked"
        : "link.revoked",
    entityType: "manager_invitation",
    entityId: invitation.id,
    summary: `${
      invitation.kind === "email" ? "Email invitation" : "Reusable link"
    } revoked for ${invitationTeamRows.map((team) => team.name).join(", ")}.`,
    metadata: { kind: invitation.kind },
  });

  revalidatePath(`/admin/events/${event.id}/teams`);
  redirect(`/admin/events/${event.id}/teams?notice=revoked`);
}

export async function retryEmailJobAction(formData: FormData) {
  const parsed = z
    .object({ eventId: z.string().uuid(), jobId: z.string().uuid() })
    .safeParse({
      eventId: formData.get("eventId"),
      jobId: formData.get("jobId"),
    });

  if (!parsed.success) {
    redirect("/admin?error=invalid-request");
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const [job] = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.id, parsed.data.jobId), eq(jobs.type, "email.send")),
    )
    .limit(1);

  const payload = (job?.payload ?? {}) as Record<string, unknown>;
  if (
    !job ||
    job.status !== "failed" ||
    payload.eventId !== event.id
  ) {
    redirect(`/admin/events/${event.id}/teams?error=email-retry-failed`);
  }

  const retried = await retryJob(job.id);
  if (!retried) {
    redirect(`/admin/events/${event.id}/teams?error=email-retry-failed`);
  }

  try {
    await processJob(retried);
    await completeJob(retried.id);
  } catch {
    await failJob(
      retried,
      new Error("Email delivery failed. Check the local SMTP server and retry."),
      { forceFailed: true, recordAttempt: true },
    );
    redirect(`/admin/events/${event.id}/teams?error=email-retry-failed`);
  }

  const invitationId =
    typeof payload.invitationId === "string" ? payload.invitationId : null;
  if (invitationId) {
    await db.insert(accessEvents).values({
      eventId: event.id,
      invitationId,
      actorUserId: user.id,
      type: "invitation_email_sent",
      metadata: {
        email: typeof payload.to === "string" ? payload.to : null,
        retried: true,
      },
    });
  }

  revalidatePath(`/admin/events/${event.id}/teams`);
  redirect(`/admin/events/${event.id}/teams?notice=email-retried`);
}

export async function removeManagerAction(formData: FormData) {
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      teamId: z.string().uuid(),
      userId: z.string().uuid(),
    })
    .safeParse({
      eventId: formData.get("eventId"),
      teamId: formData.get("teamId"),
      userId: formData.get("userId"),
    });

  if (!parsed.success) {
    redirect("/admin?error=invalid-request");
  }

  const { user, event } = await requireEventOwner(parsed.data.eventId);
  const { teamId, userId } = parsed.data;

  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionStatus: competitions.status,
    })
    .from(teams)
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(and(eq(teams.id, teamId), eq(competitions.eventId, event.id)))
    .limit(1);

  if (!team) {
    redirect(`/admin/events/${event.id}/teams?error=team-not-found`);
  }

  if (team.competitionStatus === "cancelled") {
    redirect(`/admin/events/${event.id}/teams?error=competition-cancelled`);
  }

  const removed = await db
    .delete(teamManagers)
    .where(
      and(eq(teamManagers.teamId, team.id), eq(teamManagers.userId, userId)),
    )
    .returning({ id: teamManagers.id });

  if (!removed.length) {
    redirect(`/admin/events/${event.id}/teams?notice=manager-removed`);
  }

  await db.insert(accessEvents).values({
    eventId: event.id,
    teamId: team.id,
    actorUserId: user.id,
    subjectUserId: userId,
    type: "manager_removed",
    metadata: { team: team.name },
  });

  await db.insert(auditEvents).values({
    eventId: event.id,
    actorUserId: user.id,
    type: "manager.removed",
    entityType: "team",
    entityId: team.id,
    summary: `Team Manager removed from ${team.name}.`,
    metadata: { userId },
  });

  revalidatePath(`/admin/events/${event.id}/teams`);
  redirect(`/admin/events/${event.id}/teams?notice=manager-removed`);
}

function safeInvitationReturnPath(value: FormDataEntryValue | null, token: string) {
  if (
    typeof value === "string" &&
    (value === "/invitations/redeem" ||
      /^\/invitations\/[A-Za-z0-9_-]+$/.test(value))
  ) {
    return value;
  }
  return `/invitations/${token}`;
}

export async function beginInvitationSignInAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!looksLikeInvitationToken(token)) {
    redirect("/invitations/redeem?error=not-found");
  }

  const view = await getInvitationViewByToken(token);
  if (!view) {
    redirect(`/invitations/${token}?error=not-found`);
  }

  const cookieStore = await cookies();
  cookieStore.set(INVITATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: INVITATION_COOKIE_MAX_AGE_SECONDS,
  });

  redirect(`/signin?callbackUrl=${encodeURIComponent("/invitations/redeem")}`);
}

export async function switchInvitationAccountAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (looksLikeInvitationToken(token)) {
    const cookieStore = await cookies();
    cookieStore.set(INVITATION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: INVITATION_COOKIE_MAX_AGE_SECONDS,
    });
  }

  await signOut({
    redirectTo: `/signin?callbackUrl=${encodeURIComponent("/invitations/redeem")}`,
  });
}

export async function acceptInvitationAction(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const returnPath = safeInvitationReturnPath(
    formData.get("returnPath"),
    token,
  );
  const user = await getCurrentUser();

  if (!user) {
    const cookieStore = await cookies();
    if (looksLikeInvitationToken(token)) {
      cookieStore.set(INVITATION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: INVITATION_COOKIE_MAX_AGE_SECONDS,
      });
    }
    redirect(`/signin?callbackUrl=${encodeURIComponent("/invitations/redeem")}`);
  }

  const result = await redeemInvitation(token, user);

  if (!result.ok) {
    const errorCode = result.reason.replaceAll("_", "-");
    redirect(`${returnPath}?error=${errorCode}`);
  }

  const cookieStore = await cookies();
  cookieStore.delete(INVITATION_COOKIE);
  revalidatePath("/manage");
  redirect(`/manage?invitation=accepted&count=${result.teams.length}`);
}
