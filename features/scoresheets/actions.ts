"use server";

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentUser, requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  events,
  extractedFields,
  matches,
  scoresheets,
  teamManagers,
} from "@/lib/db/schema";
import { completeJob, enqueueJob, failJob } from "@/lib/jobs/queue";
import { processJob } from "@/lib/jobs/handlers";
import { assertDemoMode, isDemoMode } from "@/lib/demo-mode";
import { scoresheetStorageKey, storage } from "@/lib/storage";
import { buildDemoScoresheetPdf, FOOTBALL_TEMPLATE_VERSION, scoresheetIdentityForMatch, type FootballScoresheetInput } from "./template";
import {
  publishFootballResult,
  ResultPublicationError,
  validateFootballResult,
  type FootballResultInput,
} from "@/features/results/publication";

export type ScoresheetActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
  scoresheetId?: string;
};

const MAX_PDF_BYTES = 12 * 1024 * 1024;

type MatchContext = {
  match: typeof matches.$inferSelect;
  competition: typeof competitions.$inferSelect;
  event: typeof events.$inferSelect;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
};

async function loadMatchContext(matchId: string): Promise<MatchContext | null> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      matchId,
    )
  ) {
    return null;
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      competition: { with: { event: true } },
      entries: { with: { team: true } },
    },
  });

  if (!match || !match.competition) {
    return null;
  }

  const home = match.entries.find((entry) => entry.side === "home");
  const away = match.entries.find((entry) => entry.side === "away");
  if (!home || !away) {
    return null;
  }

  return {
    match,
    competition: match.competition,
    event: match.competition.event,
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    homeTeamName: home.team?.name ?? "Casa",
    awayTeamName: away.team?.name ?? "Visitante",
  };
}

async function authorizeMatch(matchId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "unauthorized" as const };
  }

  const context = await loadMatchContext(matchId);
  if (!context) {
    return { error: "match_not_found" as const };
  }

  const isOwner = context.event.ownerId === user.id;
  let isManager = false;

  if (!isOwner) {
    const assignment = await db
      .select({ id: teamManagers.id })
      .from(teamManagers)
      .where(
        and(
          eq(teamManagers.userId, user.id),
          inArray(teamManagers.teamId, [
            context.homeTeamId,
            context.awayTeamId,
          ]),
        ),
      )
      .limit(1);
    isManager = assignment.length > 0;
  }

  if (!isOwner && !isManager) {
    return { error: "forbidden" as const };
  }

  return { user, context, isOwner, isManager };
}

function revalidateResults(context: MatchContext) {
  revalidatePath(`/admin/events/${context.event.id}`);
  revalidatePath(`/admin/events/${context.event.id}/review`);
  revalidatePath(`/admin/events/${context.event.id}/review/${context.match.id}`);
  revalidatePath(`/manage/matches`);
  revalidatePath(`/events/${context.event.slug}`);
  revalidatePath(`/events/${context.event.slug}/fixtures`);
  revalidatePath(`/events/${context.event.slug}/results`);
  revalidatePath(
    `/events/${context.event.slug}/competitions/${context.competition.slug}`,
  );
}

function footballTemplateInput(context: MatchContext): FootballScoresheetInput {
  return {
    matchId: context.match.id,
    matchNumber: context.match.matchNumber,
    eventName: context.event.name,
    competitionName: context.competition.name,
    homeTeamName: context.homeTeamName,
    awayTeamName: context.awayTeamName,
    venueName: null,
    startsAt: context.match.startsAt,
    timezone: context.event.timezone,
  };
}

async function processUploadedScoresheet(scoresheetId: string) {
  const job = await enqueueJob({
    type: "scoresheet.extract",
    payload: { scoresheetId },
  });

  await db
    .update(scoresheets)
    .set({
      status: "processing",
      processingStartedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scoresheets.id, scoresheetId));

  try {
    await processJob(job);
    await completeJob(job.id);
    return { ok: true as const, jobId: job.id };
  } catch {
    await failJob(job, "Scoresheet extraction failed");
    return { ok: false as const, jobId: job.id };
  }
}

