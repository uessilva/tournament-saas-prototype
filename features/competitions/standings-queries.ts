import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groupEntries,
  groups,
  matches,
  teams,
} from "@/lib/db/schema";
import { calculateFootballStandings } from "@/features/competitions/football-standings";
import { calculateTennisStandings } from "@/features/competitions/tennis-standings";
import type { CompetitionGroup } from "@/features/competitions/types";
import { mapPublicMatch, publicMatchQuery } from "@/features/public/matches";

type StandingsCompetition = {
  id: string;
  sport: "football" | "tennis";
  drawSeed: string | null;
};

/**
 * Builds every group table from current confirmed result versions. Cancelled
 * Matches are excluded even though their schedule history is retained.
 */
export async function loadCompetitionStandings(
  competition: StandingsCompetition,
): Promise<CompetitionGroup[]> {
  const groupRows = await db
    .select({ id: groups.id, name: groups.name, sortOrder: groups.sortOrder })
    .from(groups)
    .where(eq(groups.competitionId, competition.id))
    .orderBy(asc(groups.sortOrder), asc(groups.name));

  if (!groupRows.length) {
    return [];
  }

  const groupIds = groupRows.map((group) => group.id);
  const entryRows = await db
    .select({
      groupId: groupEntries.groupId,
      teamId: groupEntries.teamId,
      teamName: teams.name,
      seedPosition: groupEntries.seedPosition,
    })
    .from(groupEntries)
    .innerJoin(teams, eq(groupEntries.teamId, teams.id))
    .where(inArray(groupEntries.groupId, groupIds))
    .orderBy(asc(groupEntries.seedPosition));

  const resultRows = await publicMatchQuery()
    .where(
      and(
        eq(matches.competitionId, competition.id),
        eq(matches.stage, "group"),
        ne(matches.status, "cancelled"),
        isNull(matches.cancelledAt),
      ),
    )
    .orderBy(asc(matches.matchNumber));

  const results = resultRows.map(mapPublicMatch);

  return groupRows.map((group) => {
    const standingsTeams = entryRows
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => ({
        teamId: entry.teamId,
        teamName: entry.teamName,
        seedPosition: entry.seedPosition,
      }));

    if (competition.sport === "football") {
      const standingsMatches = results
        .filter(
          (match) =>
            match.groupId === group.id &&
            match.homeTeamId != null &&
            match.awayTeamId != null &&
            match.homeScore != null &&
            match.awayScore != null,
        )
        .map((match) => ({
          homeTeamId: match.homeTeamId!,
          awayTeamId: match.awayTeamId!,
          homeScore: Number(match.homeScore),
          awayScore: Number(match.awayScore),
          isWalkover: match.isWalkover,
          walkoverWinnerTeamId: match.isWalkover ? match.winnerTeamId : null,
        }));

      const calculated = calculateFootballStandings(
        standingsTeams,
        standingsMatches,
        competition.drawSeed ?? competition.id,
      );

      return {
        id: group.id,
        name: group.name,
        standings: calculated.rows,
        seededDraws: calculated.seededDraws,
      };
    }

    const standingsMatches = results
      .filter(
        (match) =>
          match.groupId === group.id &&
          match.homeTeamId != null &&
          match.awayTeamId != null,
      )
      .map((match) => ({
        homeTeamId: match.homeTeamId!,
        awayTeamId: match.awayTeamId!,
        winnerTeamId: match.winnerTeamId,
        sets: match.sets,
        isWalkover: match.isWalkover,
      }));

    return {
      id: group.id,
      name: group.name,
      standings: calculateTennisStandings(
        standingsTeams,
        standingsMatches,
        competition.drawSeed ?? competition.id,
      ),
      seededDraws: [],
    };
  });
}
