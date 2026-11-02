import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type {
  PublicMatch,
  PublicMatchSource,
} from "@/features/public/types";

type Translate = (key: DictionaryKey) => string;

export function groupDisplayName(name: string | null, t: Translate) {
  if (!name) {
    return t("competition.groups");
  }
  if (name === "league") {
    return t("competition.leagueTable");
  }
  const groupMatch =
    name.match(/^(?:Grupo|Group)\s+([A-Z])$/i) ??
    name.match(/^([A-Z])$/);
  if (groupMatch?.[1]) {
    return t("draw.groupName").replace("{letter}", groupMatch[1]);
  }
  return name;
}

export function knockoutRoundLabel(
  roundNumber: number,
  totalRounds: number,
  t: Translate,
) {
  const remaining = totalRounds - roundNumber;
  if (remaining === 0) {
    return t("draw.final");
  }
  if (remaining === 1) {
    return t("draw.semiFinal");
  }
  if (remaining === 2) {
    return t("draw.quarterFinal");
  }
  return t("draw.round").replace("{round}", String(roundNumber));
}

export function matchRoundLabel(match: PublicMatch, t: Translate) {
  // Seeded tennis fixtures carry a Portuguese "Rodada N" label. Derive the
  // label from the fixture shape so it follows the language switcher.
  const rawRoundLabel =
    match.roundLabel && !/^(Rodada|Round)\s+\d+$/i.test(match.roundLabel)
      ? match.roundLabel
      : null;
  if (rawRoundLabel) {
    return rawRoundLabel;
  }
  if (match.format === "round_robin") {
    return t("fixtures.leagueRound").replace(
      "{round}",
      String(match.roundNumber),
    );
  }
  if (match.stage === "group") {
    if (match.groupName) {
      return t("fixtures.groupRound")
        .replace("{group}", groupDisplayName(match.groupName, t))
        .replace("{round}", String(match.roundNumber));
    }
    return t("competition.groupStage");
  }
  return knockoutRoundLabel(
    match.roundNumber,
    match.knockoutRoundCount,
    t,
  );
}

export function matchSourceLabel(
  source: PublicMatchSource | null,
  totalRounds: number,
  t: Translate,
) {
  if (!source) {
    return null;
  }
  if (source.type === "bye") {
    return t("fixtures.bye");
  }
  if (source.type === "group_qualifier") {
    const group = groupDisplayName(source.groupName, t);
    return source.position === 1
      ? t("fixtures.groupWinner").replace("{group}", group)
      : t("fixtures.groupRunnerUp").replace("{group}", group);
  }
  return t("fixtures.matchWinner")
    .replace(
      "{round}",
      knockoutRoundLabel(source.roundNumber, totalRounds, t),
    )
    .replace("{slot}", String(source.bracketSlot));
}

export function matchSideName(
  teamName: string | null,
  source: PublicMatchSource | null,
  totalRounds: number,
  t: Translate,
) {
  return (
    teamName ??
    matchSourceLabel(source, totalRounds, t) ??
    t("match.tbd")
  );
}
