"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireTeamManager } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { competitions, participants, teams } from "@/lib/db/schema";
import { getRegistrationStatus } from "@/features/competitions/registration";

export type RosterActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
  participantId?: string;
};

function isRealIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

const participantSchema = z.object({
  teamId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dateOfBirth: z.string().refine(isRealIsoDate),
  shirtNumber: z.preprocess(
    (value) => (value === "" || value == null ? null : Number(value)),
    z.number().int().min(1).max(99).nullable(),
  ),
  position: z.preprocess(
    (value) =>
      value == null || value === "" ? null : String(value).trim().slice(0, 40),
    z.string().max(40).nullable(),
  ),
  isCaptain: z.preprocess(
    (value) => value === "on" || value === "true" || value === "1",
    z.boolean(),
  ),
});

function fieldErrorsFor(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || fieldErrors[field]) {
      continue;
    }
    if (field === "dateOfBirth") {
      fieldErrors[field] = "invalid_date";
    } else if (field === "shirtNumber") {
      fieldErrors[field] = "invalid_shirt";
    } else if (field === "firstName" || field === "lastName") {
      fieldErrors[field] = "required";
    } else {
      fieldErrors[field] = "invalid";
    }
  }
  return fieldErrors;
}

async function loadEditableTeam(teamId: string) {
  const { user } = await requireTeamManager(teamId);
  const [team] = await db
    .select({
      id: teams.id,
      name: teams.name,
      competitionId: competitions.id,
      competitionName: competitions.name,
      sport: competitions.sport,
      registrationState: competitions.registrationState,
      registrationDeadline: competitions.registrationDeadline,
      drawGeneratedAt: competitions.drawGeneratedAt,
      status: competitions.status,
      rosterMin: competitions.rosterMin,
      rosterMax: competitions.rosterMax,
      birthDateFrom: competitions.birthDateFrom,
      birthDateTo: competitions.birthDateTo,
    })
    .from(teams)
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    return null;
  }

  return {
    user,
    team,
    registration: getRegistrationStatus(team),
  };
}

function birthDateAllowed(
  dateOfBirth: string,
  from: string | null,
  to: string | null,
) {
  if (from && dateOfBirth < from) {
    return false;
  }
  if (to && dateOfBirth > to) {
    return false;
  }
  return true;
}

async function findDuplicateParticipant(input: {
  competitionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  excludeId?: string;
}) {
  const [duplicate] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.competitionId, input.competitionId),
        sql`lower(${participants.firstName}) = lower(${input.firstName})`,
        sql`lower(${participants.lastName}) = lower(${input.lastName})`,
        eq(participants.dateOfBirth, input.dateOfBirth),
        input.excludeId
          ? sql`${participants.id} <> ${input.excludeId}`
          : sql`true`,
      ),
    )
    .limit(1);

  return Boolean(duplicate);
}

