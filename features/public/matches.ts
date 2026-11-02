import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/lib/db/client";
import {
  competitions,
  footballResults,
  matchEntries,
  matches,
  resultVersions,
  teams,
  tennisResults,
  venues,
} from "@/lib/db/schema";
import type { PublicMatch, Sport } from "@/features/public/types";

const homeEntry = alias(matchEntries, "public_home_entry");
const awayEntry = alias(matchEntries, "public_away_entry");
const homeTeam = alias(teams, "public_home_team");
const awayTeam = alias(teams, "public_away_team");

export type PublicMatchRow = {
  id: string;
  competitionId: string;
  competitionName: string;
  competitionSlug: string;
  sport: Sport;
  groupId: string | null;
  roundLabel: string | null;
  startsAt: Date | null;
  status: string;
  venueName: string | null;
  homeTeamId: string;
  homeTeamName: string;
  awayTeamId: string;
  awayTeamName: string;
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
  return {
    homeScore:
      row.footballHomeScore == null ? null : String(row.footballHomeScore),
    awayScore:
      row.footballAwayScore == null ? null : String(row.footballAwayScore),
    detail: isWalkover ? "W.O." : null,
    winnerTeamId:
      row.footballWalkoverWinnerTeamId ??
      (row.footballHomeScore == null || row.footballAwayScore == null
        ? null
        : row.footballHomeScore > row.footballAwayScore
          ? row.homeTeamId
          : row.awayTeamId),
  };
}

export function mapPublicMatch(row: PublicMatchRow): PublicMatch {
  const score = scoreSummary(row);

  return {
    id: row.id,
    competitionId: row.competitionId,
    competitionName: row.competitionName,
    competitionSlug: row.competitionSlug,
    sport: row.sport,
    groupId: row.groupId,
    roundLabel: row.roundLabel,
    startsAt: toIso(row.startsAt),
    status: row.status,
    venueName: row.venueName,
    homeTeamId: row.homeTeamId,
    homeTeamName: row.homeTeamName,
    awayTeamId: row.awayTeamId,
    awayTeamName: row.awayTeamName,
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
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      groupId: matches.groupId,
      roundLabel: matches.roundLabel,
      startsAt: matches.startsAt,
      status: matches.status,
      venueName: venues.name,
      homeTeamId: homeTeam.id,
      homeTeamName: homeTeam.name,
      awayTeamId: awayTeam.id,
      awayTeamName: awayTeam.name,
      tennisSets: tennisResults.sets,
      tennisWinnerTeamId: tennisResults.winnerTeamId,
      tennisWalkover: tennisResults.isWalkover,
      footballHomeScore: footballResults.homeScore,
      footballAwayScore: footballResults.awayScore,
      footballWalkover: footballResults.isWalkover,
      footballWalkoverWinnerTeamId: footballResults.walkoverWinnerTeamId,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .innerJoin(
      homeEntry,
      and(eq(homeEntry.matchId, matches.id), eq(homeEntry.side, "home")),
    )
    .innerJoin(homeTeam, eq(homeTeam.id, homeEntry.teamId))
    .innerJoin(
      awayEntry,
      and(eq(awayEntry.matchId, matches.id), eq(awayEntry.side, "away")),
    )
    .innerJoin(awayTeam, eq(awayTeam.id, awayEntry.teamId))
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
