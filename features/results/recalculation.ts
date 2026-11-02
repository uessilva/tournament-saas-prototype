import { and, eq, isNull, ne } from "drizzle-orm";

import type { db } from "@/lib/db/client";
import {
  competitions,
  footballResults,
  groupEntries,
  groups,
  matchEntries,
  matchSlots,
  matches,
  resultVersions,
  teams,
} from "@/lib/db/schema";
import { calculateFootballStandings } from "@/features/competitions/football-standings";
import {
  groupQualifierKey,
  resolveKnockoutEntrants,
  type AdvancementMatch,
  type AdvancementSource,
} from "@/features/matches/advancement";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProposedFootballResult = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  isWalkover: boolean;
  walkoverWinnerSide?: "home" | "away" | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  winnerTeamId: string | null;
};

type MatchRow = {
  id: string;
  stage: "group" | "knockout";
  roundNumber: number;
  bracketSlot: number | null;
  groupId: string | null;
  isBye: boolean;
  status: string;
  cancelledAt: Date | null;
};

type ResultSnapshot = {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isWalkover: boolean;
  walkoverWinnerTeamId: string | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
  winnerTeamId: string | null;
};

function winnerFromResult(result: {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  isWalkover: boolean;
  walkoverWinnerTeamId: string | null;
  penaltyHome: number | null;
  penaltyAway: number | null;
}) {
  if (result.isWalkover) {
    return result.walkoverWinnerTeamId;
  }
  if (
    result.penaltyHome != null &&
    result.penaltyAway != null &&
    result.penaltyHome !== result.penaltyAway
  ) {
    return result.penaltyHome > result.penaltyAway
      ? result.homeTeamId
      : result.awayTeamId;
  }
  if (result.homeScore > result.awayScore) {
    return result.homeTeamId;
  }
  if (result.awayScore > result.homeScore) {
    return result.awayTeamId;
  }
  return null;
}

export type CompetitionAdvancementPlan = {
  matches: MatchRow[];
  desiredEntries: Array<{
    matchId: string;
    side: "home" | "away";
    teamId: string;
  }>;
  currentEntries: Array<{
    matchId: string;
    side: "home" | "away";
    teamId: string;
  }>;
  currentResultMatchIds: Set<string>;
  groupQualifiers: Map<string, string>;
  winners: Map<string, string>;
  blockedMatchIds: string[];
};

/**
 * Computes the knockout entries implied by the current confirmed results (or a
 * proposed replacement for one Match). Group tables, qualifiers and winners
 * all flow from the same snapshot, so publication and correction stay
 * consistent even when a group result changes several downstream slots.
 */
