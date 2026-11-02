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
  if (/^[A-Z]$/.test(name)) {
    return t("draw.groupName").replace("{letter}", name);
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
  if (match.roundLabel) {
    return match.roundLabel;
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