export async function uploadScoresheetAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const matchId = String(formData.get("matchId") ?? "");
  const intent = String(formData.get("intent") ?? "upload");
  const authorization = await authorizeMatch(matchId);

  if ("error" in authorization) {
    return { status: "error", code: authorization.error };
  }

  const { user, context, isOwner } = authorization;

  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "published" || context.match.status === "cancelled") {
    return { status: "error", code: "match_not_open" };
  }

  const active = await db
    .select({ id: scoresheets.id, status: scoresheets.status })
    .from(scoresheets)
    .where(
      and(eq(scoresheets.matchId, matchId), eq(scoresheets.isActive, true)),
    )
    .limit(1);

  if (
    active[0] &&
    ["uploaded", "processing", "needs_review", "confirmed"].includes(
      active[0].status,
    )
  ) {
    return { status: "error", code: "active_scoresheet_exists" };
  }

  let bytes: Uint8Array;
  let filename = "scoresheet.pdf";
  let mimeType = "application/pdf";

  if (intent === "demo_digital" || intent === "demo_scan") {
    if (!isOwner) {
      return { status: "error", code: "forbidden" };
    }
    if (!isDemoMode()) {
      return { status: "error", code: "demo_disabled" };
    }
    assertDemoMode();
    bytes = await buildDemoScoresheetPdf(
      footballTemplateInput(context),
      intent === "demo_scan" ? "scan" : "digital",
    );
    filename =
      intent === "demo_scan"
        ? "demo-scan-scoresheet.pdf"
        : "demo-digital-scoresheet.pdf";
  } else {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        status: "error",
        code: "fix_errors",
        fieldErrors: { file: "file_required" },
      };
    }
    if (
      file.size > MAX_PDF_BYTES ||
      (!file.name.toLowerCase().endsWith(".pdf") &&
        file.type !== "application/pdf")
    ) {
      return {
        status: "error",
        code: "fix_errors",
        fieldErrors: { file: "file_invalid" },
      };
    }
    bytes = new Uint8Array(await file.arrayBuffer());
    filename = file.name || "scoresheet.pdf";
    mimeType = file.type || "application/pdf";
  }

  const scoresheetId = randomUUID();
  const identity = scoresheetIdentityForMatch(context.match.id);
  const storageKey = scoresheetStorageKey(
    context.event.id,
    context.match.id,
    scoresheetId,
    filename,
  );

  await storage.put(storageKey, bytes);

  await db.transaction(async (tx) => {
    await tx.insert(scoresheets).values({
      id: scoresheetId,
      matchId: context.match.id,
      uploadedByUserId: user.id,
      storageKey,
      originalFilename: filename,
      mimeType,
      sizeBytes: bytes.byteLength,
      templateVersion: FOOTBALL_TEMPLATE_VERSION,
      qrSheetId: identity.sheetId,
      pageCount: 1,
      status: "uploaded",
      isActive: true,
    });

    await tx
      .update(matches)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(matches.id, context.match.id));

    await tx.insert(auditEvents).values({
      eventId: context.event.id,
      actorUserId: user.id,
      type: "scoresheet.uploaded",
      entityType: "scoresheet",
      entityId: scoresheetId,
      summary: `Scoresheet uploaded for match #${context.match.matchNumber}.`,
      metadata: { matchId: context.match.id, filename },
    });
  });

  const processed = await processUploadedScoresheet(scoresheetId);
  revalidateResults(context);

  if (!processed.ok) {
    return {
      status: "error",
      code: "extraction_failed",
      scoresheetId,
    };
  }

  return {
    status: "success",
    code: "scoresheet_needs_review",
    scoresheetId,
  };
}

function fieldValueFromForm(formData: FormData, fieldKey: string) {
  const value = formData.get(`field_${fieldKey}`);
  return typeof value === "string" ? value.trim() : "";
}

async function saveReviewFieldsInTransaction(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  scoresheetId: string,
  reviewerUserId: string,
  formData: FormData,
) {
  const fields = await tx
    .select()
    .from(extractedFields)
    .where(eq(extractedFields.scoresheetId, scoresheetId));
  const now = new Date();
  const edits: Array<{ fieldKey: string; from: string | null; to: string }> = [];

  for (const field of fields) {
    const rawValue = fieldValueFromForm(formData, field.fieldKey);
    const reviewedValue = rawValue.length ? rawValue : null;
    if (reviewedValue === (field.reviewedValue ?? field.normalizedValue)) {
      continue;
    }
    await tx
      .update(extractedFields)
      .set({
        reviewedValue,
        reviewedByUserId: reviewerUserId,
        reviewedAt: now,
        needsReview: reviewedValue == null,
      })
      .where(eq(extractedFields.id, field.id));
    edits.push({
      fieldKey: field.fieldKey,
      from: field.reviewedValue ?? field.normalizedValue,
      to: reviewedValue ?? "",
    });
  }

  return { fields, edits, reviewedAt: now };
}

