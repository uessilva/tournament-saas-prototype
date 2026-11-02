"use server";

import { desc, eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { auditEvents, competitions, disputes, matches } from "@/lib/db/schema";
import {
  isCompetitionCancelled,
  restoreCompetitionStatus,
  type CompetitionStatus,
} from "@/features/competitions/lifecycle";

export type CompetitionLifecycleActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
};

function revalidateCompetitionLifecycle(input: {
  eventId: string;
  eventSlug: string;
  competitionId: string;
  competitionSlug: string;
}) {
  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath(
    `/admin/events/${input.eventId}/competitions/${input.competitionId}`,
  );
  revalidatePath(`/admin/events/${input.eventId}/schedule`);
  revalidatePath(`/admin/events/${input.eventId}/review`);
  revalidatePath("/manage");
  revalidatePath("/manage/matches");
  revalidatePath(`/events/${input.eventSlug}`);
  revalidatePath(`/events/${input.eventSlug}/fixtures`);
  revalidatePath(`/events/${input.eventSlug}/results`);
  revalidatePath(
    `/events/${input.eventSlug}/competitions/${input.competitionSlug}`,
  );
}

function fallbackCompetitionStatus(competition: {
  drawGeneratedAt: Date | null;
  registrationState: "open" | "closed";
}): CompetitionStatus {
  if (competition.drawGeneratedAt) {
    return "in_progress";
  }
  return competition.registrationState === "open"
    ? "registration_open"
    : "registration_closed";
}

export async function cancelCompetitionAction(
  _previous: CompetitionLifecycleActionState,
  formData: FormData,
): Promise<CompetitionLifecycleActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const publicNote = String(formData.get("publicNote") ?? "").trim();

  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(competitionId).success
  ) {
    return { status: "error", code: "action_failed" };
  }

  if (publicNote.length < 3 || publicNote.length > 1000) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { publicNote: "required" },
    };
  }

  if (formData.get("confirmed") !== "true") {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { confirmed: "required" },
    };
  }

  const { user, event } = await requireEventOwner(eventId);

  const result = await db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.id, competitionId),
          eq(competitions.eventId, event.id),
        ),
      )
      .for("update")
      .limit(1);

    if (!competition) {
      return { error: "action_failed" as const };
    }

    if (isCompetitionCancelled(competition.status)) {
      return { error: "competition_already_cancelled" as const };
    }

    const now = new Date();
    await tx
      .update(competitions)
      .set({
        status: "cancelled",
        publicNote,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(competitions.id, competition.id));

    await tx.insert(auditEvents).values({
      eventId: event.id,
      actorUserId: user.id,
      type: "competition.cancelled",
      entityType: "competition",
      entityId: competition.id,
      summary: `${competition.name} cancelled with a public note.`,
      metadata: {
        competitionId: competition.id,
        previousStatus: competition.status,
        publicNote,
        cancelledAt: now.toISOString(),
      },
    });

    return {
      eventSlug: event.slug,
      competitionSlug: competition.slug,
    };
  });

  if ("error" in result) {
    return { status: "error", code: result.error };
  }

  revalidateCompetitionLifecycle({
    eventId: event.id,
    eventSlug: result.eventSlug,
    competitionId,
    competitionSlug: result.competitionSlug,
  });
  return { status: "success", code: "competition_cancelled" };
}

export async function restoreCompetitionAction(
  _previous: CompetitionLifecycleActionState,
  formData: FormData,
): Promise<CompetitionLifecycleActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");

  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(competitionId).success
  ) {
    return { status: "error", code: "action_failed" };
  }

  const { user, event } = await requireEventOwner(eventId);

  const result = await db.transaction(async (tx) => {
    const [competition] = await tx
      .select()
      .from(competitions)
      .where(
        and(
          eq(competitions.id, competitionId),
          eq(competitions.eventId, event.id),
        ),
      )
      .for("update")
      .limit(1);

    if (!competition) {
      return { error: "action_failed" as const };
    }

    if (!isCompetitionCancelled(competition.status)) {
      return { error: "competition_not_cancelled" as const };
    }

    const [openDispute] = await tx
      .select({ id: disputes.id })
      .from(disputes)
      .innerJoin(matches, eq(disputes.matchId, matches.id))
      .where(
        and(
          eq(matches.competitionId, competition.id),
          eq(disputes.status, "open"),
        ),
      )
      .limit(1);

    if (openDispute) {
      return { error: "competition_restore_conflict" as const };
    }

    const [lastCancellation] = await tx
      .select({
        metadata: auditEvents.metadata,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventId, event.id),
          eq(auditEvents.type, "competition.cancelled"),
          eq(auditEvents.entityType, "competition"),
          eq(auditEvents.entityId, competition.id),
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);

    const previousStatus =
      (lastCancellation?.metadata as Record<string, unknown> | null)
        ?.previousStatus ?? null;
    const restoredStatus = restoreCompetitionStatus(
      previousStatus,
      fallbackCompetitionStatus(competition),
    );
    const now = new Date();

    await tx
      .update(competitions)
      .set({
        status: restoredStatus,
        publicNote: null,
        cancelledAt: null,
        updatedAt: now,
      })
      .where(eq(competitions.id, competition.id));

    await tx.insert(auditEvents).values({
      eventId: event.id,
      actorUserId: user.id,
      type: "competition.restored",
      entityType: "competition",
      entityId: competition.id,
      summary: `${competition.name} restored from cancellation.`,
      metadata: {
        competitionId: competition.id,
        previousStatus: competition.status,
        restoredStatus,
        previousPublicNote: competition.publicNote,
        cancelledAt: competition.cancelledAt?.toISOString() ?? null,
      },
    });

    return {
      eventSlug: event.slug,
      competitionSlug: competition.slug,
    };
  });

  if ("error" in result) {
    return { status: "error", code: result.error };
  }

  revalidateCompetitionLifecycle({
    eventId: event.id,
    eventSlug: result.eventSlug,
    competitionId,
    competitionSlug: result.competitionSlug,
  });
  return { status: "success", code: "competition_restored" };
}
