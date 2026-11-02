"use client";

import Link from "next/link";

import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  MapPinIcon,
  TrophyIcon,
  UsersIcon,
} from "@/components/icons";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import {
  CompetitionStatusBadge,
  RegistrationBadge,
  SportTag,
} from "@/components/public/badges";
import { MatchRow } from "@/components/public/match-row";
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";
import { matchSideName } from "@/features/public/labels";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type {
  CompetitionSummary,
  EventHubData,
  LeaderRow,
  PublicMatch,
} from "@/features/public/types";

function formatLabel(
  format: string,
  t: (key: DictionaryKey) => string,
) {
  return t(`format.${format}` as DictionaryKey);
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="border-l border-line pl-4 first:border-l-0 first:pl-0 sm:pl-6">
      <div className="display-title text-3xl text-ink sm:text-4xl">{value}</div>
      <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {label}
      </div>
    </div>
  );
}

function LeaderCard({
  title,
  rows,
}: {
  title: string;
  rows: LeaderRow[];
}) {
  const { t } = useI18n();

  return (
    <div className="surface p-5">
      <p className="eyebrow text-muted">{title}</p>
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {rows.slice(0, 3).map((row, index) => (
            <li key={row.participantId} className="flex items-center gap-3">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${
                  index === 0
                    ? "bg-lime text-ink"
                    : "bg-cream text-muted"
                }`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {row.name}
                </span>
                <span className="block truncate text-[11px] font-medium text-muted">
                  {row.teamName}
                </span>
              </span>
              <span className="score-numeral text-xl font-semibold">
                {row.total}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          {t("home.noStats")}
        </p>
      )}
    </div>
  );
}

function CompetitionCard({
  competition,
  latest,
  next,
  eventSlug,
  timezone,
}: {
  competition: CompetitionSummary;
  latest?: PublicMatch;
  next?: PublicMatch;
  eventSlug: string;
  timezone: string;
}) {
  const { t, formatDateTime } = useI18n();
  const isFootball = competition.sport === "football";
  const latestHome = latest
    ? matchSideName(
        latest.homeTeamName,
        latest.homeSource,
        latest.knockoutRoundCount,
        t,
      )
    : null;
  const latestAway = latest
    ? matchSideName(
        latest.awayTeamName,
        latest.awaySource,
        latest.knockoutRoundCount,
        t,
      )
    : null;
  const nextHome = next
    ? matchSideName(
        next.homeTeamName,
        next.homeSource,
        next.knockoutRoundCount,
        t,
      )
    : null;
  const nextAway = next
    ? matchSideName(
        next.awayTeamName,
        next.awaySource,
        next.knockoutRoundCount,
        t,
      )
    : null;

  return (
    <article
      className={`surface sport-${competition.sport} overflow-hidden p-6 sm:p-7`}
      style={{
        borderTopWidth: 5,
        borderTopColor: isFootball ? "var(--color-green)" : "var(--color-clay)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SportTag sport={competition.sport} />
        <CompetitionStatusBadge
          status={competition.status}
          registrationState={competition.registrationState}
        />
      </div>

      <h3 className="display-title mt-5 text-3xl">{competition.name}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-6 text-muted">
        {competition.description}
      </p>

      {competition.status === "cancelled" ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
          <p className="font-extrabold">{t("competition.cancelledTitle")}</p>
          <p className="mt-1">
            {competition.publicNote ?? t("competition.cancellationNote")}
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <span className="rounded-full bg-cream px-2.5 py-1">
          {formatLabel(competition.format, t)}
        </span>
        <span className="rounded-full bg-cream px-2.5 py-1">
          {(isFootball ? t("competition.teamCount") : t("competition.entrantCount")).replace(
            "{count}",
            String(
              isFootball
                ? competition.teamCount
                : competition.participantCount,
            ),
          )}
        </span>
        <span className="rounded-full bg-cream px-2.5 py-1">
          {t("competition.matchCount").replace(
            "{count}",
            String(competition.matchCount),
          )}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-paper/80 p-4">
        {latest ? (
          <>
            <p className="eyebrow text-muted">{t("home.latestResult")}</p>
            <p className="mt-2 text-sm font-bold">
              {latestHome}{" "}
              <span className="score-numeral text-lg text-green">
                {latest.homeScore}–{latest.awayScore}
              </span>{" "}
              {latestAway}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {latest.scoreDetail}
            </p>
          </>
        ) : next ? (
          <>
            <p className="eyebrow text-muted">{t("home.nextUpTitle")}</p>
            <p className="mt-2 text-sm font-bold">
              {nextHome} {t("match.vs")} {nextAway}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {next.startsAt
                ? formatDateTime(next.startsAt, timezone)
                : t("match.tbd")}
              {next.venueName ? ` · ${next.venueName}` : ""}
            </p>
          </>
        ) : isFootball && competition.registrationState === "open" ? (
          <>
            <p className="eyebrow text-muted">
              {t("competition.footballPendingTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("home.footballPending")}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow text-muted">{t("home.latestResult")}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("home.noResults")}
            </p>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" />
            {competition.participantCount}
          </span>
          {isFootball ? (
            <RegistrationBadge state={competition.registrationState} />
          ) : (
            <span>
              {t("competition.publishedCount").replace(
                "{count}",
                String(competition.publishedCount),
              )}
            </span>
          )}
        </div>
        <Link
          href={`/events/${eventSlug}/competitions/${competition.slug}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-green"
        >
          {t("competition.overview")}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </div>
    </article>
  );
}

export function EventHubPage({
  data,
  signedIn,
  currentPath,
}: {
  data: EventHubData;
  signedIn: boolean;
  currentPath: string;
}) {
  const { t, formatDate } = useI18n();
  const latest = data.recentResults[0];
  const latestHome = latest
    ? matchSideName(
        latest.homeTeamName,
        latest.homeSource,
        latest.knockoutRoundCount,
        t,
      )
    : null;
  const latestAway = latest
    ? matchSideName(
        latest.awayTeamName,
        latest.awaySource,
        latest.knockoutRoundCount,
        t,
      )
    : null;
  const competitions = data.competitions.map((competition) => ({
    name: competition.name,
    slug: competition.slug,
    sport: competition.sport,
  }));

  return (
    <div className="min-h-screen">
      <SiteHeader
        eventSlug={data.event.slug}
        eventName={data.event.name}
        competitions={competitions}
        signedIn={signedIn}
        currentPath={currentPath}
      />

      <main id="main-content">
        <section id="overview" className="page-shell pt-7 sm:pt-10">
          <div className="relative overflow-hidden rounded-[1.75rem] bg-green px-6 py-9 text-white sm:rounded-[2.25rem] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="relative z-10 grid gap-9 lg:grid-cols-[1.45fr_0.75fr] lg:items-end">
              <div>
                <p className="eyebrow text-lime">{t("home.eyebrow")}</p>
                <h1 className="display-title mt-5 max-w-3xl text-[clamp(2.9rem,6vw,5.9rem)]">
                  {data.event.name}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
                  {data.event.tagline ?? t("home.heroFallback")}
                </p>

                <div className="mt-7 flex flex-wrap gap-2 text-xs font-bold text-white/90">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                    <CalendarIcon className="size-3.5" />
                    {formatDate(data.event.startsAt, data.event.timezone, {
                      day: "numeric",
                      month: "short",
                      year: undefined,
                    })}{" "}
                    —{" "}
                    {formatDate(data.event.endsAt, data.event.timezone, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5">
                    <MapPinIcon className="size-3.5" />
                    {data.event.locationLabel ?? t("home.location")}
                  </span>
                </div>

                <div className="mt-8 flex flex-wrap gap-2.5">
                  <a
                    href="#competitions"
                    className="inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-extrabold text-ink transition-colors hover:bg-white"
                  >
                    {t("home.exploreCompetitions")}
                    <ArrowRightIcon className="size-4" />
                  </a>
                  <a
                    href={`/events/${data.event.slug}/fixtures`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-white/10"
                  >
                    {t("nav.matchCentre")}
                  </a>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-2xl bg-lime p-5 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.18)] sm:p-6">
                  <p className="eyebrow text-green-deep">
                    {latest ? t("home.latestResult") : t("home.openingSoon")}
                  </p>
                  {latest ? (
                    <>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-sm font-extrabold">
                          {latestHome}
                        </span>
                        <span className="score-numeral text-4xl font-semibold">
                          {latest.homeScore}–{latest.awayScore}
                        </span>
                        <span className="text-right text-sm font-extrabold">
                          {latestAway}
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-green-deep/80">
                        {latest.competitionName}
                        {latest.roundLabel ? ` · ${latest.roundLabel}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-medium text-green-deep/70">
                        {latest.scoreDetail}
                      </p>
                      <Link
                        href={`/events/${data.event.slug}/competitions/${latest.competitionSlug}`}
                        className="mt-5 inline-flex items-center gap-1.5 text-xs font-extrabold text-green-deep underline decoration-2 underline-offset-4"
                      >
                        {t("home.viewCompetition")}
                        <ArrowUpRightIcon className="size-3.5" />
                      </Link>
                    </>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-green-deep/80">
                      {t("home.openingSoonBody")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="page-shell mt-8">
          <div className="grid grid-cols-2 gap-y-6 border-y border-line py-6 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label={t("home.statsCompetitions")} value={data.stats.competitions} />
            <Stat label={t("home.statsEntrants")} value={data.stats.entrants} />
            <Stat label={t("home.statsMatches")} value={data.stats.matches} />
            <Stat label={t("home.statsPublished")} value={data.stats.publishedResults} />
            <Stat label={t("home.statsVenues")} value={data.stats.venues} />
          </div>
        </section>

        <section id="competitions" className="page-shell mt-16 scroll-mt-6 sm:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-green">{t("home.competitionsEyebrow")}</p>
              <h2 className="display-title mt-2 text-4xl sm:text-5xl">
                {t("home.competitionsTitle")}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              {t("home.competitionsBody")}
            </p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            {data.competitions.map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                latest={data.recentResults.find(
                  (match) => match.competitionId === competition.id,
                )}
                next={data.upcoming.find(
                  (match) => match.competitionId === competition.id,
                )}
                eventSlug={data.event.slug}
                timezone={data.event.timezone}
              />
            ))}
          </div>
        </section>

        <section id="results" className="page-shell mt-16 scroll-mt-6 sm:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-green">{t("home.latestEyebrow")}</p>
              <h2 className="display-title mt-2 text-4xl sm:text-5xl">
                {t("home.latestTitle")}
              </h2>
            </div>
            <p className="text-xs font-bold text-muted">
              {t("home.timezone")}:{" "}
              {formatTimeZoneLabel(data.event.timezone)}
            </p>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <div className="surface p-5 sm:p-6">
              {data.recentResults.length ? (
                data.recentResults.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    timezone={data.event.timezone}
                    eventSlug={data.event.slug}
                    showCompetition
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted">
                  {t("home.noResults")}
                </p>
              )}
            </div>

            <div className="surface p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="eyebrow text-muted">{t("home.nextUpTitle")}</p>
                  <p className="mt-1 text-xs font-medium text-muted">
                    {t("home.nextUpBody")}
                  </p>
                </div>
                <TrophyIcon className="size-6 text-green" />
              </div>
              {data.upcoming.length ? (
                data.upcoming.map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    timezone={data.event.timezone}
                    eventSlug={data.event.slug}
                    showCompetition
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted">
                  {t("home.noUpcoming")}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="page-shell mt-16 sm:mt-20">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-green">{t("home.leadersEyebrow")}</p>
              <h2 className="display-title mt-2 text-4xl sm:text-5xl">
                {t("home.leadersTitle")}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              {t("home.leadersBody")}
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LeaderCard title={t("leaders.aces")} rows={data.leaders.aces} />
            <LeaderCard
              title={t("leaders.doubleFaults")}
              rows={data.leaders.doubleFaults}
            />
            <LeaderCard title={t("leaders.goals")} rows={data.leaders.goals} />
            <LeaderCard
              title={t("leaders.assists")}
              rows={data.leaders.assists}
            />
          </div>
        </section>

        <section id="about" className="page-shell mt-16 scroll-mt-6 sm:mt-20">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="surface p-7 sm:p-9">
              <p className="eyebrow text-green">{t("home.aboutEyebrow")}</p>
              <h2 className="display-title mt-3 max-w-2xl text-4xl sm:text-5xl">
                {t("home.aboutTitle")}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
                {data.event.description ?? t("home.aboutBody")}
              </p>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <div className="rounded-2xl bg-soft-green p-5">
                  <UsersIcon className="size-6 text-green" />
                  <h3 className="mt-3 text-sm font-extrabold">
                    {t("home.oneEventTwoSports")}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {data.competitions
                      .map((competition) => competition.name)
                      .join(" · ")}
                  </p>
                </div>
                <div className="rounded-2xl bg-soft-orange p-5">
                  <TrophyIcon className="size-6 text-clay" />
                  <h3 className="mt-3 text-sm font-extrabold">
                    {t("home.publicAccess")}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {t("home.publicAccessBody")}
                  </p>
                </div>
              </div>
            </div>

            <aside className="rounded-[1.25rem] bg-cream p-7 sm:p-9">
              <p className="eyebrow text-muted">{t("home.eventDates")}</p>
              <p className="display-title mt-2 text-2xl">
                {formatDate(data.event.startsAt, data.event.timezone, {
                  day: "numeric",
                  month: "long",
                  year: undefined,
                })}{" "}
                —{" "}
                {formatDate(data.event.endsAt, data.event.timezone, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
              <div className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
                <p>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("home.location")}
                  </span>
                  <span className="mt-1 block font-bold">
                    {data.event.locationLabel ?? t("home.location")}
                  </span>
                </p>
                <p>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("home.timezone")}
                  </span>
                  <span className="mt-1 block font-bold">
                    {formatTimeZoneLabel(
                      data.event.timezone,
                      new Date(data.event.startsAt),
                    )}
                  </span>
                </p>
                <p>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.venues")}
                  </span>
                  <span className="mt-1 block font-bold">
                    {data.venues.map((venue) => venue.name).join(" · ")}
                  </span>
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter eventSlug={data.event.slug} timezone={data.event.timezone} />
    </div>
  );
}
