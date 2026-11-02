import { nextKnockoutSlot } from "@/features/competitions/draw";

export type AdvancementSource =
  | {
      type: "group_qualifier";
      groupId: string;
      groupPosition: number;
    }
  | {
      type: "match_winner";
      sourceMatchId: string;
    }
  | {
      type: "bye";
    };

export type AdvancementMatch = {
  id: string;
  stage: "group" | "knockout";
  roundNumber: number;
  bracketSlot: number | null;
  isBye: boolean;
  home: AdvancementSource | null;
  away: AdvancementSource | null;
};

export type AdvancementContext = {
  /** teamId currently occupying each group position, keyed `${groupId}:${position}`. */
  groupQualifiers: Map<string, string>;
  /** Confirmed knockout winners keyed by match id. */
  matchWinners: Map<string, string>;
  /** Bye winners are resolved automatically, without a confirmed result. */
  resolveByes?: boolean;
};

export function groupQualifierKey(groupId: string, position: number) {
  return `${groupId}:${position}`;
}

export function nextSlotTarget(match: AdvancementMatch) {
  if (
    match.stage !== "knockout" ||
    match.bracketSlot == null ||
    match.isBye
  ) {
    return null;
  }
  return nextKnockoutSlot(match.roundNumber, match.bracketSlot);
}

export function resolveSourceTeamId(
  source: AdvancementSource | null,
  context: AdvancementContext,
): string | null {
  if (!source || source.type === "bye") {
    return null;
  }
  if (source.type === "group_qualifier") {
    return (
      context.groupQualifiers.get(
        groupQualifierKey(source.groupId, source.groupPosition),
      ) ?? null
    );
  }
  return context.matchWinners.get(source.sourceMatchId) ?? null;
}

/**
 * Fills the known knockout entrants from group qualifiers and confirmed
 * winners. Byes advance their single entrant without a result, so later rounds
 * can be wired before any knockout match is played.
 *
 * Ticket 06/07 can call this with published result winners and then upsert the
 * returned `entries` into match_entries. It deliberately never invents a
 * winner for a playable match.
 */
export function resolveKnockoutEntrants(
  matches: AdvancementMatch[],
  context: AdvancementContext,
) {
  const winners = new Map(context.matchWinners);
  const byId = new Map(matches.map((match) => [match.id, match]));
  let changed = context.resolveByes !== false;

  while (changed) {
    changed = false;
    for (const match of matches) {
      if (match.stage !== "knockout" || winners.has(match.id)) {
        continue;
      }
      const home = resolveSourceTeamId(match.home, {
        ...context,
        matchWinners: winners,
      });
      const away = resolveSourceTeamId(match.away, {
        ...context,
        matchWinners: winners,
      });

      if (match.isBye) {
        const entrant = home && !away ? home : away && !home ? away : null;
        if (entrant) {
          winners.set(match.id, entrant);
          changed = true;
        }
      }
    }
  }

  const entries: Array<{
    matchId: string;
    side: "home" | "away";
    teamId: string;
    sourceMatchId: string | null;
  }> = [];

  for (const match of matches) {
    if (match.stage !== "knockout" || match.isBye) {
      continue;
    }
    for (const [side, source] of [
      ["home", match.home],
      ["away", match.away],
    ] as const) {
      const teamId = resolveSourceTeamId(source, {
        ...context,
        matchWinners: winners,
      });
      if (teamId) {
        entries.push({
          matchId: match.id,
          side,
          teamId,
          sourceMatchId: source?.type === "match_winner" ? source.sourceMatchId : null,
        });
      }
    }
  }

  return { winners, entries, byId };
}