export async function saveReviewAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const scoresheetId = String(formData.get("scoresheetId") ?? "");
  const [sheet] = await db
    .select()
    .from(scoresheets)
    .where(eq(scoresheets.id, scoresheetId))
    .limit(1);

  if (!sheet) {
    return { status: "error", code: "scoresheet_not_found" };
  }

  const { user } = await requireEventOwner(
    String(formData.get("eventId") ?? ""),
  );
  const context = await loadMatchContext(sheet.matchId);
  if (!context) {
    return { status: "error", code: "match_not_found" };
  }

  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "cancelled") {
    return { status: "error", code: "match_not_playable" };
  }

  let editCount = 0;
  await db.transaction(async (tx) => {
    const saved = await saveReviewFieldsInTransaction(
      tx,
      sheet.id,
      user.id,
      formData,
    );
    editCount = saved.edits.length;

    await tx
      .update(scoresheets)
      .set({
        status: "needs_review",
        reviewedAt: saved.reviewedAt,
        reviewedByUserId: user.id,
        updatedAt: saved.reviewedAt,
      })
      .where(eq(scoresheets.id, sheet.id));
    await tx
      .update(matches)
      .set({ status: "in_review", updatedAt: saved.reviewedAt })
      .where(eq(matches.id, context.match.id));
    await tx.insert(auditEvents).values({
      eventId: context.event.id,
      actorUserId: user.id,
      type: "scoresheet.fields_reviewed",
      entityType: "scoresheet",
      entityId: sheet.id,
      summary: `Reviewer saved ${saved.edits.length} field edit(s) for match #${context.match.matchNumber}.`,
      metadata: { matchId: context.match.id, edits: saved.edits },
    });
  });

  revalidateResults(context);
  return { status: "success", code: "review_saved" };
}

function numberField(formData: FormData, key: string) {
  const raw = fieldValueFromForm(formData, key);
  if (!raw.length) {
    return null;
  }
  return Number(raw);
}

