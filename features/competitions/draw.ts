/**
 * Pure groups + knockout draw rules.
 *
 * Preview and persistence both call `buildDrawPlan`, so a stored seed and the
 * persisted entrant order always produce the same groups, fixtures and bracket.
 * `teams.seedPosition` is the draw order. Regenerating a draw uses
 * `randomizeDrawOrder` with the stored seed; swapping entrants exchanges their
 * draw positions directly.
 */

export const MIN_ENTRANTS_PER_GROUP = 2;
export const MIN_GROUPS = 2;
export const MAX_GROUPS = 8;
export const SUPPORTED_QUALIFIERS = [1, 2] as const;

export type QualifierPosition = (typeof SUPPORTED_QUALIFIERS)[number];

export type DrawConfig = {
  groupCount: number;
  qualifiersPerGroup: number;
  seed: string;
};

export type DrawEntrant = {
  id: string;
  name: string;
  seedPosition: number;
};

export type DrawGroup = {
  index: number;
  name: string;
  entrants: DrawEntrant[];
};

export type GroupQualifierSource = {
  type: "group_qualifier";
  groupIndex: number;
  groupName: string;
  position: number;
};

export type MatchWinnerSource = {
  type: "match_winner";
  roundNumber: number;
  bracketSlot: number;
};

export type ByeSource = {
  type: "bye";
};

export type DrawSource =
  | GroupQualifierSource
  | MatchWinnerSource
  | ByeSource;

export type GroupFixturePlan = {
  groupIndex: number;
  roundNumber: number;
  pairingIndex: number;
  homeEntrantId: string;
  awayEntrantId: string;
};

export type KnockoutFixturePlan = {
  roundNumber: number;
  bracketSlot: number;
  sources: [DrawSource, DrawSource];
  isBye: boolean;
};

export type DrawPlan = {
  config: DrawConfig;
  groups: DrawGroup[];
  groupFixtures: GroupFixturePlan[];
  knockoutFixtures: KnockoutFixturePlan[];
  bracketSize: number;
  knockoutRoundCount: number;
  qualifiers: GroupQualifierSource[];
  entrantCount: number;
};

export type DrawValidationError =
  | "not_enough_entrants"
  | "ineligible_entrants"
  | "invalid_group_count"
  | "invalid_qualifiers"
  | "group_below_min"
  | "insufficient_qualifiers";

export type DrawValidationInput = {
  entrantCount: number;
  eligibleEntrantCount: number;
  groupCount: number;
  qualifiersPerGroup: number;
};

export function validateDrawConfig({
  entrantCount,
  eligibleEntrantCount,
  groupCount,
  qualifiersPerGroup,
}: DrawValidationInput): DrawValidationError[] {
  const errors: DrawValidationError[] = [];

  if (entrantCount < 2) {
    errors.push("not_enough_entrants");
  }
  if (eligibleEntrantCount < entrantCount) {
    errors.push("ineligible_entrants");
  }
  if (
    !Number.isInteger(groupCount) ||
    groupCount < MIN_GROUPS ||
    groupCount > MAX_GROUPS
  ) {
    errors.push("invalid_group_count");
  }
  if (
    !Number.isInteger(qualifiersPerGroup) ||
    !SUPPORTED_QUALIFIERS.includes(
      qualifiersPerGroup as QualifierPosition,
    )
  ) {
    errors.push("invalid_qualifiers");
  }

  if (entrantCount >= 2 && groupCount >= 1) {
    const smallestGroup = Math.floor(entrantCount / groupCount);
    if (smallestGroup < MIN_ENTRANTS_PER_GROUP) {
      errors.push("group_below_min");
    }
    if (smallestGroup < qualifiersPerGroup) {
      errors.push("insufficient_qualifiers");
    }
  }

  return [...new Set(errors)];
}

export function groupName(index: number) {
  return String.fromCharCode(65 + index);
}

export function nextPowerOfTwo(value: number) {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
}

export function bracketRoundCount(bracketSize: number) {
  return Math.max(1, Math.log2(bracketSize));
}

