"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  matches,
  resultVersions,
  teams,
} from "@/lib/db/schema";
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

function cancelledCompetitionError(): CompetitionAdminActionState {
  return { status: "error", code: "competition_cancelled" };
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

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
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

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
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

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
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

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
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

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
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

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

const optionalRosterSchema = z.preprocess(
  (value) => (value === "" || value == null ? null : Number(value)),
  z.number().int().min(1).max(99).nullable(),
);

const configurationSchema = z.object({
  eventId: z.string().uuid(),
  competitionId: z.string().uuid(),
  sport: z.enum(["football", "tennis"]),
  birthDateFrom: z.string().trim(),
  birthDateTo: z.string().trim(),
  rosterMin: optionalRosterSchema,
  rosterMax: optionalRosterSchema,
  defaultMatchDurationMinutes: z.coerce.number().int().min(1).max(600),
});

function revalidatePublicCompetition(
  eventSlug: string,
  competitionSlug: string,
) {
  revalidatePath(`/events/${eventSlug}`);
  revalidatePath(`/events/${eventSlug}/fixtures`);
  revalidatePath(`/events/${eventSlug}/results`);
  revalidatePath(`/events/${eventSlug}/standings`);
  revalidatePath(`/events/${eventSlug}/leaders`);
  revalidatePath(`/events/${eventSlug}/competitions/${competitionSlug}`);
}

export async function saveCompetitionConfigurationAction(
  _previous: CompetitionAdminActionState,
  formData: FormData,
): Promise<CompetitionAdminActionState> {
  const parsed = configurationSchema.safeParse({
    eventId: formData.get("eventId"),
    competitionId: formData.get("competitionId"),
    sport: formData.get("sport"),
    birthDateFrom: formData.get("birthDateFrom"),
    birthDateTo: formData.get("birthDateTo"),
    rosterMin: formData.get("rosterMin"),
    rosterMax: formData.get("rosterMax"),
    defaultMatchDurationMinutes: formData.get("defaultMatchDurationMinutes"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field]) {
        fieldErrors[field] =
          field === "defaultMatchDurationMinutes"
            ? "duration_invalid"
            : "invalid";
      }
    }
    return { status: "error", code: "fix_errors", fieldErrors };
  }

  const input = parsed.data;
  const birthDateFrom = input.birthDateFrom || null;
  const birthDateTo = input.birthDateTo || null;

  if (
    (birthDateFrom && !isIsoDate(birthDateFrom)) ||
    (birthDateTo && !isIsoDate(birthDateTo))
  ) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: {
        ...(birthDateFrom ? { birthDateFrom: "invalid" } : {}),
        ...(birthDateTo ? { birthDateTo: "invalid" } : {}),
      },
    };
  }

  if (birthDateFrom && birthDateTo && birthDateFrom > birthDateTo) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { birthDateTo: "before_from" },
    };
  }

  if (
    input.rosterMin != null &&
    input.rosterMax != null &&
    input.rosterMin > input.rosterMax
  ) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { rosterMax: "before_min" },
    };
  }

  const context = await loadCompetition(input.eventId, input.competitionId);
  if (!context) {
    return { status: "error", code: "action_failed" };
  }

  if (context.competition.status === "cancelled") {
    return cancelledCompetitionError();
  }

  const sportChanged = input.sport !== context.competition.sport;
  if (sportChanged) {
    const [entrant] = await db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.competitionId, context.competition.id))
      .limit(1);
    if (entrant) {
      return { status: "error", code: "sport_locked" };
    }
  }

  const eligibilityChanged =
    birthDateFrom !== context.competition.birthDateFrom ||
    birthDateTo !== context.competition.birthDateTo ||
    input.rosterMin !== context.competition.rosterMin ||
    input.rosterMax !== context.competition.rosterMax;

  const [confirmedResult] = await db
    .select({ id: resultVersions.id })
    .from(resultVersions)
    .innerJoin(matches, eq(resultVersions.matchId, matches.id))
    .where(
      and(
        eq(matches.competitionId, context.competition.id),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .limit(1);

  if (eligibilityChanged && context.competition.drawGeneratedAt) {
    return { status: "error", code: "configuration_locked" };
  }

  if (
    input.defaultMatchDurationMinutes !==
      context.competition.defaultMatchDurationMinutes &&
    confirmedResult
  ) {
    return { status: "error", code: "configuration_locked" };
  }

  const now = new Date();
  await db
    .update(competitions)
    .set({
      sport: input.sport,
      birthDateFrom,
      birthDateTo,
      rosterMin: input.rosterMin,
      rosterMax: input.rosterMax,
      defaultMatchDurationMinutes: input.defaultMatchDurationMinutes,
      updatedAt: now,
    })
    .where(eq(competitions.id, context.competition.id));

  await db.insert(auditEvents).values({
    eventId: context.event.id,
    actorUserId: context.user.id,
    type: "competition.configuration_updated",
    entityType: "competition",
    entityId: context.competition.id,
    summary: `${context.competition.name} configuration updated.`,
    metadata: {
      competitionId: context.competition.id,
      previous: {
        sport: context.competition.sport,
        birthDateFrom: context.competition.birthDateFrom,
        birthDateTo: context.competition.birthDateTo,
        rosterMin: context.competition.rosterMin,
        rosterMax: context.competition.rosterMax,
        defaultMatchDurationMinutes:
          context.competition.defaultMatchDurationMinutes,
      },
      next: {
        sport: input.sport,
        birthDateFrom,
        birthDateTo,
        rosterMin: input.rosterMin,
        rosterMax: input.rosterMax,
        defaultMatchDurationMinutes: input.defaultMatchDurationMinutes,
      },
    },
  });

  revalidateCompetition(context.event.id, context.competition.id);
  revalidatePublicCompetition(context.event.slug, context.competition.slug);
  return { status: "success", code: "configuration_saved" };
}
