"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  events,
  matches,
  resultVersions,
  scoresheets,
} from "@/lib/db/schema";
import {
  fallbackMatchRestoreStatus,
  isCompetitionCancelled,
  isMatchCancellable,
  isMatchCancelled,
  restoreMatchStatus,
} from "@/features/competitions/lifecycle";

export type MatchCancellationActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
};

function revalidateCancelledMatch(input: {
  eventId: string;
  eventSlug: string;
  competitionId: string;
  competitionSlug: string;
  matchId: string;
}) {
  revalidatePath(`/admin/events/${input.eventId}`);
  revalidatePath(
    `/admin/events/${input.eventId}/competitions/${input.competitionId}`,
  );
  revalidatePath(`/admin/events/${input.eventId}/schedule`);
  revalidatePath(`/admin/events/${input.eventId}/review`);
  revalidatePath(`/admin/events/${input.eventId}/review/${input.matchId}`);
  revalidatePath("/manage");
  revalidatePath("/manage/matches");
  revalidatePath(`/events/${input.eventSlug}`);
  revalidatePath(`/events/${input.eventSlug}/fixtures`);
  revalidatePath(`/events/${input.eventSlug}/results`);
  revalidatePath(
    `/events/${input.eventSlug}/competitions/${input.competitionSlug}`,
  );
}

export async function cancelMatchAction(
  _previous: MatchCancellationActionState,
  formData: FormData,
): Promise<MatchCancellationActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(matchId).success
  ) {
    return { status: "error", code: "action_failed" };
  }

  if (reason.length < 3 || reason.length > 1000) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { reason: "required" },
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
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { error: "match_not_found" as const };
    }

    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, match.competitionId))
      .limit(1);

    if (!competition || competition.eventId !== event.id) {
      return { error: "match_not_found" as const };
    }

    if (isCompetitionCancelled(competition.status)) {
      return { error: "competition_cancelled" as const };
    }

    if (isMatchCancelled(match.status)) {
      return { error: "match_already_cancelled" as const };
    }

    const [currentResult] = await tx
      .select({ id: resultVersions.id })
      .from(resultVersions)
      .where(
        and(
          eq(resultVersions.matchId, match.id),
          eq(resultVersions.isCurrent, true),
        ),
      )
      .limit(1);

    if (
      !isMatchCancellable({
        status: match.status,
        isBye: match.isBye,
        hasCurrentResult: Boolean(currentResult),
      })
    ) {
      return { error: "match_has_result" as const };
    }

    const now = new Date();
    await tx
      .update(matches)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancellationReason: reason,
        updatedAt: now,
      })
      .where(eq(matches.id, match.id));

    await tx.insert(auditEvents).values({
      eventId: event.id,
      actorUserId: user.id,
      type: "match.cancelled",
      entityType: "match",
      entityId: match.id,
      summary: `Match #${match.matchNumber} cancelled with an internal reason.`,
      metadata: {
        competitionId: competition.id,
        matchId: match.id,
        matchNumber: match.matchNumber,
        previousStatus: match.status,
        reason,
        cancelledAt: now.toISOString(),
      },
    });

    return {
      eventSlug: event.slug,
      competitionId: competition.id,
      competitionSlug: competition.slug,
    };
  });

  if ("error" in result) {
    return { status: "error", code: result.error };
  }

  revalidateCancelledMatch({
    eventId: event.id,
    eventSlug: result.eventSlug,
    competitionId: result.competitionId,
    competitionSlug: result.competitionSlug,
    matchId,
  });
  return { status: "success", code: "match_cancelled" };
}

export async function restoreMatchAction(
  _previous: MatchCancellationActionState,
  formData: FormData,
): Promise<MatchCancellationActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");

  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(matchId).success
  ) {
    return { status: "error", code: "action_failed" };
  }

  const { user, event } = await requireEventOwner(eventId);

  const result = await db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .for("update")
      .limit(1);

    if (!match) {
      return { error: "match_not_found" as const };
    }

    const [competition] = await tx
      .select()
      .from(competitions)
      .where(eq(competitions.id, match.competitionId))
      .limit(1);

    if (!competition || competition.eventId !== event.id) {
      return { error: "match_not_found" as const };
    }

    if (!isMatchCancelled(match.status)) {
      return { error: "match_not_cancelled" as const };
    }

    if (isCompetitionCancelled(competition.status)) {
      return { error: "competition_cancelled" as const };
    }

    const [currentResult] = await tx
      .select({ id: resultVersions.id })
      .from(resultVersions)
      .where(
        and(
          eq(resultVersions.matchId, match.id),
          eq(resultVersions.isCurrent, true),
        ),
      )
      .limit(1);

    if (currentResult) {
      return { error: "match_restore_conflict" as const };
    }

    const [lastCancellation] = await tx
      .select({ metadata: auditEvents.metadata })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.eventId, event.id),
          eq(auditEvents.type, "match.cancelled"),
          eq(auditEvents.entityType, "match"),
          eq(auditEvents.entityId, match.id),
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(1);

    const sheetRows = await tx
      .select({ isActive: scoresheets.isActive })
      .from(scoresheets)
      .where(eq(scoresheets.matchId, match.id));

    const fallback = fallbackMatchRestoreStatus({
      hasActiveScoresheet: sheetRows.some((sheet) => sheet.isActive),
      hasAnyScoresheet: sheetRows.length > 0,
    });
    const restoredStatus = restoreMatchStatus(
      (lastCancellation?.metadata as Record<string, unknown> | null)
        ?.previousStatus,
      fallback,
    );
    const now = new Date();

    await tx
      .update(matches)
      .set({
        status: restoredStatus,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: now,
      })
      .where(eq(matches.id, match.id));

    await tx.insert(auditEvents).values({
      eventId: event.id,
      actorUserId: user.id,
      type: "match.restored",
      entityType: "match",
      entityId: match.id,
      summary: `Match #${match.matchNumber} restored from cancellation.`,
      metadata: {
        competitionId: competition.id,
        matchId: match.id,
        matchNumber: match.matchNumber,
        previousStatus: match.status,
        restoredStatus,
        previousReason: match.cancellationReason,
        cancelledAt: match.cancelledAt?.toISOString() ?? null,
      },
    });

    return {
      eventSlug: event.slug,
      competitionId: competition.id,
      competitionSlug: competition.slug,
    };
  });

  if ("error" in result) {
    return { status: "error", code: result.error };
  }

  revalidateCancelledMatch({
    eventId: event.id,
    eventSlug: result.eventSlug,
    competitionId: result.competitionId,
    competitionSlug: result.competitionSlug,
    matchId,
  });
  return { status: "success", code: "match_restored" };
}