export async function confirmScoresheetAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const scoresheetId = String(formData.get("scoresheetId") ?? "");
  const { user } = await requireEventOwner(eventId);

  const [sheet] = await db
    .select()
    .from(scoresheets)
    .where(eq(scoresheets.id, scoresheetId))
    .limit(1);

  if (!sheet) {
    return { status: "error", code: "scoresheet_not_found" };
  }

  const context = await loadMatchContext(sheet.matchId);
  if (!context) {
    return { status: "error", code: "match_not_found" };
  }

  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "published") {
    return { status: "error", code: "result_already_published" };
  }

  if (context.match.status === "cancelled") {
    return { status: "error", code: "match_not_playable" };
  }

  const walkover = fieldValueFromForm(formData, "result_walkover") === "true";
  const winner = fieldValueFromForm(formData, "result_walkover_winner");
  const walkoverWinnerSide: "home" | "away" | null =
    winner === "home" || winner === "away" ? winner : null;
  const result: FootballResultInput = {
    homeScore: numberField(formData, "result_home_goals") ?? -1,
    awayScore: numberField(formData, "result_away_goals") ?? -1,
    isWalkover: walkover,
    walkoverWinnerSide,
    penaltyHome: numberField(formData, "result_home_penalty"),
    penaltyAway: numberField(formData, "result_away_penalty"),
    notes: fieldValueFromForm(formData, "result_notes") || null,
  };

  if (walkover) {
    result.homeScore = result.walkoverWinnerSide === "home" ? 3 : 0;
    result.awayScore = result.walkoverWinnerSide === "away" ? 3 : 0;
    result.penaltyHome = null;
    result.penaltyAway = null;
  }

  const validation = validateFootballResult(result, {
    stage: context.match.stage,
    homeTeamId: context.homeTeamId,
    awayTeamId: context.awayTeamId,
  });

  if (!validation.valid) {
    return {
      status: "error",
      code: validation.errors[0] ?? "invalid_result",
    };
  }

  try {
    await db.transaction(async (tx) => {
      const saved = await saveReviewFieldsInTransaction(
        tx,
        sheet.id,
        user.id,
        formData,
      );

      const published = await publishFootballResult(tx, {
        matchId: context.match.id,
        source: "scoresheet",
        result,
        actorUserId: user.id,
        reviewerUserId: user.id,
        scoresheetId: sheet.id,
        metadata: {
          extractionSource: sheet.extractionSource,
          sheetId: sheet.qrSheetId,
          templateVersion: sheet.templateVersion,
          reviewerEdits: saved.edits,
          reviewedFieldValues: Object.fromEntries(
            saved.fields.map((field) => [
              field.fieldKey,
              fieldValueFromForm(formData, field.fieldKey),
            ]),
          ),
        },
      });

      await tx
        .update(extractedFields)
        .set({
          reviewedByUserId: user.id,
          reviewedAt: saved.reviewedAt,
          needsReview: false,
        })
        .where(eq(extractedFields.scoresheetId, sheet.id));

      await tx
        .update(scoresheets)
        .set({
          status: "confirmed",
          isActive: true,
          reviewedAt: saved.reviewedAt,
          reviewedByUserId: user.id,
          confirmedAt: saved.reviewedAt,
          confirmedByUserId: user.id,
          updatedAt: saved.reviewedAt,
        })
        .where(eq(scoresheets.id, sheet.id));

      await tx.insert(auditEvents).values({
        eventId: context.event.id,
        actorUserId: user.id,
        type: "scoresheet.confirmed",
        entityType: "scoresheet",
        entityId: sheet.id,
        summary: `Scoresheet confirmed and result version ${published.version} published for match #${context.match.matchNumber}.`,
        metadata: {
          matchId: context.match.id,
          resultVersionId: published.resultVersionId,
          version: published.version,
          reviewerEdits: saved.edits,
        },
      });
    });
  } catch (error) {
    if (error instanceof ResultPublicationError) {
      return { status: "error", code: error.code };
    }
    throw error;
  }

  revalidateResults(context);
  redirect(`/admin/events/${eventId}/review/${context.match.id}?notice=published`);
}

export async function rejectScoresheetAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const scoresheetId = String(formData.get("scoresheetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const { user } = await requireEventOwner(eventId);

  if (reason.length < 3) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { reason: "reason_required" },
    };
  }

  const [sheet] = await db
    .select()
    .from(scoresheets)
    .where(eq(scoresheets.id, scoresheetId))
    .limit(1);
  if (!sheet) {
    return { status: "error", code: "scoresheet_not_found" };
  }
  const context = await loadMatchContext(sheet.matchId);
  if (!context) {
    return { status: "error", code: "match_not_found" };
  }
  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "published") {
    return { status: "error", code: "result_already_published" };
  }

  if (context.match.status === "cancelled") {
    return { status: "error", code: "match_not_playable" };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(scoresheets)
      .set({
        status: "rejected",
        isActive: false,
        rejectionReason: reason.slice(0, 1000),
        reviewedAt: now,
        reviewedByUserId: user.id,
        updatedAt: now,
      })
      .where(eq(scoresheets.id, sheet.id));

    await tx
      .update(matches)
      .set({ status: "awaiting_result", updatedAt: now })
      .where(eq(matches.id, context.match.id));

    await tx.insert(auditEvents).values({
      eventId: context.event.id,
      actorUserId: user.id,
      type: "scoresheet.rejected",
      entityType: "scoresheet",
      entityId: sheet.id,
      summary: `Scoresheet rejected for match #${context.match.matchNumber}.`,
      metadata: { matchId: context.match.id, reason },
    });
  });

  revalidateResults(context);
  return { status: "success", code: "scoresheet_rejected" };
}

