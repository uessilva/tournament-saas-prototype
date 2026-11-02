import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  auditEvents,
  extractedFields,
  matches,
  scoresheets,
} from "@/lib/db/schema";
import { scoresheetAssetKey, storage } from "@/lib/storage";
import { renderCropSvg, renderPreviewSvg } from "./crops";
import { extractScoresheet } from "./extraction";

function safeFieldName(fieldKey: string) {
  return fieldKey.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class ScoresheetExtractionError extends Error {
  scoresheetId: string;

  constructor(scoresheetId: string, message: string) {
    super(message);
    this.scoresheetId = scoresheetId;
  }
}

/**
 * Extracts an uploaded sheet and persists everything the review screen needs.
 * The worker and the synchronous demo fallback both call this same function.
 */
export async function processScoresheetExtraction(scoresheetId: string) {
  const sheet = await db.query.scoresheets.findFirst({
    where: eq(scoresheets.id, scoresheetId),
  });

  if (!sheet) {
    throw new Error(`Scoresheet ${scoresheetId} was not found.`);
  }

  if (sheet.status === "confirmed" || sheet.status === "rejected") {
    return { skipped: true as const };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, sheet.matchId),
    with: {
      competition: { with: { event: true } },
      entries: { with: { team: true } },
    },
  });

  if (!match || !match.competition) {
    throw new Error("The match for this scoresheet no longer exists.");
  }

  const event = match.competition.event;
  const homeTeamName =
    match.entries.find((entry) => entry.side === "home")?.team?.name ??
    "Casa / Home";
  const awayTeamName =
    match.entries.find((entry) => entry.side === "away")?.team?.name ??
    "Visitante / Away";

  try {
    const pdfBytes = await storage.read(sheet.storageKey);
    const result = await extractScoresheet({
      pdfBytes,
      matchId: match.id,
      matchNumber: match.matchNumber,
      originalFilename: sheet.originalFilename,
    });

    const cropKeys = new Map<string, string>();
    for (const field of result.fields) {
      const cropKey = scoresheetAssetKey(
        event.id,
        match.id,
        sheet.id,
        "crops",
        `${safeFieldName(field.fieldKey)}.svg`,
      );
      await storage.put(
        cropKey,
        renderCropSvg(field, { homeTeamName, awayTeamName }),
      );
      cropKeys.set(field.fieldKey, cropKey);
    }

    const previewKey = scoresheetAssetKey(
      event.id,
      match.id,
      sheet.id,
      "preview.svg",
    );
    await storage.put(
      previewKey,
      renderPreviewSvg(result, {
        eventName: event.name,
        competitionName: match.competition.name,
        homeTeamName,
        awayTeamName,
        matchNumber: match.matchNumber,
      }),
    );

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .delete(extractedFields)
        .where(eq(extractedFields.scoresheetId, sheet.id));

      await tx.insert(extractedFields).values(
        result.fields.map((field) => ({
          scoresheetId: sheet.id,
          fieldKey: field.fieldKey,
          label: field.label,
          page: field.page,
          rawValue: field.rawValue,
          normalizedValue: field.normalizedValue,
          reviewedValue: null,
          confidence: field.confidence,
          cropStorageKey: cropKeys.get(field.fieldKey) ?? null,
          cropBox: field.cropBox,
          validationFlags: field.validationFlags,
          source: field.source,
          needsReview: field.needsReview,
        })),
      );

      await tx
        .update(scoresheets)
        .set({
          status: "needs_review",
          isActive: true,
          previewStorageKey: previewKey,
          templateVersion: result.templateVersion,
          qrSheetId: result.sheetId,
          pageCount: result.pageCount,
          extractionSource: result.source,
          extractionNote: result.note,
          processedAt: now,
          failureReason: null,
          updatedAt: now,
        })
        .where(eq(scoresheets.id, sheet.id));

      await tx
        .update(matches)
        .set({ status: "in_review", updatedAt: now })
        .where(eq(matches.id, match.id));

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: sheet.uploadedByUserId,
        type: "scoresheet.extracted",
        entityType: "scoresheet",
        entityId: sheet.id,
        summary: `Scoresheet for match #${match.matchNumber} extracted (${result.source}).`,
        metadata: {
          matchId: match.id,
          source: result.source,
          flaggedFields: result.fields.filter((field) => field.needsReview)
            .length,
        },
      });
    });

    return { skipped: false as const, result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scoresheet extraction failed.";
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(scoresheets)
        .set({
          status: "extraction_failed",
          isActive: false,
          failureReason: message.slice(0, 1000),
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(scoresheets.id, sheet.id));

      await tx
        .update(matches)
        .set({ status: "awaiting_result", updatedAt: now })
        .where(eq(matches.id, match.id));

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: sheet.uploadedByUserId,
        type: "scoresheet.extraction_failed",
        entityType: "scoresheet",
        entityId: sheet.id,
        summary: `Scoresheet extraction failed for match #${match.matchNumber}.`,
        metadata: { matchId: match.id, error: message.slice(0, 500) },
      });
    });

    throw new ScoresheetExtractionError(sheet.id, message);
  }
}