export async function planCompetitionAdvancement(
  tx: Transaction,
  competitionId: string,
  proposed?: ProposedFootballResult,
  removedMatchId?: string,
): Promise<CompetitionAdvancementPlan> {
  const [competition] = await tx
    .select({
      id: competitions.id,
      qualifiersPerGroup: competitions.qualifiersPerGroup,
      drawSeed: competitions.drawSeed,
    })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition) {
    throw new Error("competition_not_found");
  }

  const groupRows = await tx
    .select({ id: groups.id, name: groups.name, sortOrder: groups.sortOrder })
    .from(groups)
    .where(eq(groups.competitionId, competitionId))
    .orderBy(groups.sortOrder);

  const groupEntryRows = groupRows.length
    ? await tx
        .select({
          groupId: groupEntries.groupId,
          teamId: groupEntries.teamId,
          teamName: teams.name,
          seedPosition: groupEntries.seedPosition,
        })
        .from(groupEntries)
        .innerJoin(teams, eq(groupEntries.teamId, teams.id))
        .where(eq(teams.competitionId, competitionId))
        .orderBy(groupEntries.seedPosition)
    : [];

  const matchRows = await tx
    .select({
      id: matches.id,
      stage: matches.stage,
      roundNumber: matches.roundNumber,
      bracketSlot: matches.bracketSlot,
      groupId: matches.groupId,
      isBye: matches.isBye,
      status: matches.status,
      cancelledAt: matches.cancelledAt,
    })
    .from(matches)
    .where(eq(matches.competitionId, competitionId))
    .orderBy(matches.matchNumber);

  const matchIds = matchRows.map((match) => match.id);
  // Drizzle has no portable inArray when the list is empty; load all entries
  // for the competition via the matches join instead.
  const allEntryRows = matchIds.length
    ? await tx
        .select({
          matchId: matchEntries.matchId,
          side: matchEntries.side,
          teamId: matchEntries.teamId,
        })
        .from(matchEntries)
        .innerJoin(matches, eq(matchEntries.matchId, matches.id))
        .where(eq(matches.competitionId, competitionId))
    : [];

  const entryByMatchSide = new Map(
    allEntryRows.map((entry) => [`${entry.matchId}:${entry.side}`, entry.teamId]),
  );

  const slotRows = matchIds.length
    ? await tx
        .select({
          matchId: matchSlots.matchId,
          side: matchSlots.side,
          sourceType: matchSlots.sourceType,
          groupId: matchSlots.groupId,
          groupPosition: matchSlots.groupPosition,
          sourceMatchId: matchSlots.sourceMatchId,
        })
        .from(matchSlots)
        .innerJoin(matches, eq(matchSlots.matchId, matches.id))
        .where(eq(matches.competitionId, competitionId))
    : [];

  const resultRows = await tx
    .select({
      matchId: resultVersions.matchId,
      homeScore: footballResults.homeScore,
      awayScore: footballResults.awayScore,
      isWalkover: footballResults.isWalkover,
      walkoverWinnerTeamId: footballResults.walkoverWinnerTeamId,
      penaltyHome: footballResults.penaltyHome,
      penaltyAway: footballResults.penaltyAway,
    })
    .from(resultVersions)
    .innerJoin(matches, eq(resultVersions.matchId, matches.id))
    .innerJoin(
      footballResults,
      eq(footballResults.resultVersionId, resultVersions.id),
    )
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(resultVersions.isCurrent, true),
        ne(matches.status, "cancelled"),
        isNull(matches.cancelledAt),
      ),
    );

  const results = new Map<string, ResultSnapshot>();
  for (const row of resultRows) {
    const homeTeamId = entryByMatchSide.get(`${row.matchId}:home`);
    const awayTeamId = entryByMatchSide.get(`${row.matchId}:away`);
    if (!homeTeamId || !awayTeamId) {
      continue;
    }
    results.set(row.matchId, {
      matchId: row.matchId,
      homeTeamId,
      awayTeamId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      isWalkover: row.isWalkover,
      walkoverWinnerTeamId: row.walkoverWinnerTeamId,
      penaltyHome: row.penaltyHome,
      penaltyAway: row.penaltyAway,
      winnerTeamId: winnerFromResult({
        homeTeamId,
        awayTeamId,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        isWalkover: row.isWalkover,
        walkoverWinnerTeamId: row.walkoverWinnerTeamId,
        penaltyHome: row.penaltyHome,
        penaltyAway: row.penaltyAway,
      }),
    });
  }

  if (proposed) {
    const homeTeamId = entryByMatchSide.get(`${proposed.matchId}:home`);
    const awayTeamId = entryByMatchSide.get(`${proposed.matchId}:away`);
    if (!homeTeamId || !awayTeamId) {
      throw new Error("match_entrants_missing");
    }
    const walkoverWinnerTeamId = proposed.isWalkover
      ? proposed.walkoverWinnerSide === "home"
        ? homeTeamId
        : proposed.walkoverWinnerSide === "away"
          ? awayTeamId
          : null
      : null;
    results.set(proposed.matchId, {
      matchId: proposed.matchId,
      homeTeamId,
      awayTeamId,
      homeScore: proposed.homeScore,
      awayScore: proposed.awayScore,
      isWalkover: proposed.isWalkover,
      walkoverWinnerTeamId,
      penaltyHome: proposed.penaltyHome ?? null,
      penaltyAway: proposed.penaltyAway ?? null,
      winnerTeamId: proposed.winnerTeamId,
    });
  }

  if (removedMatchId) {
    results.delete(removedMatchId);
  }

  const groupQualifiers = new Map<string, string>();
  for (const group of groupRows) {
    const standingsTeams = groupEntryRows
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        seedPosition: entry.seedPosition,
      }));
    const standingsMatches = [...results.values()]
      .filter((result) => {
        const match = matchRows.find((candidate) => candidate.id === result.matchId);
        return match?.stage === "group" && match.groupId === group.id;
      })
      .map((result) => ({
        homeTeamId: result.homeTeamId,
        awayTeamId: result.awayTeamId,
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        isWalkover: result.isWalkover,
        walkoverWinnerTeamId: result.walkoverWinnerTeamId,
      }));

    const calculated = calculateFootballStandings(
      standingsTeams,
      standingsMatches,
      competition.drawSeed ?? competition.id,
    );
    for (
      let position = 1;
      position <= competition.qualifiersPerGroup;
      position += 1
    ) {
      const teamId = calculated.rows[position - 1]?.teamId;
      if (teamId) {
        groupQualifiers.set(groupQualifierKey(group.id, position), teamId);
      }
    }
  }

  const matchWinners = new Map<string, string>();
  for (const result of results.values()) {
    if (result.winnerTeamId) {
      matchWinners.set(result.matchId, result.winnerTeamId);
    }
  }

  const slotByMatchSide = new Map(
    slotRows.map((slot) => [`${slot.matchId}:${slot.side}`, slot]),
  );

  const advancementMatches: AdvancementMatch[] = matchRows
    .filter((match) => match.stage === "knockout")
    .map((match) => {
      const sourceFor = (side: "home" | "away"): AdvancementSource | null => {
        const slot = slotByMatchSide.get(`${match.id}:${side}`);
        if (!slot) {
          return null;
        }
        if (slot.sourceType === "bye") {
          return { type: "bye" };
        }
        if (slot.sourceType === "group_qualifier") {
          return {
            type: "group_qualifier",
            groupId: slot.groupId!,
            groupPosition: slot.groupPosition!,
          };
        }
        return {
          type: "match_winner",
          sourceMatchId: slot.sourceMatchId!,
        };
      };

      return {
        id: match.id,
        stage: "knockout",
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

  const currentResultMatchIds = new Set(results.keys());
  const desiredByMatchSide = new Map(
    resolved.entries.map((entry) => [
      `${entry.matchId}:${entry.side}`,
      entry.teamId,
    ]),
  );

  const blockedMatchIds: string[] = [];
  for (const match of matchRows) {
    if (match.stage !== "knockout" || match.isBye) {
      continue;
    }
    if (!currentResultMatchIds.has(match.id) || match.id === proposed?.matchId) {
      continue;
    }
    for (const side of ["home", "away"] as const) {
      const desired = desiredByMatchSide.get(`${match.id}:${side}`) ?? null;
      const current = entryByMatchSide.get(`${match.id}:${side}`) ?? null;
      if (desired !== current) {
        blockedMatchIds.push(match.id);
        break;
      }
    }
  }

  return {
    matches: matchRows,
    desiredEntries: resolved.entries,
    currentEntries: allEntryRows,
    currentResultMatchIds,
    groupQualifiers,
    winners: resolved.winners,
    blockedMatchIds,
  };
}

/**
 * Applies the plan inside the caller's transaction. Only playable knockout
 * slots are touched; group fixtures and published sides remain intact.
 */
export async function applyCompetitionAdvancement(
  tx: Transaction,
  plan: CompetitionAdvancementPlan,
) {
  const desired = new Map(
    plan.desiredEntries.map((entry) => [
      `${entry.matchId}:${entry.side}`,
      entry.teamId,
    ]),
  );
  const current = new Map(
    plan.currentEntries.map((entry) => [
      `${entry.matchId}:${entry.side}`,
      entry.teamId,
    ]),
  );
  let updatedEntries = 0;

  for (const match of plan.matches) {
    if (match.stage !== "knockout" || match.isBye) {
      continue;
    }
    for (const side of ["home", "away"] as const) {
      const key = `${match.id}:${side}`;
      const teamId = desired.get(key) ?? null;
      const existing = current.get(key) ?? null;
      if (teamId === existing) {
        continue;
      }
      if (!teamId) {
        await tx
          .delete(matchEntries)
          .where(
            and(
              eq(matchEntries.matchId, match.id),
              eq(matchEntries.side, side),
            ),
          );
        updatedEntries += 1;
        continue;
      }
      if (existing) {
        await tx
          .update(matchEntries)
          .set({ teamId })
          .where(
            and(
              eq(matchEntries.matchId, match.id),
              eq(matchEntries.side, side),
            ),
          );
      } else {
        await tx.insert(matchEntries).values({
          matchId: match.id,
          side,
          teamId,
        });
      }
      updatedEntries += 1;
    }
  }

  return { updatedEntries };
}

/**
 * Atomic recalculation entry point for result publication, correction and
 * reopening. Standings and leaders are derived from current result versions at
 * read time; advancement slots are persisted here in the same transaction.
 */
export async function recalculateCompetition(
  tx: Transaction,
  competitionId: string,
): Promise<{ competitionId: string; updatedEntries: number }> {
  const plan = await planCompetitionAdvancement(tx, competitionId);
  const applied = await applyCompetitionAdvancement(tx, plan);
  return { competitionId, updatedEntries: applied.updatedEntries };
}

