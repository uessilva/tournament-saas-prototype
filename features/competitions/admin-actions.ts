"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { auditEvents, competitions } from "@/lib/db/schema";
import { getRegistrationStatus } from "@/features/competitions/registration";
import { zonedDateTimeToUtc } from "@/lib/timezone";

export type CompetitionAdminActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
};

async function loadCompetition(eventId: string, competitionId: string) {
  if (!z.string().uuid().safeParse(competitionId).success) {
    return null;
  }

  const { user, event } = await requireEventOwner(eventId);
  const [competition] = await db
    .select()
    .from(competitions)
    .where(
      and(
        eq(competitions.id, competitionId),
        eq(competitions.eventId, event.id),
      ),
    )
    .limit(1);

  if (!competition) {
    return null;
  }

  return { user, event, competition };
}

function revalidateCompetition(eventId: string, competitionId: string) {
  revalidatePath(`/admin/events/${eventId}/competitions/${competitionId}`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath("/manage");
}

export async function registrationStateAction(
  previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  if (formData.get("intent") === "open") {
    return openRegistrationAction(previous, formData);
  }
  return closeRegistrationAction(previous, formData);
}

export async function deadlineAction(
  previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const intent = formData.get("intent");
  if (intent === "extend") {
    return extendDeadlineAction(previous, formData);
  }
  if (intent === "clear") {
    return clearDeadlineAction(previous, formData);
  }
  return saveDeadlineAction(previous, formData);
}

export async function closeRegistrationAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const context = await loadCompetition(eventId, competitionId);

  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  await db
    .update(competitions)
    .set({
      registrationState: "closed",
      status:
        context.competition.status === "setup" ||
        context.competition.status === "registration_open"
          ? "registration_closed"
          : context.competition.status,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.registration_closed",
    entityType: "competition",
    entityId: context.competition.id,
    summary: `${context.competition.name} registration closed manually.`,
    metadata: { competitionId: context.competition.id },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  return { status: "success", code: "registration_closed" };
}

export async function openRegistrationAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const context = await loadCompetition(eventId, competitionId);

  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  if (context.competition.drawGeneratedAt) {
    return { status: "error", code: "reopen_after_generation" };
  }

  const registration = getRegistrationStatus(context.competition);
  if (registration.deadlinePassed) {
    return { status: "error", code: "deadline_passed" };
  }

  await db
    .update(competitions)
    .set({
      registrationState: "open",
      status:
        context.competition.status === "setup" ||
        context.competition.status === "registration_closed"
          ? "registration_open"
          : context.competition.status,
      updatedAt: new Date(),
    })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.registration_opened",
    entityType: "competition",
    entityId: context.competition.id,
    summary: `${context.competition.name} registration reopened manually.`,
    metadata: { competitionId: context.competition.id },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  return { status: "success", code: "registration_opened" };
}

export async function saveDeadlineAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const rawDeadline = String(formData.get("deadline") ?? "").trim();
  const context = await loadCompetition(eventId, competitionId);

  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  let deadline: Date | null = null;
  if (rawDeadline) {
    deadline = zonedDateTimeToUtc(rawDeadline, context.event.timezone);
    if (!deadline) {
      return {
        status: "error",
        code: "fix_errors",
        fieldErrors: { deadline: "invalid" },
      };
    }
  }

  await db
    .update(competitions)
    .set({ registrationDeadline: deadline, updatedAt: new Date() })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.registration_deadline_updated",
    entityType: "competition",
    entityId: context.competition.id,
    summary: deadline
      ? `${context.competition.name} registration deadline set to ${deadline.toISOString()}.`
      : `${context.competition.name} registration deadline removed.`,
    metadata: {
      competitionId: context.competition.id,
      deadline: deadline?.toISOString() ?? null,
    },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  return { status: "success", code: "deadline_saved" };
}

export async function extendDeadlineAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const context = await loadCompetition(eventId, competitionId);

  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  const now = new Date();
  const base =
    context.competition.registrationDeadline &&
    context.competition.registrationDeadline.getTime() > now.getTime()
      ? context.competition.registrationDeadline
      : now;
  const deadline = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db
    .update(competitions)
    .set({ registrationDeadline: deadline, updatedAt: new Date() })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.registration_deadline_extended",
    entityType: "competition",
    entityId: context.competition.id,
    summary: `${context.competition.name} registration deadline extended by seven days.`,
    metadata: {
      competitionId: context.competition.id,
      deadline: deadline.toISOString(),
    },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  return { status: "success", code: "deadline_extended" };
}

export async function clearDeadlineAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const context = await loadCompetition(eventId, competitionId);

  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  await db
    .update(competitions)
    .set({ registrationDeadline: null, updatedAt: new Date() })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.registration_deadline_removed",
    entityType: "competition",
    entityId: context.competition.id,
    summary: `${context.competition.name} registration deadline removed.`,
    metadata: { competitionId: context.competition.id },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  return { status: "success", code: "deadline_cleared" };
}
