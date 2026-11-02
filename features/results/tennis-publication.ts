import { and, desc, eq, inArray } from "drizzle-orm";

import type { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  groupEntries,
  groups,
  matchEntries,
  matches,
  matchSlots,
  participantStatistics,
  resultVersions,
  teams,
  tennisResults,
} from "@/lib/db/schema";
import { calculateTennisStandings } from "@/features/competitions/tennis-standings";
import {
  resolveKnockoutEntrants,
  groupQualifierKey,
  type AdvancementMatch,
  type AdvancementSource,
} from "@/features/matches/advancement";
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
 * A changed knockout winner cannot silently invalidate later published
 * results. Every match fed by this winner is inspected; if any has a current
 * result the correction is blocked so the bracket can be repaired in reverse
 * order first.
 */
async function assertNoDownstreamResult(
  tx: Transaction,
  match: {
    id: string;
    stage: "group" | "knockout";
    competitionId: string;
  },
  previousWinnerTeamId: string | null,
  nextWinnerTeamId: string | null,
) {
  if (
    match.stage !== "knockout" ||
    !previousWinnerTeamId ||
    !nextWinnerTeamId ||
    previousWinnerTeamId === nextWinnerTeamId
  ) {
    return;
  }

  const slotRows = await tx
    .select({
      matchId: matchSlots.matchId,
      sourceMatchId: matchSlots.sourceMatchId,
    })
    .from(matchSlots)
    .innerJoin(matches, eq(matches.id, matchSlots.matchId))
    .where(eq(matches.competitionId, match.competitionId));

  const downstream = new Set<string>();
  const queue = [match.id];
  while (queue.length) {
    const source = queue.shift()!;
    for (const slot of slotRows) {
      if (slot.sourceMatchId !== source || downstream.has(slot.matchId)) {
        continue;
      }
      downstream.add(slot.matchId);
      queue.push(slot.matchId);
    }
  }

  if (!downstream.size) {
    return;
  }

  const [confirmed] = await tx
    .select({ matchId: resultVersions.matchId })
    .from(resultVersions)
    .where(
      and(
        inArray(resultVersions.matchId, [...downstream]),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .limit(1);

  if (confirmed) {
    throw new TennisPublicationError("downstream_result_exists");
  }
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

  await assertNoDownstreamResult(
    tx,
    match,
    current?.winnerTeamId ?? null,
    validation.winnerTeamId,
  );

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

  await recalculateTennisCompetition(tx, match.competitionId);

  return {
    resultVersionId: version.id,
    version: version.version,
    winnerTeamId: validation.winnerTeamId,
  };
}

/**
 * Refreshes tennis group qualifiers and knockout entrants from current result
 * versions. Standings and leaders are read models derived from the same
 * versions, so no public cache needs a separate update.
 */
export async function recalculateTennisCompetition(
  tx: Transaction,
  competitionId: string,
): Promise<{ competitionId: string; updatedEntries: number }> {
  const competition = await tx.query.competitions.findFirst({
    where: eq(competitions.id, competitionId),
  });

  if (!competition || competition.sport !== "tennis") {
    return { competitionId, updatedEntries: 0 };
  }

  const matchRows = await tx.query.matches.findMany({
    where: eq(matches.competitionId, competitionId),
    with: {
      entries: true,
      resultVersions: {
        where: eq(resultVersions.isCurrent, true),
        with: { tennisResult: true },
      },
    },
  });

  if (!matchRows.some((match) => match.stage === "knockout")) {
    return { competitionId, updatedEntries: 0 };
  }

  const slotRows = await tx
    .select({
      matchId: matchSlots.matchId,
      side: matchSlots.side,
      sourceType: matchSlots.sourceType,
      groupId: matchSlots.groupId,
      groupPosition: matchSlots.groupPosition,
      sourceMatchId: matchSlots.sourceMatchId,
    })
    .from(matchSlots)
    .innerJoin(matches, eq(matches.id, matchSlots.matchId))
    .where(eq(matches.competitionId, competitionId));

  const groupRows = await tx
    .select({ id: groups.id, name: groups.name, sortOrder: groups.sortOrder })
    .from(groups)
    .where(eq(groups.competitionId, competitionId));

  const groupIds = groupRows.map((group) => group.id);
  const entryRows = groupIds.length
    ? await tx
        .select({
          groupId: groupEntries.groupId,
          teamId: groupEntries.teamId,
          teamName: teams.name,
          seedPosition: groupEntries.seedPosition,
        })
        .from(groupEntries)
        .innerJoin(teams, eq(groupEntries.teamId, teams.id))
        .where(inArray(groupEntries.groupId, groupIds))
    : [];

  const groupQualifiers = new Map<string, string>();

  for (const group of groupRows) {
    const groupTeams = entryRows
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        seedPosition: entry.seedPosition,
      }));

    const standingsMatches = matchRows
      .filter(
        (match) =>
          match.groupId === group.id &&
          match.stage === "group" &&
          match.resultVersions[0]?.tennisResult != null,
      )
      .map((match) => {
        const result = match.resultVersions[0]!.tennisResult!;
        return {
          homeTeamId:
            match.entries.find((entry) => entry.side === "home")?.teamId ?? "",
          awayTeamId:
            match.entries.find((entry) => entry.side === "away")?.teamId ?? "",
          winnerTeamId: result.winnerTeamId,
          sets: result.sets,
          isWalkover: result.isWalkover,
          isCancelled:
            match.status === "cancelled" || match.cancelledAt != null,
        };
      })
      .filter((match) => match.homeTeamId && match.awayTeamId);

    const standings = calculateTennisStandings(
      groupTeams,
      standingsMatches,
      competition.drawSeed ?? "",
    );

    standings
      .slice(0, competition.qualifiersPerGroup)
      .forEach((row, index) => {
        groupQualifiers.set(
          groupQualifierKey(group.id, index + 1),
          row.teamId,
        );
      });
  }

  const matchWinners = new Map<string, string>();
  for (const match of matchRows) {
    if (
      match.stage !== "knockout" ||
      match.isBye ||
      match.status === "cancelled" ||
      match.cancelledAt != null
    ) {
      continue;
    }
    const winner = match.resultVersions[0]?.tennisResult?.winnerTeamId;
    if (winner) {
      matchWinners.set(match.id, winner);
    }
  }

  const advancementMatches: AdvancementMatch[] = matchRows.map((match) => {
    const sourceFor = (side: "home" | "away"): AdvancementSource | null => {
      const slot = slotRows.find(
        (candidate) => candidate.matchId === match.id && candidate.side === side,
      );
      if (!slot) {
        return null;
      }
      if (slot.sourceType === "group_qualifier" && slot.groupId) {
        return {
          type: "group_qualifier",
          groupId: slot.groupId,
          groupPosition: slot.groupPosition ?? 1,
        };
      }
      if (slot.sourceType === "match_winner" && slot.sourceMatchId) {
        return {
          type: "match_winner",
          sourceMatchId: slot.sourceMatchId,
        };
      }
      return { type: "bye" };
    };

    return {
      id: match.id,
      stage: match.stage,
      roundNumber: match.roundNumber,
      bracketSlot: match.bracketSlot,
      isBye: match.isBye,
      home: sourceFor("home"),
      away: sourceFor("away"),
    };
  });

  const resolved = resolveKnockoutEntrants(advancementMatches, {
    groupQualifiers,
    matchWinners,
    resolveByes: true,
  });

  const publishedKnockoutIds = new Set(
    matchRows
      .filter(
        (match) =>
          match.stage === "knockout" &&
          match.resultVersions.some((version) => version.isCurrent),
      )
      .map((match) => match.id),
  );

  const editableTargets = matchRows
    .filter(
      (match) =>
        match.stage === "knockout" &&
        !match.isBye &&
        !publishedKnockoutIds.has(match.id),
    )
    .map((match) => match.id);

  if (!editableTargets.length) {
    return { competitionId, updatedEntries: 0 };
  }

  await tx
    .delete(matchEntries)
    .where(inArray(matchEntries.matchId, editableTargets));

  const values = resolved.entries
    .filter((entry) => editableTargets.includes(entry.matchId))
    .map((entry) => ({
      matchId: entry.matchId,
      side: entry.side,
      teamId: entry.teamId,
    }));

  if (values.length) {
    await tx.insert(matchEntries).values(values);
  }

  return { competitionId, updatedEntries: values.length };
}
