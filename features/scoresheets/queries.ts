import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  extractedFields,
  jobs,
  matches,
  resultVersions,
  scoresheets,
  users,
} from "@/lib/db/schema";
import { fieldFlagLabel } from "./extraction";

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export type ReviewQueueItem = {
  matchId: string;
  matchNumber: number;
  stage: "group" | "knockout";
  matchStatus: string;
  startsAt: string | null;
  venueName: string | null;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  competitionStatus: string;
  homeTeamName: string | null;
  awayTeamName: string | null;
  activeScoresheet: {
    id: string;
    status: string;
    extractionSource: string | null;
    uploadedAt: string;
    failureReason: string | null;
    rejectionReason: string | null;
    flaggedFields: number;
  } | null;
  latestScoresheetStatus: string | null;
  historyCount: number;
  latestJob: {
    id: string;
    status: string;
    attempts: number;
    lastError: string | null;
  } | null;
};

export type ReviewQueueData = {
  event: { id: string; name: string; slug: string; timezone: string };
  items: ReviewQueueItem[];
  counts: {
    pending: number;
    awaiting: number;
    failed: number;
    published: number;
    cancelled: number;
  };
};

export async function getReviewQueue(
  eventId: string,
): Promise<ReviewQueueData | null> {
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      slug: events.slug,
      timezone: events.timezone,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    return null;
  }

  const competitionRows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      sport: competitions.sport,
    })
    .from(competitions)
    .where(eq(competitions.eventId, event.id))
    .orderBy(asc(competitions.sortOrder));

  const footballIds = competitionRows
    .filter((competition) => competition.sport === "football")
    .map((competition) => competition.id);

  if (!footballIds.length) {
    return {
      event,
      items: [],
      counts: {
        pending: 0,
        awaiting: 0,
        failed: 0,
        published: 0,
        cancelled: 0,
      },
    };
  }

  const matchRows = await db.query.matches.findMany({
    where: and(
      inArray(matches.competitionId, footballIds),
      eq(matches.isBye, false),
    ),
    with: {
      competition: true,
      venue: true,
      entries: { with: { team: true } },
      scoresheets: { orderBy: [desc(scoresheets.createdAt)] },
    },
    orderBy: [asc(matches.matchNumber)],
  });

  const sheetIds = matchRows.flatMap((match) =>
    match.scoresheets.map((sheet) => sheet.id),
  );

  const flaggedRows = sheetIds.length
    ? await db
        .select({
          scoresheetId: extractedFields.scoresheetId,
          count: sql<number>`count(*)::int`,
        })
        .from(extractedFields)
        .where(
          and(
            inArray(extractedFields.scoresheetId, sheetIds),
            eq(extractedFields.needsReview, true),
          ),
        )
        .groupBy(extractedFields.scoresheetId)
    : [];

  const flaggedBySheet = new Map(
    flaggedRows.map((row) => [row.scoresheetId, row.count]),
  );

  const jobRows = sheetIds.length
    ? await db
        .select()
        .from(jobs)
        .where(eq(jobs.type, "scoresheet.extract"))
        .orderBy(desc(jobs.createdAt))
        .limit(200)
    : [];

  const items: ReviewQueueItem[] = matchRows.map((match) => {
    const active =
      match.scoresheets.find((sheet) => sheet.isActive) ??
      match.scoresheets[0] ??
      null;
    const latest = match.scoresheets[0] ?? null;
    const job = sheetIds.length
      ? jobRows.find(
          (candidate) =>
            active != null &&
            candidate.payload &&
            (candidate.payload as Record<string, unknown>).scoresheetId ===
              active.id,
        )
      : null;

    return {
      matchId: match.id,
      matchNumber: match.matchNumber,
      stage: match.stage,
      matchStatus: match.status,
      startsAt: toIso(match.startsAt),
      venueName: match.venue?.name ?? null,
      competitionId: match.competition.id,
      competitionName: match.competition.name,
      competitionSlug: match.competition.slug,
      competitionStatus: match.competition.status,
      homeTeamName:
        match.entries.find((entry) => entry.side === "home")?.team?.name ??
        null,
      awayTeamName:
        match.entries.find((entry) => entry.side === "away")?.team?.name ??
        null,
      activeScoresheet: active
        ? {
            id: active.id,
            status: active.status,
            extractionSource: active.extractionSource,
            uploadedAt: active.createdAt.toISOString(),
            failureReason: active.failureReason,
            rejectionReason: active.rejectionReason,
            flaggedFields: flaggedBySheet.get(active.id) ?? 0,
          }
        : null,
      latestScoresheetStatus: latest?.status ?? null,
      historyCount: match.scoresheets.length,
      latestJob: job
        ? {
            id: job.id,
            status: job.status,
            attempts: job.attempts,
            lastError: job.lastError,
          }
        : null,
    };
  });

  return {
    event,
    items,
    counts: {
      pending: items.filter(
        (item) =>
          item.matchStatus !== "cancelled" &&
          item.competitionStatus !== "cancelled" &&
          (item.activeScoresheet?.status === "needs_review" ||
            item.activeScoresheet?.status === "processing" ||
            item.activeScoresheet?.status === "uploaded"),
      ).length,
      awaiting: items.filter(
        (item) =>
          !item.activeScoresheet &&
          item.matchStatus !== "published" &&
          item.matchStatus !== "cancelled" &&
          item.competitionStatus !== "cancelled",
      ).length,
      failed: items.filter(
        (item) =>
          item.matchStatus !== "cancelled" &&
          item.competitionStatus !== "cancelled" &&
          (item.activeScoresheet?.status === "extraction_failed" ||
            item.activeScoresheet?.status === "rejected"),
      ).length,
      published: items.filter(
        (item) =>
          item.matchStatus === "published" &&
          item.competitionStatus !== "cancelled",
      ).length,
      cancelled: items.filter(
        (item) =>
          item.matchStatus === "cancelled" ||
          item.competitionStatus === "cancelled",
      ).length,
    },
  };
}