export function nextKnockoutSlot(
  roundNumber: number,
  bracketSlot: number,
): { roundNumber: number; bracketSlot: number; side: "home" | "away" } {
  return {
    roundNumber: roundNumber + 1,
    bracketSlot: Math.ceil(bracketSlot / 2),
    side: bracketSlot % 2 === 1 ? "home" : "away",
  };
}

export function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small deterministic PRNG used only for reproducible draw order. */
export function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value =
      value + Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomizeDrawOrder(
  entrants: DrawEntrant[],
  seed: string,
): DrawEntrant[] {
  const ordered = [...entrants].sort(compareEntrants);
  const random = createSeededRandom(seed);
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
  }
  return ordered.map((entrant, index) => ({
    ...entrant,
    seedPosition: index + 1,
  }));
}

export function compareEntrants(a: DrawEntrant, b: DrawEntrant) {
  return (
    a.seedPosition - b.seedPosition ||
    a.name.localeCompare(b.name) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Standard bracket seed order, e.g. size 8 -> [1, 8, 4, 5, 2, 7, 3, 6].
 * Adjacent ranks meet in the first round; winners then pair in bracket order.
 */
export function standardBracketOrder(size: number) {
  let order = [1];
  while (order.length < size) {
    const nextSize = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, nextSize + 1 - seed);
    }
    order = next;
  }
  return order;
}

function groupFixturesFor(group: DrawGroup): GroupFixturePlan[] {
  const players: Array<DrawEntrant | null> = [...group.entrants];
  if (players.length < 2) {
    return [];
  }
  if (players.length % 2 === 1) {
    players.push(null);
  }

  const fixtures: GroupFixturePlan[] = [];
  const rounds = players.length - 1;
  for (let round = 0; round < rounds; round += 1) {
    let pairingIndex = 0;
    for (let index = 0; index < players.length / 2; index += 1) {
      const home = players[index];
      const away = players[players.length - 1 - index];
      if (home && away) {
        fixtures.push({
          groupIndex: group.index,
          roundNumber: round + 1,
          pairingIndex,
          homeEntrantId: home.id,
          awayEntrantId: away.id,
        });
        pairingIndex += 1;
      }
    }

    // Circle method: keep the first player fixed and rotate the rest.
    const fixed = players[0] ?? null;
    const rest = players.slice(1);
    rest.unshift(rest.pop() ?? null);
    players.splice(0, players.length, fixed, ...rest);
  }

  return fixtures;
}

function assignQualifierSeeds(
  groupCount: number,
  qualifiersPerGroup: number,
  bracketSize: number,
) {
  const totalQualifiers = groupCount * qualifiersPerGroup;
  const rankToSource = new Map<number, { groupIndex: number; position: number }>();

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    rankToSource.set(groupIndex + 1, { groupIndex, position: 1 });
  }

  if (qualifiersPerGroup === 1) {
    return rankToSource;
  }

  const order = standardBracketOrder(bracketSize);
  const partner = new Map<number, number>();
  for (let index = 0; index < order.length; index += 2) {
    const first = order[index]!;
    const second = order[index + 1]!;
    if (first <= totalQualifiers && second <= totalQualifiers) {
      partner.set(first, second);
      partner.set(second, first);
    }
  }

  const runnerRanks = Array.from(
    { length: groupCount },
    (_, index) => groupCount + index + 1,
  );
  const assigned = new Map<number, number>();
  const usedGroups = new Set<number>();

  const groupForRank = (rank: number): number | null => {
    if (rank <= groupCount) {
      return rank - 1;
    }
    return assigned.get(rank) ?? null;
  };

  const solve = (index: number): boolean => {
    if (index === runnerRanks.length) {
      return true;
    }

    const rank = runnerRanks[index]!;
    const partnerRank = partner.get(rank);
    const partnerGroup =
      partnerRank == null ? null : groupForRank(partnerRank);

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      if (usedGroups.has(groupIndex)) {
        continue;
      }
      if (partnerGroup === groupIndex) {
        continue;
      }
      assigned.set(rank, groupIndex);
      usedGroups.add(groupIndex);
      if (solve(index + 1)) {
        return true;
      }
      assigned.delete(rank);
      usedGroups.delete(groupIndex);
    }

    return false;
  };

  if (!solve(0)) {
    throw new Error(
      "Could not cross group qualifiers without a same-group first-round match.",
    );
  }

  for (const [rank, groupIndex] of assigned) {
    rankToSource.set(rank, { groupIndex, position: 2 });
  }

  return rankToSource;
}

