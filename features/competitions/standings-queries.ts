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
import type { CompetitionFormat } from "@/features/competitions/draw";
import type { CompetitionGroup } from "@/features/competitions/types";
import type { PublicMatch } from "@/features/public/types";
import { mapPublicMatch, publicMatchQuery } from "@/features/public/matches";

type StandingsTeam = {
  teamId: string;
  teamName: string;
  seedPosition: number;
};

type StandingsCompetition = {
  id: string;
  sport: "football" | "tennis";
  format: CompetitionFormat;
  drawSeed: string | null;
};

function footballGroup(
  group: { id: string; name: string },
  teams: StandingsTeam[],
  results: PublicMatch[],
  drawSeed: string,
  allMatches = false,
): CompetitionGroup {
  const standingsMatches = results
    .filter(
      (match) =>
        (allMatches || match.groupId === group.id) &&
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
    teams,
    standingsMatches,
    drawSeed,
  );

  return {
    id: group.id,
    name: group.name,
    standings: calculated.rows,
    seededDraws: calculated.seededDraws,
  };
}

function tennisGroup(
  group: { id: string; name: string },
  teams: StandingsTeam[],
  results: PublicMatch[],
  drawSeed: string,
  allMatches = false,
): CompetitionGroup {
  const standingsMatches = results
    .filter(
      (match) =>
        (allMatches || match.groupId === group.id) &&
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
      teams,
      standingsMatches,
      drawSeed,
    ),
    seededDraws: [],
  };
}

async function loadLeagueTable(
  competition: StandingsCompetition,
): Promise<CompetitionGroup[]> {
  const teamRows = await db
    .select({ id: teams.id, name: teams.name, seedPosition: teams.seedPosition })
    .from(teams)
    .where(eq(teams.competitionId, competition.id))
    .orderBy(asc(teams.seedPosition), asc(teams.name));

  if (!teamRows.length) {
    return [];
  }

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
  const standingsTeams = teamRows.map((team, index) => ({
    teamId: team.id,
    teamName: team.name,
    seedPosition: team.seedPosition ?? index + 1,
  }));
  const league = { id: competition.id, name: "league" };

  return [
    competition.sport === "football"
      ? footballGroup(
          league,
          standingsTeams,
          results,
          competition.drawSeed ?? competition.id,
          true,
        )
      : tennisGroup(
          league,
          standingsTeams,
          results,
          competition.drawSeed ?? competition.id,
          true,
        ),
  ];
}

/**
 * Builds every public table from current confirmed result versions. A round
 * robin has one league table holding every entrant; groups + knockout keeps
 * one table per group; single elimination has no table at all. Cancelled
 * Matches are excluded even though their schedule history is retained.
 */
export async function loadCompetitionStandings(
  competition: StandingsCompetition,
): Promise<CompetitionGroup[]> {
  if (competition.format === "single_elimination") {
    return [];
  }
  if (competition.format === "round_robin") {
    return loadLeagueTable(competition);
  }

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

    return competition.sport === "football"
      ? footballGroup(
          group,
          standingsTeams,
          results,
          competition.drawSeed ?? competition.id,
        )
      : tennisGroup(
          group,
          standingsTeams,
          results,
          competition.drawSeed ?? competition.id,
        );
  });
}