export type ReviewFieldData = {
  id: string;
  fieldKey: string;
  label: string;
  page: number;
  rawValue: string | null;
  normalizedValue: string | null;
  reviewedValue: string | null;
  confidence: number | null;
  validationFlags: string[];
  flagLabels: string[];
  needsReview: boolean;
  source: string | null;
  cropStorageKey: string | null;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type ReviewScoresheetData = {
  id: string;
  status: string;
  isActive: boolean;
  extractionSource: string | null;
  extractionNote: string | null;
  templateVersion: string | null;
  qrSheetId: string | null;
  pageCount: number | null;
  originalFilename: string;
  uploadedAt: string;
  uploadedBy: string | null;
  processedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  confirmedAt: string | null;
  failureReason: string | null;
  rejectionReason: string | null;
  previewStorageKey: string | null;
  fields: ReviewFieldData[];
  jobs: Array<{
    id: string;
    status: string;
    attempts: number;
    lastError: string | null;
    createdAt: string;
  }>;
};

export type ReviewMatchDetail = {
  event: { id: string; name: string; slug: string; timezone: string };
  competition: {
    id: string;
    name: string;
    slug: string;
    sport: "football" | "tennis";
    status: string;
    publicNote: string | null;
  };
  match: {
    id: string;
    matchNumber: number;
    stage: "group" | "knockout";
    status: string;
    startsAt: string | null;
    venueName: string | null;
    cancelledAt: string | null;
    cancellationReason: string | null;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
  };
  scoresheets: ReviewScoresheetData[];
  activeScoresheetId: string | null;
  resultVersions: Array<{
    id: string;
    version: number;
    source: string;
    isCurrent: boolean;
    reason: string | null;
    confirmedAt: string;
    reviewedBy: string | null;
    metadata: Record<string, unknown> | null;
    homeScore: number | null;
    awayScore: number | null;
    isWalkover: boolean;
    penaltyHome: number | null;
    penaltyAway: number | null;
  }>;
};

export async function getReviewMatchDetail(
  eventId: string,
  matchId: string,
): Promise<ReviewMatchDetail | null> {
  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      competition: { with: { event: true } },
      venue: true,
      entries: { with: { team: true } },
      scoresheets: {
        orderBy: [desc(scoresheets.createdAt)],
        with: { extractedFields: true },
      },
      resultVersions: {
        orderBy: [desc(resultVersions.version)],
        with: { footballResult: true },
      },
    },
  });

  if (!match || !match.competition || match.competition.eventId !== eventId) {
    return null;
  }

  const userIds = new Set<string>();
  for (const sheet of match.scoresheets) {
    userIds.add(sheet.uploadedByUserId);
    if (sheet.reviewedByUserId) userIds.add(sheet.reviewedByUserId);
    for (const field of sheet.extractedFields) {
      if (field.reviewedByUserId) userIds.add(field.reviewedByUserId);
    }
  }
  for (const version of match.resultVersions) {
    if (version.reviewedByUserId) userIds.add(version.reviewedByUserId);
    if (version.createdByUserId) userIds.add(version.createdByUserId);
  }

  const userRows = userIds.size
    ? await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, [...userIds]))
    : [];
  const userName = new Map(
    userRows.map((user) => [user.id, user.name ?? user.email]),
  );

  const sheetIds = match.scoresheets.map((sheet) => sheet.id);
  const jobRows = sheetIds.length
    ? (await db
        .select()
        .from(jobs)
        .where(eq(jobs.type, "scoresheet.extract"))
        .orderBy(desc(jobs.createdAt))
        .limit(200)).filter((job) =>
        sheetIds.includes(
          String(
            (job.payload as Record<string, unknown> | null)?.scoresheetId ?? "",
          ),
        ),
      )
    : [];

  const scoresheetData: ReviewScoresheetData[] = match.scoresheets.map(
    (sheet) => ({
      id: sheet.id,
      status: sheet.status,
      isActive: sheet.isActive,
      extractionSource: sheet.extractionSource,
      extractionNote: sheet.extractionNote,
      templateVersion: sheet.templateVersion,
      qrSheetId: sheet.qrSheetId,
      pageCount: sheet.pageCount,
      originalFilename: sheet.originalFilename,
      uploadedAt: sheet.createdAt.toISOString(),
      uploadedBy: userName.get(sheet.uploadedByUserId) ?? null,
      processedAt: toIso(sheet.processedAt),
      reviewedAt: toIso(sheet.reviewedAt),
      reviewedBy: sheet.reviewedByUserId
        ? (userName.get(sheet.reviewedByUserId) ?? null)
        : null,
      confirmedAt: toIso(sheet.confirmedAt),
      failureReason: sheet.failureReason,
      rejectionReason: sheet.rejectionReason,
      previewStorageKey: sheet.previewStorageKey,
      fields: [...sheet.extractedFields]
        .sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))
        .map((field) => ({
          id: field.id,
          fieldKey: field.fieldKey,
          label: field.label ?? field.fieldKey,
          page: field.page,
          rawValue: field.rawValue,
          normalizedValue: field.normalizedValue,
          reviewedValue: field.reviewedValue,
          confidence: field.confidence,
          validationFlags: field.validationFlags ?? [],
          flagLabels: (field.validationFlags ?? []).map(fieldFlagLabel),
          needsReview: field.needsReview,
          source: field.source,
          cropStorageKey: field.cropStorageKey,
          cropBox: field.cropBox ?? null,
          reviewedBy: field.reviewedByUserId
            ? (userName.get(field.reviewedByUserId) ?? null)
            : null,
          reviewedAt: toIso(field.reviewedAt),
        })),
      jobs: jobRows
        .filter(
          (job) =>
            String(
              (job.payload as Record<string, unknown> | null)?.scoresheetId ??
                "",
            ) === sheet.id,
        )
        .map((job) => ({
          id: job.id,
          status: job.status,
          attempts: job.attempts,
          lastError: job.lastError,
          createdAt: job.createdAt.toISOString(),
        })),
    }),
  );

  return {
    event: {
      id: match.competition.event.id,
      name: match.competition.event.name,
      slug: match.competition.event.slug,
      timezone: match.competition.event.timezone,
    },
    competition: {
      id: match.competition.id,
      name: match.competition.name,
      slug: match.competition.slug,
      sport: match.competition.sport,
      status: match.competition.status,
      publicNote: match.competition.publicNote,
    },
    match: {
      id: match.id,
      matchNumber: match.matchNumber,
      stage: match.stage,
      status: match.status,
      startsAt: toIso(match.startsAt),
      venueName: match.venue?.name ?? null,
      cancelledAt: toIso(match.cancelledAt),
      cancellationReason: match.cancellationReason,
      homeTeamId:
        match.entries.find((entry) => entry.side === "home")?.teamId ?? null,
      awayTeamId:
        match.entries.find((entry) => entry.side === "away")?.teamId ?? null,
      homeTeamName:
        match.entries.find((entry) => entry.side === "home")?.team?.name ??
        null,
      awayTeamName:
        match.entries.find((entry) => entry.side === "away")?.team?.name ??
        null,
    },
    scoresheets: scoresheetData,
    activeScoresheetId:
      scoresheetData.find((sheet) => sheet.isActive)?.id ?? null,
    resultVersions: match.resultVersions.map((version) => ({
      id: version.id,
      version: version.version,
      source: version.source,
      isCurrent: version.isCurrent,
      reason: version.reason,
      confirmedAt: version.confirmedAt.toISOString(),
      reviewedBy: version.reviewedByUserId
        ? (userName.get(version.reviewedByUserId) ?? null)
        : null,
      metadata:
        (version.metadata as Record<string, unknown> | null) ?? null,
      homeScore: version.footballResult?.homeScore ?? null,
      awayScore: version.footballResult?.awayScore ?? null,
      isWalkover: version.footballResult?.isWalkover ?? false,
      penaltyHome: version.footballResult?.penaltyHome ?? null,
      penaltyAway: version.footballResult?.penaltyAway ?? null,
    })),
  };
}
