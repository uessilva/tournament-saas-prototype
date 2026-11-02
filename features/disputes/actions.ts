"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  disputes,
  matches,
  resultVersions,
  teamManagers,
} from "@/lib/db/schema";

export type DisputeActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
  disputeId?: string;
};

const explanationSchema = z
  .string()
  .trim()
  .min(10, "explanation_too_short")
  .max(4000, "explanation_too_long");

const openDisputeSchema = z.object({
  matchId: z.string().uuid(),
  teamId: z.string().uuid().optional().or(z.literal("")),
  explanation: explanationSchema,
});

const resolveDisputeSchema = z.object({
  disputeId: z.string().uuid(),
  resolution: z.enum(["resolved", "dismissed"]),
  response: z
    .string()
    .trim()
    .min(10, "response_too_short")
    .max(4000, "response_too_long"),
  correctionResultVersionId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("")),
});

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function revalidateDisputePaths(eventId: string) {
  revalidatePath("/admin/events/" + eventId);
  revalidatePath(`/admin/events/${eventId}/disputes`);
  revalidatePath("/manage");
  revalidatePath("/manage/matches");
}

/**
 * A Manager of an involved Team opens one active dispute on a published Match.
 * The public result and Match state are never touched here.
 */
export async function openDisputeAction(
  _previous: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", code: "unauthorized" };
  }

  const parsed = openDisputeSchema.safeParse({
    matchId: String(formData.get("matchId") ?? ""),
    teamId: String(formData.get("teamId") ?? ""),
    explanation: String(formData.get("explanation") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      code: "invalid_input",
      fieldErrors,
    };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, parsed.data.matchId),
    with: {
      competition: { with: { event: true } },
      entries: true,
    },
  });

  if (!match || !match.competition) {
    return { status: "error", code: "match_not_found" };
  }

  if (
    match.status !== "published" ||
    match.isBye ||
    match.competition.status === "cancelled"
  ) {
    return { status: "error", code: "requires_published_match" };
  }

  const involvedTeamIds = match.entries.map((entry) => entry.teamId);
  if (!involvedTeamIds.length) {
    return { status: "error", code: "match_not_found" };
  }

  const assignments = await db
    .select({ teamId: teamManagers.teamId })
    .from(teamManagers)
    .where(
      and(
        eq(teamManagers.userId, user.id),
        inArray(teamManagers.teamId, involvedTeamIds),
      ),
    );

  const managedTeamIds = new Set(assignments.map((row) => row.teamId));
  const requestedTeamId = parsed.data.teamId || null;

  let teamId: string | null = null;
  if (requestedTeamId) {
    teamId = managedTeamIds.has(requestedTeamId) ? requestedTeamId : null;
  } else {
    teamId = involvedTeamIds.find((id) => managedTeamIds.has(id)) ?? null;
  }

  if (!teamId) {
    return { status: "error", code: "forbidden" };
  }

  const [existing] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(and(eq(disputes.matchId, match.id), eq(disputes.status, "open")))
    .limit(1);

  if (existing) {
    return { status: "error", code: "duplicate_active" };
  }

  try {
    const dispute = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(disputes)
        .values({
          matchId: match.id,
          teamId,
          openedByUserId: user.id,
          status: "open",
          explanation: parsed.data.explanation,
        })
        .returning({ id: disputes.id });

      if (!created) {
        throw new Error("dispute_insert_failed");
      }

      await tx.insert(auditEvents).values({
        eventId: match.competition.eventId,
        actorUserId: user.id,
        type: "dispute.opened",
        entityType: "dispute",
        entityId: created.id,
        summary: `Private dispute opened for Match #${match.matchNumber}.`,
        metadata: {
          matchId: match.id,
          teamId,
          disputeId: created.id,
          private: true,
        },
      });

      return created;
    });

    revalidateDisputePaths(match.competition.eventId);
    return { status: "success", code: "opened", disputeId: dispute.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: "error", code: "duplicate_active" };
    }
    return { status: "error", code: "action_failed" };
  }
}

/**
 * Only the Event Owner can close a dispute. The response is mandatory and the
 * optional correction link must already be a later reasoned result version;
 * resolving never creates a correction itself.
 */
export async function resolveDisputeAction(
  _previous: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  const user = await getCurrentUser();
  if (!user) {
    return { status: "error", code: "unauthorized" };
  }

  const parsed = resolveDisputeSchema.safeParse({
    disputeId: String(formData.get("disputeId") ?? ""),
    resolution: String(formData.get("resolution") ?? ""),
    response: String(formData.get("response") ?? ""),
    correctionResultVersionId: String(
      formData.get("correctionResultVersionId") ?? "",
    ),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      status: "error",
      code: "invalid_input",
      fieldErrors,
    };
  }

  const dispute = await db.query.disputes.findFirst({
    where: eq(disputes.id, parsed.data.disputeId),
    with: {
      match: {
        with: {
          competition: { with: { event: true } },
        },
      },
    },
  });

  if (!dispute || !dispute.match || !dispute.match.competition) {
    return { status: "error", code: "dispute_not_found" };
  }

  const event = dispute.match.competition.event;
  if (event.ownerId !== user.id) {
    return { status: "error", code: "forbidden" };
  }

  if (dispute.match.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (dispute.status !== "open") {
    return { status: "error", code: "already_closed" };
  }

  const status = parsed.data.resolution;
  const correctionId = parsed.data.correctionResultVersionId || null;
  if (status === "resolved" && correctionId) {
    const [correction] = await db
      .select({
        id: resultVersions.id,
        reason: resultVersions.reason,
      })
      .from(resultVersions)
      .where(
        and(
          eq(resultVersions.id, correctionId),
          eq(resultVersions.matchId, dispute.matchId),
        ),
      )
      .limit(1);

    if (!correction || correction.reason?.trim().length === 0) {
      return {
        status: "error",
        code: "invalid_correction",
        fieldErrors: {
          correctionResultVersionId: "invalid_correction",
        },
      };
    }

    const [version] = await db
      .select({ version: resultVersions.version })
      .from(resultVersions)
      .where(eq(resultVersions.id, correctionId))
      .limit(1);

    if (!version || version.version <= 1) {
      return {
        status: "error",
        code: "invalid_correction",
        fieldErrors: {
          correctionResultVersionId: "invalid_correction",
        },
      };
    }
  }

  const now = new Date();

  try {
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(disputes)
        .set({
          status,
          response: parsed.data.response,
          resolvedByUserId: user.id,
          resolvedAt: now,
          correctionResultVersionId:
            status === "resolved" ? correctionId : null,
        })
        .where(
          and(eq(disputes.id, dispute.id), eq(disputes.status, "open")),
        )
        .returning({ id: disputes.id });

      if (!updated) {
        throw new Error("dispute_already_closed");
      }

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: user.id,
        type: status === "resolved" ? "dispute.resolved" : "dispute.dismissed",
        entityType: "dispute",
        entityId: dispute.id,
        summary:
          status === "resolved"
            ? `Private dispute for Match #${dispute.match!.matchNumber} upheld.`
            : `Private dispute for Match #${dispute.match!.matchNumber} dismissed.`,
        metadata: {
          matchId: dispute.matchId,
          teamId: dispute.teamId,
          disputeId: dispute.id,
          correctionResultVersionId:
            status === "resolved" ? correctionId : null,
          private: true,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "dispute_already_closed"
    ) {
      return { status: "error", code: "already_closed" };
    }
    return { status: "error", code: "action_failed" };
  }

  revalidateDisputePaths(event.id);
  return { status: "success", code: status };
}
