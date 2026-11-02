import { and, desc, eq } from "drizzle-orm";

import type { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  matches,
  participantStatistics,
  resultVersions,
  tennisResults,
} from "@/lib/db/schema";
import {
  planCompetitionAdvancement,
  recalculateCompetition,
} from "@/features/results/recalculation";
import {
  validateTennisResult,
  type TennisResultInput,
} from "@/features/results/tennis-result";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class TennisPublicationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export type PublishTennisResultInput = {
  matchId: string;
  source: "scoresheet" | "manual" | "walkover";
  result: TennisResultInput;
  actorUserId: string;
  reviewerUserId?: string | null;
  scoresheetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

async function currentTennisResult(tx: Transaction, matchId: string) {
  const [row] = await tx
    .select({
      id: resultVersions.id,
      version: resultVersions.version,
      winnerTeamId: tennisResults.winnerTeamId,
    })
    .from(resultVersions)
    .leftJoin(
      tennisResults,
      eq(tennisResults.resultVersionId, resultVersions.id),
    )
    .where(
      and(
        eq(resultVersions.matchId, matchId),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Publishes a tennis result version atomically. Manual entry and Scoresheet
 * confirmation share this seam; a correction is the same call with a reason
 * after a current version already exists.
 */
export async function publishTennisResult(
  tx: Transaction,
  input: PublishTennisResultInput,
) {
  const match = await tx.query.matches.findFirst({
    where: eq(matches.id, input.matchId),
    with: {
      competition: true,
      entries: { with: { team: { with: { participants: true } } } },
    },
  });

  if (!match || !match.competition) {
    throw new TennisPublicationError("match_not_found");
  }

  if (
    match.status === "cancelled" ||
    match.isBye ||
    match.cancelledAt != null
  ) {
    throw new TennisPublicationError("match_not_playable");
  }

  if (match.competition.status === "cancelled") {
    throw new TennisPublicationError("competition_cancelled");
  }

  if (match.competition.sport !== "tennis") {
    throw new TennisPublicationError("wrong_sport");
  }

  const homeEntry = match.entries.find((entry) => entry.side === "home");
  const awayEntry = match.entries.find((entry) => entry.side === "away");

  if (!homeEntry || !awayEntry) {
    throw new TennisPublicationError("match_entrants_missing");
  }

  const validation = validateTennisResult(input.result, {
    stage: match.stage,
    homeTeamId: homeEntry.teamId,
    awayTeamId: awayEntry.teamId,
  });

  if (!validation.valid) {
    throw new TennisPublicationError(
      validation.errors[0] ?? "invalid_result",
    );
  }

  const current = await currentTennisResult(tx, match.id);

  if (current && !input.reason?.trim()) {
    throw new TennisPublicationError("result_already_published");
  }

  if (validation.winnerTeamId && (!current || current.winnerTeamId !== validation.winnerTeamId)) {
    const plan = await planCompetitionAdvancement(tx, match.competitionId, {
      matchId: match.id,
      winnerTeamId: validation.winnerTeamId,
      tennis: {
        winnerTeamId: validation.winnerTeamId,
        sets: validation.sets,
        isWalkover: Boolean(input.result.isWalkover),
      },
    });
    if (plan.blockedMatchIds.length) {
      throw new TennisPublicationError("downstream_result_exists");
    }
  }

  const [latest] = await tx
    .select({ version: resultVersions.version })
    .from(resultVersions)
    .where(eq(resultVersions.matchId, match.id))
    .orderBy(desc(resultVersions.version))
    .limit(1);

  const nextVersion = (latest?.version ?? 0) + 1;
  const now = new Date();

  if (current) {
    await tx
      .update(resultVersions)
      .set({ isCurrent: false })
      .where(eq(resultVersions.id, current.id));
  }

  const [version] = await tx
    .insert(resultVersions)
    .values({
      matchId: match.id,
      version: nextVersion,
      source: input.source,
      isCurrent: true,
      reason: input.reason?.trim() || null,
      createdByUserId: input.actorUserId,
      reviewedByUserId: input.reviewerUserId ?? input.actorUserId,
      reviewedAt: now,
      confirmedAt: now,
      metadata: {
        ...input.metadata,
        scoresheetId: input.scoresheetId ?? null,
        winnerTeamId: validation.winnerTeamId,
        sets: validation.sets,
      },
    })
    .returning({ id: resultVersions.id, version: resultVersions.version });

  if (!version) {
    throw new TennisPublicationError("result_version_failed");
  }

  await tx.insert(tennisResults).values({
    resultVersionId: version.id,
    winnerTeamId: validation.winnerTeamId!,
    sets: validation.sets,
    isWalkover: Boolean(input.result.isWalkover),
    notes: input.result.notes ?? null,
  });

  if (!input.result.isWalkover) {
    const statistics: Array<typeof participantStatistics.$inferInsert> = [];
    for (const [entry, aces, doubleFaults] of [
      [homeEntry, validation.homeAces, validation.homeDoubleFaults],
      [awayEntry, validation.awayAces, validation.awayDoubleFaults],
    ] as const) {
      if (aces === 0 && doubleFaults === 0) {
        continue;
      }
      const participantId = entry.team?.participants[0]?.id;
      if (!participantId) {
        continue;
      }
      statistics.push({
        resultVersionId: version.id,
        matchId: match.id,
        teamId: entry.teamId,
        participantId,
        goals: 0,
        assists: 0,
        aces,
        doubleFaults,
      });
    }

    if (statistics.length) {
      await tx.insert(participantStatistics).values(statistics);
    }
  }

  await tx
    .update(matches)
    .set({ status: "published", updatedAt: now })
    .where(eq(matches.id, match.id));

  await tx
    .update(competitions)
    .set({
      status:
        match.competition.status === "setup" ||
        match.competition.status === "registration_open" ||
        match.competition.status === "registration_closed"
          ? "in_progress"
          : match.competition.status,
      updatedAt: now,
    })
    .where(eq(competitions.id, match.competitionId));

  await tx.insert(auditEvents).values({
    eventId: match.competition.eventId,
    actorUserId: input.actorUserId,
    type: current ? "result.corrected" : "result.published",
    entityType: "result_version",
    entityId: version.id,
    summary: current
      ? `Match #${match.matchNumber} corrected (version ${version.version}, reason: ${input.reason}).`
      : `Match #${match.matchNumber} published (version ${version.version}, ${input.source}).`,
    metadata: {
      matchId: match.id,
      version: version.version,
      source: input.source,
      scoresheetId: input.scoresheetId ?? null,
      winnerTeamId: validation.winnerTeamId,
      sets: validation.sets,
      isWalkover: Boolean(input.result.isWalkover),
      reason: input.reason?.trim() || null,
      previousVersionId: current?.id ?? null,
    },
  });

  await recalculateCompetition(tx, match.competitionId);

  return {
    resultVersionId: version.id,
    version: version.version,
    winnerTeamId: validation.winnerTeamId,
  };
}
