"use client";

import Link from "next/link";

import { ClockIcon, MapPinIcon } from "@/components/icons";
import { MatchStatusBadge, SportTag } from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import {
  matchRoundLabel,
  matchSideName,
} from "@/features/public/labels";
import type { PublicMatch } from "@/features/public/types";

export function MatchRow({
  match,
  timezone,
  showCompetition = false,
  eventSlug,
}: {
  match: PublicMatch;
  timezone: string;
  showCompetition?: boolean;
  eventSlug: string;
}) {
  const { t, formatDateTime, formatTime } = useI18n();
  const published = match.status === "published";
  const homeWon =
    match.homeTeamId != null && match.winnerTeamId === match.homeTeamId;
  const awayWon =
    match.awayTeamId != null && match.winnerTeamId === match.awayTeamId;
  const homeName = matchSideName(
    match.homeTeamName,
    match.homeSource,
    match.knockoutRoundCount,
    t,
  );
  const awayName = matchSideName(
    match.awayTeamName,
    match.awaySource,
    match.knockoutRoundCount,
    t,
  );

  return (
    <article className="group border-b border-line/80 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] font-bold text-muted">
        {showCompetition ? (
          <Link
            href={`/events/${eventSlug}/competitions/${match.competitionSlug}`}
            className="text-green hover:underline"
          >
            {match.competitionName}
          </Link>
        ) : (
          <SportTag sport={match.sport} />
        )}
        <span>{matchRoundLabel(match, t)}</span>
        {match.startsAt ? (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" />
            {published
              ? formatDateTime(match.startsAt, timezone)
              : formatTime(match.startsAt, timezone)}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3.5" />
            {t("match.tbd")}
          </span>
        )}
        {match.venueName ? (
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3.5" />
            {match.venueName}
          </span>
        ) : null}
        {match.isCancelled ? <MatchStatusBadge status="cancelled" /> : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span
              className={`truncate text-[15px] ${
                homeWon ? "font-extrabold" : "font-semibold"
              } ${match.homeTeamName ? "" : "text-muted"}`}
            >
              {homeName}
            </span>
            <span className="text-xs font-bold text-muted">
              {t("match.vs")}
            </span>
            <span
              className={`truncate text-[15px] ${
                awayWon ? "font-extrabold" : "font-semibold"
              } ${match.awayTeamName ? "" : "text-muted"}`}
            >
              {awayName}
            </span>
          </div>
          {match.scoreDetail ? (
            <p className="mt-1 text-xs font-medium text-muted">
              {match.scoreDetail}
            </p>
          ) : match.isWalkover ? (
            <p className="mt-1 text-xs font-medium text-muted">W.O.</p>
          ) : null}
        </div>

        {published && match.homeScore != null && match.awayScore != null ? (
          <div className="score-numeral flex shrink-0 items-center gap-1.5 text-2xl font-semibold">
            <span className={homeWon ? "text-green" : "text-ink"}>
              {match.homeScore}
            </span>
            <span className="text-sm text-muted">–</span>
            <span className={awayWon ? "text-green" : "text-ink"}>
              {match.awayScore}
            </span>
          </div>
        ) : (
          <span className="shrink-0 rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {match.isCancelled
              ? t("matchStatus.cancelled")
              : t("matchStatus.scheduled")}
          </span>
        )}
      </div>
    </article>
  );
}
