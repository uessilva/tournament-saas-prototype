import { and, desc, eq } from "drizzle-orm";

import type { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  footballResults,
  matches,
  participantStatistics,
  resultVersions,
} from "@/lib/db/schema";
import {
  planCompetitionAdvancement,
  recalculateCompetition,
} from "@/features/results/recalculation";
import { footballWinnerTeamId } from "@/features/results/winner";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type FootballStatisticInput = {
  participantId: string;
  teamId: string;
  goals: number;
  assists: number;
};

export type FootballResultInput = {
  homeScore: number;
  awayScore: number;
  isWalkover?: boolean;
  walkoverWinnerSide?: "home" | "away" | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  notes?: string | null;
  statistics?: FootballStatisticInput[];
};

export type FootballValidationContext = {
  stage: "group" | "knockout";
  homeTeamId: string;
  awayTeamId: string;
};

export type FootballValidationResult = {
  valid: boolean;
  errors: string[];
  winnerTeamId: string | null;
};

const MAX_REASONABLE_GOALS = 30;

function integerInRange(value: number | null | undefined, max: number) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

/**
 * Pure football result validation shared by the review form, manual entry and
 * the publication transaction. Ticket 06/07 may extend this for corrections or
 * other sports without changing the publication seam.
 */
export function validateFootballResult(
  input: FootballResultInput,
  context: FootballValidationContext,
): FootballValidationResult {
  const errors: string[] = [];
  const isWalkover = Boolean(input.isWalkover);

  if (isWalkover) {
    if (!input.walkoverWinnerSide) {
      errors.push("walkover_winner_required");
    }
    if (input.penaltyHome != null || input.penaltyAway != null) {
      errors.push("walkover_cannot_have_penalties");
    }
    const winnerTeamId =
      input.walkoverWinnerSide === "home"
        ? context.homeTeamId
        : input.walkoverWinnerSide === "away"
          ? context.awayTeamId
          : null;
    return { valid: errors.length === 0, errors, winnerTeamId };
  }

  if (!integerInRange(input.homeScore, MAX_REASONABLE_GOALS)) {
    errors.push("invalid_home_score");
  }
  if (!integerInRange(input.awayScore, MAX_REASONABLE_GOALS)) {
    errors.push("invalid_away_score");
  }

  const hasPenalties =
    input.penaltyHome != null || input.penaltyAway != null;

  if (hasPenalties) {
    if (
      !integerInRange(input.penaltyHome, MAX_REASONABLE_GOALS) ||
      !integerInRange(input.penaltyAway, MAX_REASONABLE_GOALS)
    ) {
      errors.push("invalid_penalties");
    } else if (input.penaltyHome === input.penaltyAway) {
      errors.push("penalty_tie");
    }

    if (input.homeScore !== input.awayScore) {
      errors.push("penalties_require_draw");
    }
  }

  if (
    context.stage === "knockout" &&
    input.homeScore === input.awayScore &&
    !hasPenalties
  ) {
    errors.push("knockout_draw_needs_penalties");
  }

  if (errors.length) {
    return { valid: false, errors, winnerTeamId: null };
  }

  const winnerTeamId = footballWinnerTeamId({
    homeTeamId: context.homeTeamId,
    awayTeamId: context.awayTeamId,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    isWalkover: false,
    walkoverWinnerTeamId: null,
    penaltyHome: input.penaltyHome ?? null,
    penaltyAway: input.penaltyAway ?? null,
  });

  return { valid: true, errors, winnerTeamId };
}