export async function addParticipantAction(
  _previous: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const parsed = participantSchema.safeParse({
    teamId: formData.get("teamId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    shirtNumber: formData.get("shirtNumber"),
    position: formData.get("position"),
    isCaptain: formData.get("isCaptain"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: fieldErrorsFor(parsed.error),
    };
  }

  const context = await loadEditableTeam(parsed.data.teamId);
  if (!context) {
    return { status: "error", code: "team_not_found" };
  }

  if (context.team.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (!context.registration.open) {
    return { status: "error", code: "registration_closed" };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participants)
    .where(eq(participants.teamId, context.team.id));

  if (context.team.sport === "tennis" && count >= 1) {
    return { status: "error", code: "tennis_single_participant" };
  }

  if (context.team.rosterMax != null && count >= context.team.rosterMax) {
    return {
      status: "error",
      code: "roster_maximum",
      fieldErrors: { roster: "roster_maximum" },
    };
  }

  if (
    !birthDateAllowed(
      parsed.data.dateOfBirth,
      context.team.birthDateFrom,
      context.team.birthDateTo,
    )
  ) {
    return {
      status: "error",
      code: "birth_range",
      fieldErrors: { dateOfBirth: "birth_range" },
    };
  }

  if (
    await findDuplicateParticipant({
      competitionId: context.team.competitionId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
    })
  ) {
    return {
      status: "error",
      code: "duplicate_participant",
      fieldErrors: { participant: "duplicate_participant" },
    };
  }

  try {
    const [created] = await db
      .insert(participants)
      .values({
        competitionId: context.team.competitionId,
        teamId: context.team.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth,
        shirtNumber: parsed.data.shirtNumber,
        position: parsed.data.position,
        isCaptain: parsed.data.isCaptain,
      })
      .returning({ id: participants.id });

    revalidatePath(`/manage/teams/${context.team.id}`);
    revalidatePath("/manage");

    return {
      status: "success",
      code: "participant_added",
      participantId: created?.id,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        status: "error",
        code: "duplicate_participant",
        fieldErrors: { participant: "duplicate_participant" },
      };
    }
    return { status: "error", code: "action_failed" };
  }
}

export async function updateParticipantAction(
  _previous: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const participantId = String(formData.get("participantId") ?? "");
  const parsed = participantSchema.safeParse({
    teamId: formData.get("teamId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    dateOfBirth: formData.get("dateOfBirth"),
    shirtNumber: formData.get("shirtNumber"),
    position: formData.get("position"),
    isCaptain: formData.get("isCaptain"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: fieldErrorsFor(parsed.error),
    };
  }

  const context = await loadEditableTeam(parsed.data.teamId);
  if (!context) {
    return { status: "error", code: "team_not_found" };
  }

  if (context.team.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (!context.registration.open) {
    return { status: "error", code: "registration_closed" };
  }

  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.teamId, context.team.id),
      ),
    )
    .limit(1);

  if (!participant) {
    return { status: "error", code: "participant_not_found" };
  }

  if (
    !birthDateAllowed(
      parsed.data.dateOfBirth,
      context.team.birthDateFrom,
      context.team.birthDateTo,
    )
  ) {
    return {
      status: "error",
      code: "birth_range",
      fieldErrors: { dateOfBirth: "birth_range" },
    };
  }

  if (
    await findDuplicateParticipant({
      competitionId: context.team.competitionId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      dateOfBirth: parsed.data.dateOfBirth,
      excludeId: participant.id,
    })
  ) {
    return {
      status: "error",
      code: "duplicate_participant",
      fieldErrors: { participant: "duplicate_participant" },
    };
  }

  try {
    await db
      .update(participants)
      .set({
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        dateOfBirth: parsed.data.dateOfBirth,
        shirtNumber: parsed.data.shirtNumber,
        position: parsed.data.position,
        isCaptain: parsed.data.isCaptain,
      })
      .where(
        and(
          eq(participants.id, participant.id),
          eq(participants.teamId, context.team.id),
        ),
      );

    revalidatePath(`/manage/teams/${context.team.id}`);
    revalidatePath("/manage");

    return { status: "success", code: "participant_updated" };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return {
        status: "error",
        code: "duplicate_participant",
        fieldErrors: { participant: "duplicate_participant" },
      };
    }
    return { status: "error", code: "action_failed" };
  }
}

export async function removeParticipantAction(
  _previous: RosterActionState,
  formData: FormData,
): Promise<RosterActionState> {
  const teamId = String(formData.get("teamId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const context = await loadEditableTeam(teamId);

  if (!context) {
    return { status: "error", code: "team_not_found" };
  }

  if (context.team.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (!context.registration.open) {
    return { status: "error", code: "registration_closed" };
  }

  const [participant] = await db
    .select({ id: participants.id })
    .from(participants)
    .where(
      and(
        eq(participants.id, participantId),
        eq(participants.teamId, context.team.id),
      ),
    )
    .limit(1);

  if (!participant) {
    return { status: "error", code: "participant_not_found" };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(participants)
    .where(eq(participants.teamId, context.team.id));

  if (context.team.rosterMin != null && count <= context.team.rosterMin) {
    return {
      status: "error",
      code: "roster_minimum",
      fieldErrors: { roster: "roster_minimum" },
    };
  }

  await db
    .delete(participants)
    .where(
      and(
        eq(participants.id, participant.id),
        eq(participants.teamId, context.team.id),
      ),
    );

  revalidatePath(`/manage/teams/${context.team.id}`);
  revalidatePath("/manage");

  return { status: "success", code: "participant_removed" };
}
