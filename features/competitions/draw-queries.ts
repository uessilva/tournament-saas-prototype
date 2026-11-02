import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  groupEntries,
  groups,
  matches,
  resultVersions,
  teams,
} from "@/lib/db/schema";
import {
  buildDrawPlan,
  bracketRoundCount,
  nextPowerOfTwo,
  validateDrawConfig,
  type DrawConfig,
  type DrawEntrant,
  type DrawSource,
} from "@/features/competitions/draw";
import {
  mapPublicMatch,
  publicMatchQuery,
} from "@/features/public/matches";
import type { PublicMatch, PublicMatchSource } from "@/features/public/types";
import type {
  AdminDrawData,
  DrawFixtureView,
  DrawGroupView,
  DrawSideView,
} from "@/features/competitions/types";

export function defaultDrawSeed(competitionId: string) {
  return `summer-cup-${competitionId.slice(0, 8)}`;
}

export async function hasConfirmedResult(competitionId: string) {
  const [row] = await db
    .select({ id: resultVersions.id })
    .from(resultVersions)
    .innerJoin(matches, eq(resultVersions.matchId, matches.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(resultVersions.isCurrent, true),
      ),
    )
    .limit(1);

  return Boolean(row);
}

function toPublicSource(source: DrawSource): PublicMatchSource {
  if (source.type === "group_qualifier") {
    return {
      type: "group_qualifier",
      groupName: source.groupName,
      position: source.position,
    };
  }
  if (source.type === "match_winner") {
    return {
      type: "match_winner",
      roundNumber: source.roundNumber,
      bracketSlot: source.bracketSlot,
    };
  }
  return { type: "bye" };
}

function side(teamId: string | null, teamName: string | null, source: PublicMatchSource | null): DrawSideView {
  return { teamId, teamName, source };
}

export function drawFixtureFromMatch(match: PublicMatch): DrawFixtureView {
  return {
    id: match.id,
    matchNumber: match.matchNumber,
    stage: match.stage,
    groupName: match.groupName,
    roundNumber: match.roundNumber,
    bracketSlot: match.bracketSlot,
    isBye: match.isBye,
    home: side(match.homeTeamId, match.homeTeamName, match.homeSource),
    away: side(match.awayTeamId, match.awayTeamName, match.awaySource),
    status: match.status,
    startsAt: match.startsAt,
    venueName: match.venueName,
  };
}

async function loadPersistedDraw(competitionId: string) {
  const groupRows = await db
    .select({ id: groups.id, name: groups.name, sortOrder: groups.sortOrder })
    .from(groups)
    .where(eq(groups.competitionId, competitionId))
    .orderBy(asc(groups.sortOrder), asc(groups.name));

  const entryRows = groupRows.length
    ? await db
        .select({
          groupId: groupEntries.groupId,
          teamId: groupEntries.teamId,
          teamName: teams.name,
          seedPosition: groupEntries.seedPosition,
        })
        .from(groupEntries)
        .innerJoin(teams, eq(groupEntries.teamId, teams.id))
        .where(eq(teams.competitionId, competitionId))
        .orderBy(asc(groupEntries.seedPosition))
    : [];

  const matchRows = await publicMatchQuery()
    .where(eq(matches.competitionId, competitionId))
    .orderBy(asc(matches.matchNumber));

  if (!groupRows.length && !matchRows.length) {
    return null;
  }

  const matchViews = matchRows.map(mapPublicMatch);
  const groupViews: DrawGroupView[] = groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    qualifiers: 0,
    entrants: entryRows
      .filter((entry) => entry.groupId === group.id)
      .map((entry) => ({
        teamId: entry.teamId,
        name: entry.teamName,
        seedPosition: entry.seedPosition,
      })),
  }));

  return {
    groups: groupViews,
    groupFixtures: matchViews
      .filter((match) => match.stage === "group")
      .map(drawFixtureFromMatch),
    knockoutFixtures: matchViews
      .filter((match) => match.stage === "knockout")
      .map(drawFixtureFromMatch),
  };
}