export type PublishFootballResultInput = {
  matchId: string;
  source: "scoresheet" | "manual" | "walkover";
  result: FootballResultInput;
  actorUserId: string;
  reviewerUserId?: string | null;
  scoresheetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export class ResultPublicationError extends Error {
  code: string;

  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/**
 * Shared atomic publication seam. Ticket 05 uses it for reviewed scoresheets
 * and manual entry; tickets 06/07 can extend the same transaction for reasoned
 * corrections, standings and advancement without duplicating publication.
 */
export async function publishFootballResult(
  tx: Transaction,
  input: PublishFootballResultInput,
) {
  const match = await tx.query.matches.findFirst({
    where: eq(matches.id, input.matchId),
    with: {
      competition: true,
      entries: true,
    },
  });

  if (!match || !match.competition) {
    throw new ResultPublicationError("match_not_found");
  }

  if (match.status === "cancelled" || match.isBye) {
    throw new ResultPublicationError("match_not_playable");
  }

  if (match.competition.status === "cancelled") {
    throw new ResultPublicationError("competition_cancelled");
  }

  const homeTeamId = match.entries.find((entry) => entry.side === "home")
    ?.teamId;
  const awayTeamId = match.entries.find((entry) => entry.side === "away")
    ?.teamId;

  if (!homeTeamId || !awayTeamId) {
    throw new ResultPublicationError("match_entrants_missing");
  }

  const validation = validateFootballResult(input.result, {
    stage: match.stage,
    homeTeamId,
    awayTeamId,
  });

  if (!validation.valid) {
    throw new ResultPublicationError(validation.errors[0] ?? "invalid_result");
  }

  const [current] = await tx
    .select({ id: resultVersions.id, version: resultVersions.version })
    .from(resultVersions)
    .where(
      and(eq(resultVersions.matchId, match.id), eq(resultVersions.isCurrent, true)),
    )
    .limit(1);

  if (current && !input.reason) {
    throw new ResultPublicationError("result_already_published");
  }

  if (current) {
    // A correction may only change a bracket side when no later confirmed
    // result depends on it. Owners repair reverse order by reopening first.
    const plan = await planCompetitionAdvancement(tx, match.competitionId, {
      matchId: match.id,
      winnerTeamId: validation.winnerTeamId,
      football: {
        homeScore: input.result.homeScore,
        awayScore: input.result.awayScore,
        isWalkover: Boolean(input.result.isWalkover),
        walkoverWinnerSide: input.result.walkoverWinnerSide ?? null,
        penaltyHome: input.result.penaltyHome ?? null,
        penaltyAway: input.result.penaltyAway ?? null,
      },
    });
    if (plan.blockedMatchIds.length) {
      throw new ResultPublicationError("downstream_result_exists");
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
      reason: input.reason ?? null,
      createdByUserId: input.actorUserId,
      reviewedByUserId: input.reviewerUserId ?? input.actorUserId,
      reviewedAt: now,
      confirmedAt: now,
      metadata: {
        ...input.metadata,
        scoresheetId: input.scoresheetId ?? null,
        winnerTeamId: validation.winnerTeamId,
        correction: Boolean(current),
        previousVersionId: current?.id ?? null,
      },
    })
    .returning({ id: resultVersions.id, version: resultVersions.version });

  if (!version) {
    throw new ResultPublicationError("result_version_failed");
  }

  const isWalkover = Boolean(input.result.isWalkover);
  const walkoverWinnerTeamId = isWalkover
    ? (input.result.walkoverWinnerSide === "home"
        ? homeTeamId
        : awayTeamId)
    : null;

  await tx.insert(footballResults).values({
    resultVersionId: version.id,
    homeScore: input.result.homeScore,
    awayScore: input.result.awayScore,
    isWalkover,
    walkoverWinnerTeamId,
    penaltyHome: input.result.penaltyHome ?? null,
    penaltyAway: input.result.penaltyAway ?? null,
    notes: input.result.notes ?? null,
  });

  // Walkovers deliberately contribute no Participant statistics. For normal
  // results the owner-entered goals and assists belong to the new version, so
  // leader queries only ever read the current confirmed version.
  if (!isWalkover && input.result.statistics?.length) {
    const validStatistics = input.result.statistics.filter(
      (row) =>
        row.goals >= 0 &&
        row.assists >= 0 &&
        (row.teamId === homeTeamId || row.teamId === awayTeamId),
    );
    if (validStatistics.length) {
      await tx.insert(participantStatistics).values(
        validStatistics.map((row) => ({
          resultVersionId: version.id,
          matchId: match.id,
          teamId: row.teamId,
          participantId: row.participantId,
          goals: row.goals,
          assists: row.assists,
          aces: 0,
          doubleFaults: 0,
        })),
      );
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
      ? `Match #${match.matchNumber} corrected (version ${version.version}, ${input.source}).`
      : `Match #${match.matchNumber} published (version ${version.version}, ${input.source}).`,
    metadata: {
      matchId: match.id,
      version: version.version,
      source: input.source,
      scoresheetId: input.scoresheetId ?? null,
      homeScore: input.result.homeScore,
      awayScore: input.result.awayScore,
      isWalkover,
      reason: input.reason ?? null,
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
