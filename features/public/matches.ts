import { and, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import {
  competitions,
  footballResults,
  groups,
  matchEntries,
  matchSlots,
  matches,
  resultVersions,
  teams,
  tennisResults,
  venues,
} from "@/lib/db/schema";
import {
  bracketRoundCount,
  nextPowerOfTwo,
} from "@/features/competitions/draw";
import { effectiveDurationMinutes } from "@/features/matches/scheduling";
import type {
  PublicMatch,
  PublicMatchSource,
  Sport,
} from "@/features/public/types";

const homeEntry = alias(matchEntries, "public_home_entry");
const awayEntry = alias(matchEntries, "public_away_entry");
const homeTeam = alias(teams, "public_home_team");
const awayTeam = alias(teams, "public_away_team");
const groupName = alias(groups, "public_match_group");
const homeSlot = alias(matchSlots, "public_home_slot");
const awaySlot = alias(matchSlots, "public_away_slot");
const homeSlotGroup = alias(groups, "public_home_slot_group");
const awaySlotGroup = alias(groups, "public_away_slot_group");
const homeSourceMatch = alias(matches, "public_home_source_match");
const awaySourceMatch = alias(matches, "public_away_source_match");

export type PublicMatchRow = {
  id: string;
  matchNumber: number;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: Sport;
  groupCount: number;
  qualifiersPerGroup: number;
  stage: "group" | "knockout";
  groupId: string | null;
  groupName: string | null;
  roundLabel: string | null;
  roundNumber: number;
  bracketSlot: number | null;
  isBye: boolean;
  startsAt: Date | null;
  durationOverrideMinutes: number | null;
  defaultDurationMinutes: number;
  status: string;
  venueId: string | null;
  venueName: string | null;
  homeTeamId: string | null;
  homeTeamName: string | null;
  awayTeamId: string | null;
  awayTeamName: string | null;
  homeSlotSourceType: "group_qualifier" | "match_winner" | "bye" | null;
  homeSlotGroupName: string | null;
  homeSlotGroupPosition: number | null;
  homeSlotSourceRoundNumber: number | null;
  homeSlotSourceBracketSlot: number | null;
  awaySlotSourceType: "group_qualifier" | "match_winner" | "bye" | null;
  awaySlotGroupName: string | null;
  awaySlotGroupPosition: number | null;
  awaySlotSourceRoundNumber: number | null;
  awaySlotSourceBracketSlot: number | null;
  tennisSets: Array<{
    home: number;
    away: number;
    tiebreakHome?: number;
    tiebreakAway?: number;
  }> | null;
  tennisWinnerTeamId: string | null;
  tennisWalkover: boolean | null;
  footballHomeScore: number | null;
  footballAwayScore: number | null;
  footballWalkover: boolean | null;
  footballWalkoverWinnerTeamId: string | null;
  footballPenaltyHome: number | null;
  footballPenaltyAway: number | null;
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function tennisScore(
  sets: Array<{
    home: number;
    away: number;
    tiebreakHome?: number;
    tiebreakAway?: number;
  }>,
  winnerTeamId: string | null,
  isWalkover: boolean,
) {
  let homeSets = 0;
  let awaySets = 0;

  for (const set of sets) {
    if (set.home > set.away) {
      homeSets += 1;
    } else {
      awaySets += 1;
    }
  }

  const detail = isWalkover
    ? "W.O."
    : sets
        .map((set) => {
          const tiebreak =
            set.tiebreakHome != null && set.tiebreakAway != null
              ? ` (${set.tiebreakHome}–${set.tiebreakAway})`
              : "";
          return `${set.home}–${set.away}${tiebreak}`;
        })
        .join(" · ");

  return {
    homeScore: String(homeSets),
    awayScore: String(awaySets),
    detail,
    winnerTeamId,
  };
}

function scoreSummary(row: PublicMatchRow) {
  if (row.sport === "tennis") {
    if (row.tennisWinnerTeamId == null && row.tennisSets == null) {
      return {
        homeScore: null,
        awayScore: null,
        detail: null,
        winnerTeamId: null,
      };
    }

    return tennisScore(
      row.tennisSets ?? [],
      row.tennisWinnerTeamId,
      row.tennisWalkover ?? false,
    );
  }

  const isWalkover = row.footballWalkover ?? false;
  const hasScore =
    row.footballHomeScore != null && row.footballAwayScore != null;
  const hasPenalties =
    row.footballPenaltyHome != null && row.footballPenaltyAway != null;

  return {
    homeScore:
      row.footballHomeScore == null ? null : String(row.footballHomeScore),
    awayScore:
      row.footballAwayScore == null ? null : String(row.footballAwayScore),
    detail: isWalkover
      ? "W.O."
      : hasPenalties
        ? `pên. ${row.footballPenaltyHome}–${row.footballPenaltyAway}`
        : null,
    winnerTeamId:
      row.footballWalkoverWinnerTeamId ??
      (hasPenalties
        ? row.footballPenaltyHome! > row.footballPenaltyAway!
          ? row.homeTeamId
          : row.awayTeamId
        : !hasScore
          ? null
          : row.footballHomeScore! > row.footballAwayScore!
            ? row.homeTeamId
            : row.footballHomeScore! < row.footballAwayScore!
              ? row.awayTeamId
              : null),
  };
}

function sideSource(
  type: PublicMatchRow["homeSlotSourceType"],
  groupNameValue: string | null,
  groupPosition: number | null,
  sourceRoundNumber: number | null,
  sourceBracketSlot: number | null,
): PublicMatchSource | null {
  if (type === "group_qualifier") {
    return {
      type,
      groupName: groupNameValue ?? "",
      position: groupPosition ?? 1,
    };
  }
  if (type === "match_winner") {
    return {
      type,
      roundNumber: sourceRoundNumber ?? 1,
      bracketSlot: sourceBracketSlot ?? 1,
    };
  }
  if (type === "bye") {
    return { type };
  }
  return null;
}

export function mapPublicMatch(row: PublicMatchRow): PublicMatch {
  const score = scoreSummary(row);
  const bracketSize = nextPowerOfTwo(
    Math.max(2, row.groupCount * row.qualifiersPerGroup),
  );

  return {
    id: row.id,
    matchNumber: row.matchNumber,
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    competitionSlug: row.competitionSlug,
    sport: row.sport,
    stage: row.stage,
    groupId: row.groupId,
    groupName: row.groupName,
    roundLabel: row.roundLabel,
    roundNumber: row.roundNumber,
    bracketSlot: row.bracketSlot,
    bracketSize,
    knockoutRoundCount: bracketRoundCount(bracketSize),
    isBye: row.isBye,
    startsAt: toIso(row.startsAt),
    durationMinutes: effectiveDurationMinutes(
      row.durationOverrideMinutes,
      row.defaultDurationMinutes,
    ),
    durationOverrideMinutes: row.durationOverrideMinutes,
    status: row.status,
    venueId: row.venueId,
    venueName: row.venueName,
    homeTeamId: row.homeTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamId: row.awayTeamId,
    awayTeamName: row.awayTeamName,
    homeSource: sideSource(
      row.homeSlotSourceType,
      row.homeSlotGroupName,
      row.homeSlotGroupPosition,
      row.homeSlotSourceRoundNumber,
      row.homeSlotSourceBracketSlot,
    ),
    awaySource: sideSource(
      row.awaySlotSourceType,
      row.awaySlotGroupName,
      row.awaySlotGroupPosition,
      row.awaySlotSourceRoundNumber,
      row.awaySlotSourceBracketSlot,
    ),
    homeScore: score.homeScore,
    awayScore: score.awayScore,
    scoreDetail: score.detail,
    winnerTeamId: score.winnerTeamId,
    isWalkover:
      row.sport === "tennis"
        ? (row.tennisWalkover ?? false)
        : (row.footballWalkover ?? false),
    isCancelled: row.status === "cancelled",
    sets: row.tennisSets ?? null,
  };
}

export function publicMatchQuery() {
  return db
    .select({
      id: matches.id,
      matchNumber: matches.matchNumber,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      groupCount: competitions.groupCount,
      qualifiersPerGroup: competitions.qualifiersPerGroup,
      stage: matches.stage,
      groupId: matches.groupId,
      groupName: groupName.name,
      roundLabel: matches.roundLabel,
      roundNumber: matches.roundNumber,
      bracketSlot: matches.bracketSlot,
      isBye: matches.isBye,
      startsAt: matches.startsAt,
      durationOverrideMinutes: matches.durationMinutes,
      defaultDurationMinutes: competitions.defaultMatchDurationMinutes,
      status: matches.status,
      venueId: venues.id,
      venueName: venues.name,
      homeTeamId: homeTeam.id,
      homeTeamName: homeTeam.name,
      awayTeamId: awayTeam.id,
      awayTeamName: awayTeam.name,
      homeSlotSourceType: homeSlot.sourceType,
      homeSlotGroupName: homeSlotGroup.name,
      homeSlotGroupPosition: homeSlot.groupPosition,
      homeSlotSourceRoundNumber: homeSourceMatch.roundNumber,
      homeSlotSourceBracketSlot: homeSourceMatch.bracketSlot,
      awaySlotSourceType: awaySlot.sourceType,
      awaySlotGroupName: awaySlotGroup.name,
      awaySlotGroupPosition: awaySlot.groupPosition,
      awaySlotSourceRoundNumber: awaySourceMatch.roundNumber,
      awaySlotSourceBracketSlot: awaySourceMatch.bracketSlot,
      tennisSets: tennisResults.sets,
      tennisWinnerTeamId: tennisResults.winnerTeamId,
      tennisWalkover: tennisResults.isWalkover,
      footballHomeScore: footballResults.homeScore,
      footballAwayScore: footballResults.awayScore,
      footballWalkover: footballResults.isWalkover,
      footballWalkoverWinnerTeamId: footballResults.walkoverWinnerTeamId,
      footballPenaltyHome: footballResults.penaltyHome,
      footballPenaltyAway: footballResults.penaltyAway,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(groupName, eq(groupName.id, matches.groupId))
    .leftJoin(
      homeEntry,
      and(eq(homeEntry.matchId, matches.id), eq(homeEntry.side, "home")),
    )
    .leftJoin(homeTeam, eq(homeTeam.id, homeEntry.teamId))
    .leftJoin(
      awayEntry,
      and(eq(awayEntry.matchId, matches.id), eq(awayEntry.side, "away")),
    )
    .leftJoin(awayTeam, eq(awayTeam.id, awayEntry.teamId))
    .leftJoin(
      homeSlot,
      and(eq(homeSlot.matchId, matches.id), eq(homeSlot.side, "home")),
    )
    .leftJoin(homeSlotGroup, eq(homeSlotGroup.id, homeSlot.groupId))
    .leftJoin(homeSourceMatch, eq(homeSourceMatch.id, homeSlot.sourceMatchId))
    .leftJoin(
      awaySlot,
      and(eq(awaySlot.matchId, matches.id), eq(awaySlot.side, "away")),
    )
    .leftJoin(awaySlotGroup, eq(awaySlotGroup.id, awaySlot.groupId))
    .leftJoin(awaySourceMatch, eq(awaySourceMatch.id, awaySlot.sourceMatchId))
    .leftJoin(venues, eq(matches.venueId, venues.id))
    .leftJoin(
      resultVersions,
      and(
        eq(resultVersions.matchId, matches.id),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .leftJoin(
      tennisResults,
      eq(tennisResults.resultVersionId, resultVersions.id),
    )
    .leftJoin(
      footballResults,
      eq(footballResults.resultVersionId, resultVersions.id),
    );
}

/**
 * Fixtures involving any of the supplied Team ids. Called by the Manager area;
 * the public query boundary still hides nothing beyond the team relationship.
 */
export function publicMatchQueryForTeams(teamIds: string[]) {
  const query = publicMatchQuery();
  if (!teamIds.length) {
    return query.where(eq(matches.id, "00000000-0000-0000-0000-000000000000"));
  }
  return query.where(
    or(
      inArray(homeEntry.teamId, teamIds),
      inArray(awayEntry.teamId, teamIds),
    ),
  );
}