export async function getAdminDrawData({
  competition,
  entrants,
  eligibleEntrantCount,
}: {
  competition: {
    id: string;
    drawSeed: string | null;
    drawGeneratedAt: Date | null;
    groupCount: number;
    qualifiersPerGroup: number;
  };
  entrants: DrawEntrant[];
  eligibleEntrantCount: number;
}): Promise<AdminDrawData> {
  const confirmedResultExists = await hasConfirmedResult(competition.id);
  const generated = competition.drawGeneratedAt != null;
  const seed = competition.drawSeed ?? defaultDrawSeed(competition.id);
  const config: DrawConfig = {
    groupCount: competition.groupCount,
    qualifiersPerGroup: competition.qualifiersPerGroup,
    seed,
  };
  const validationErrors = validateDrawConfig({
    entrantCount: entrants.length,
    eligibleEntrantCount,
    groupCount: config.groupCount,
    qualifiersPerGroup: config.qualifiersPerGroup,
  });

  if (generated) {
    const persisted = await loadPersistedDraw(competition.id);
    if (persisted) {
      const qualifierCount =
        config.groupCount * config.qualifiersPerGroup;
      const bracketSize = nextPowerOfTwo(Math.max(2, qualifierCount));
      return {
        generated,
        canEdit: !confirmedResultExists,
        confirmedResultExists,
        seed,
        groupCount: config.groupCount,
        qualifiersPerGroup: config.qualifiersPerGroup,
        bracketSize,
        knockoutRoundCount: bracketRoundCount(bracketSize),
        validationErrors,
        groups: persisted.groups.map((group) => ({
          ...group,
          qualifiers: config.qualifiersPerGroup,
        })),
        groupFixtures: persisted.groupFixtures,
        knockoutFixtures: persisted.knockoutFixtures,
      };
    }
  }

  const qualifierCount = config.groupCount * config.qualifiersPerGroup;
  const bracketSize = nextPowerOfTwo(Math.max(2, qualifierCount));
  const fallback: AdminDrawData = {
    generated,
    canEdit: !confirmedResultExists,
    confirmedResultExists,
    seed,
    groupCount: config.groupCount,
    qualifiersPerGroup: config.qualifiersPerGroup,
    bracketSize,
    knockoutRoundCount: bracketRoundCount(bracketSize),
    validationErrors,
    groups: [],
    groupFixtures: [],
    knockoutFixtures: [],
  };

  if (validationErrors.length) {
    return fallback;
  }

  const plan = buildDrawPlan(entrants, config);
  const entrantNames = new Map(
    plan.groups.flatMap((group) =>
      group.entrants.map((entrant) => [entrant.id, entrant.name] as const),
    ),
  );
  const groups: DrawGroupView[] = plan.groups.map((group) => ({
    id: null,
    name: group.name,
    qualifiers: config.qualifiersPerGroup,
    entrants: group.entrants.map((entrant) => ({
      teamId: entrant.id,
      name: entrant.name,
      seedPosition: entrant.seedPosition,
    })),
  }));

  return {
    ...fallback,
    groups,
    groupFixtures: plan.groupFixtures.map((fixture) => ({
      id: null,
      matchNumber: null,
      stage: "group" as const,
      groupName: plan.groups[fixture.groupIndex]!.name,
      roundNumber: fixture.roundNumber,
      bracketSlot: null,
      isBye: false,
      home: side(
        fixture.homeEntrantId,
        entrantNames.get(fixture.homeEntrantId) ?? null,
        null,
      ),
      away: side(
        fixture.awayEntrantId,
        entrantNames.get(fixture.awayEntrantId) ?? null,
        null,
      ),
      status: "scheduled",
      startsAt: null,
      venueName: null,
    })),
    knockoutFixtures: plan.knockoutFixtures.map((fixture) => ({
      id: null,
      matchNumber: null,
      stage: "knockout" as const,
      groupName: null,
      roundNumber: fixture.roundNumber,
      bracketSlot: fixture.bracketSlot,
      isBye: fixture.isBye,
      home: side(null, null, toPublicSource(fixture.sources[0])),
      away: side(null, null, toPublicSource(fixture.sources[1])),
      status: "scheduled",
      startsAt: null,
      venueName: null,
    })),
  };
}