export function buildDrawPlan(
  entrants: DrawEntrant[],
  config: DrawConfig,
): DrawPlan {
  const ordered = [...entrants].sort(compareEntrants);
  if (ordered.length < 2) {
    throw new Error("A draw needs at least two entrants.");
  }

  const groups: DrawGroup[] = Array.from(
    { length: config.groupCount },
    (_, index) => ({
      index,
      name: groupName(index),
      entrants: [],
    }),
  );

  ordered.forEach((entrant, index) => {
    const pass = Math.floor(index / config.groupCount);
    const offset = index % config.groupCount;
    const groupIndex =
      pass % 2 === 0 ? offset : config.groupCount - 1 - offset;
    groups[groupIndex]!.entrants.push(entrant);
  });

  const groupFixtures = groups.flatMap(groupFixturesFor);
  const totalQualifiers = groups.length * config.qualifiersPerGroup;
  const bracketSize = nextPowerOfTwo(totalQualifiers);
  const qualifierRanks = assignQualifierSeeds(
    groups.length,
    config.qualifiersPerGroup,
    bracketSize,
  );

  const qualifiers: GroupQualifierSource[] = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    for (
      let position = 1;
      position <= config.qualifiersPerGroup;
      position += 1
    ) {
      qualifiers.push({
        type: "group_qualifier",
        groupIndex,
        groupName: groupName(groupIndex),
        position,
      });
    }
  }

  const sourceForRank = (rank: number): DrawSource => {
    if (rank > totalQualifiers) {
      return { type: "bye" };
    }
    const seed = qualifierRanks.get(rank);
    if (!seed) {
      throw new Error(`Missing qualifier seed for bracket rank ${rank}.`);
    }
    return {
      type: "group_qualifier",
      groupIndex: seed.groupIndex,
      groupName: groupName(seed.groupIndex),
      position: seed.position,
    };
  };

  const seedOrder = standardBracketOrder(bracketSize);
  const knockoutFixtures: KnockoutFixturePlan[] = [];

  for (let index = 0; index < seedOrder.length; index += 2) {
    const sources: [DrawSource, DrawSource] = [
      sourceForRank(seedOrder[index]!),
      sourceForRank(seedOrder[index + 1]!),
    ];
    if (sources[0].type === "bye" && sources[1].type === "bye") {
      throw new Error("Draw produced a bye without an advancing entrant.");
    }
    if (
      sources[0].type === "group_qualifier" &&
      sources[1].type === "group_qualifier" &&
      sources[0].groupIndex === sources[1].groupIndex &&
      groups.length > 1
    ) {
      throw new Error(
        "Draw paired two qualifiers from the same group in round one.",
      );
    }

    knockoutFixtures.push({
      roundNumber: 1,
      bracketSlot: index / 2 + 1,
      sources,
      isBye: sources.some((source) => source.type === "bye"),
    });
  }

  let previousRoundMatches = bracketSize / 2;
  let roundNumber = 2;
  while (previousRoundMatches > 1) {
    const currentMatches = previousRoundMatches / 2;
    for (let bracketSlot = 1; bracketSlot <= currentMatches; bracketSlot += 1) {
      knockoutFixtures.push({
        roundNumber,
        bracketSlot,
        sources: [
          {
            type: "match_winner",
            roundNumber: roundNumber - 1,
            bracketSlot: bracketSlot * 2 - 1,
          },
          {
            type: "match_winner",
            roundNumber: roundNumber - 1,
            bracketSlot: bracketSlot * 2,
          },
        ],
        isBye: false,
      });
    }
    previousRoundMatches = currentMatches;
    roundNumber += 1;
  }

  return {
    config,
    groups,
    groupFixtures,
    knockoutFixtures,
    bracketSize,
    knockoutRoundCount: bracketRoundCount(bracketSize),
    qualifiers,
    entrantCount: ordered.length,
  };
}