export async function retryExtractionAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const scoresheetId = String(formData.get("scoresheetId") ?? "");
  await requireEventOwner(eventId);

  const [sheet] = await db
    .select()
    .from(scoresheets)
    .where(eq(scoresheets.id, scoresheetId))
    .limit(1);
  if (!sheet) {
    return { status: "error", code: "scoresheet_not_found" };
  }

  const context = await loadMatchContext(sheet.matchId);
  if (!context) {
    return { status: "error", code: "match_not_found" };
  }
  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "published") {
    return { status: "error", code: "result_already_published" };
  }

  if (context.match.status === "cancelled") {
    return { status: "error", code: "match_not_playable" };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(scoresheets)
      .set({
        status: "processing",
        isActive: true,
        failureReason: null,
        processingStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scoresheets.id, sheet.id));
    await tx
      .update(matches)
      .set({ status: "in_review", updatedAt: new Date() })
      .where(eq(matches.id, context.match.id));
  });

  const processed = await processUploadedScoresheet(sheet.id);

  revalidateResults(context);
  return processed.ok
    ? { status: "success", code: "extraction_retried", scoresheetId: sheet.id }
    : { status: "error", code: "extraction_failed", scoresheetId: sheet.id };
}

export async function manualResultAction(
  _previous: ScoresheetActionState,
  formData: FormData,
): Promise<ScoresheetActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const { user } = await requireEventOwner(eventId);

  if (formData.get("explicitConfirmation") !== "true") {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { explicitConfirmation: "confirmation_required" },
    };
  }

  const context = await loadMatchContext(matchId);
  if (!context || context.event.id !== eventId) {
    return { status: "error", code: "match_not_found" };
  }

  if (context.competition.status === "cancelled") {
    return { status: "error", code: "competition_cancelled" };
  }

  if (context.match.status === "cancelled") {
    return { status: "error", code: "match_not_playable" };
  }

  const walkover = formData.get("isWalkover") === "true";
  const winner = String(formData.get("walkoverWinner") ?? "");
  const rawHome = Number(formData.get("homeScore") ?? "");
  const rawAway = Number(formData.get("awayScore") ?? "");
  const penaltyHomeRaw = String(formData.get("penaltyHome") ?? "").trim();
  const penaltyAwayRaw = String(formData.get("penaltyAway") ?? "").trim();

  const walkoverWinnerSide: "home" | "away" | null =
    winner === "home" || winner === "away" ? winner : null;
  const result: FootballResultInput = {
    homeScore: walkover && winner === "home" ? 3 : walkover ? 0 : rawHome,
    awayScore: walkover && winner === "away" ? 3 : walkover ? 0 : rawAway,
    isWalkover: walkover,
    walkoverWinnerSide,
    penaltyHome: penaltyHomeRaw ? Number(penaltyHomeRaw) : null,
    penaltyAway: penaltyAwayRaw ? Number(penaltyAwayRaw) : null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };

  const validation = validateFootballResult(result, {
    stage: context.match.stage,
    homeTeamId: context.homeTeamId,
    awayTeamId: context.awayTeamId,
  });
  if (!validation.valid) {
    return { status: "error", code: validation.errors[0] ?? "invalid_result" };
  }

  try {
    await db.transaction(async (tx) => {
      const activeSheets = await tx
        .select({ id: scoresheets.id })
        .from(scoresheets)
        .where(
          and(
            eq(scoresheets.matchId, context.match.id),
            eq(scoresheets.isActive, true),
          ),
        );

      for (const activeSheet of activeSheets) {
        await tx
          .update(scoresheets)
          .set({
            status: "rejected",
            isActive: false,
            rejectionReason:
              "Resultado publicado manualmente. / Result published manually.",
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
            updatedAt: new Date(),
          })
          .where(eq(scoresheets.id, activeSheet.id));
      }

      const published = await publishFootballResult(tx, {
        matchId: context.match.id,
        source: "manual",
        result,
        actorUserId: user.id,
        reviewerUserId: user.id,
        metadata: { entryMode: "manual", explicitConfirmation: true },
      });

      await tx.insert(auditEvents).values({
        eventId: context.event.id,
        actorUserId: user.id,
        type: "result.manual_entry",
        entityType: "result_version",
        entityId: published.resultVersionId,
        summary: `Manual owner-confirmed result published for match #${context.match.matchNumber}.`,
        metadata: {
          matchId: context.match.id,
          version: published.version,
          source: "manual",
        },
      });
    });
  } catch (error) {
    if (error instanceof ResultPublicationError) {
      return { status: "error", code: error.code };
    }
    throw error;
  }

  revalidateResults(context);
  redirect(
    `/admin/events/${eventId}/review/${context.match.id}?notice=manual_published`,
  );
}
