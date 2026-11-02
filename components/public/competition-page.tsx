"use client";

import Link from "next/link";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  MapPinIcon,
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
import { StandingsTable } from "@/components/public/standings-table";
import { knockoutRoundLabel } from "@/features/public/labels";
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CompetitionPageData } from "@/features/competitions/types";

function formatLabel(
  format: string,
  t: (key: DictionaryKey) => string,
) {
  return t(`format.${format}` as DictionaryKey);
}

export function CompetitionPage({
  data,
  signedIn,
  currentPath,
}: {
  data: CompetitionPageData;
  signedIn: boolean;
  currentPath: string;
}) {
  const { t, formatDate, formatDateTime } = useI18n();
  const competition = data.competition;
  const isTennis = competition.sport === "tennis";
  const isGroups = competition.format === "groups_knockout";
  const isRoundRobin = competition.format === "round_robin";
  const isElimination = competition.format === "single_elimination";
  const bracketRounds = [
    ...new Set(data.bracket.map((match) => match.roundNumber)),
  ].sort((a, b) => a - b);
  const registrationState =
    competition.status === "cancelled"
      ? "closed"
      : competition.registrationState;
  const competitions = data.event.competitions.map((sibling) => ({
    name: sibling.name,
    slug: sibling.slug,
    sport: sibling.sport,
  }));

  const formatDateOnly = (value: string | null) =>
    value
      ? formatDate(value, "UTC", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <div className="min-h-screen">
      <SiteHeader
        eventSlug={data.event.slug}
        eventName={data.event.name}
        competitions={competitions}
        signedIn={signedIn}
        activeCompetitionSlug={competition.slug}
        currentPath={currentPath}
      />

      <main id="main-content" className="page-shell pt-7 sm:pt-10">
        <Link
          href={`/events/${data.event.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted transition-colors hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("competition.backToEvent")}
        </Link>

        <section
          className={`mt-5 overflow-hidden rounded-[1.5rem] border border-line bg-white sm:rounded-[2rem]`}
          style={{
            borderTopWidth: 6,
            borderTopColor: isTennis
              ? "var(--color-clay)"
              : "var(--color-green)",
          }}
        >
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.35fr_0.65fr] lg:p-11">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <SportTag sport={competition.sport} />
                <CompetitionStatusBadge
                  status={competition.status}
                  registrationState={registrationState}
                />
                <RegistrationBadge state={registrationState} />
              </div>
              <h1 className="display-title mt-5 text-5xl sm:text-6xl">
                {competition.name}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
                {competition.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-ink">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
                  <CalendarIcon className="size-3.5 text-green" />
                  {formatLabel(competition.format, t)}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
                  <UsersIcon className="size-3.5 text-green" />
                  {(isTennis
                    ? t("competition.entrantCount")
                    : t("competition.teamCount")
                  ).replace("{count}", String(data.entrants.length))}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-3 py-1.5">
                  <MapPinIcon className="size-3.5 text-green" />
                  {data.event.locationLabel ?? t("home.location")}
                </span>
              </div>
            </div>

            <aside className="rounded-2xl bg-paper p-5">
              <p className="eyebrow text-muted">{t("competition.rules")}</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.registration")}
                  </dt>
                  <dd className="mt-0.5 font-bold">
                    {registrationState === "open"
                      ? t("registration.open")
                      : t("registration.closed")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.deadline")}
                  </dt>
                  <dd className="mt-0.5 font-bold">
                    {competition.registrationDeadline
                      ? formatDateTime(
                          competition.registrationDeadline,
                          data.event.timezone,
                        )
                      : t("competition.registrationDeadlineNone")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.defaultDuration")}
                  </dt>
                  <dd className="mt-0.5 font-bold">
                    {competition.defaultMatchDurationMinutes}{" "}
                    {t("common.minutes")}
                  </dd>
                </div>
                {isGroups ? (
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                      {t("competition.qualifiers")}
                    </dt>
                    <dd className="mt-0.5 font-bold">
                      {t("competition.qualifiersValue").replace(
                        "{count}",
                        String(competition.qualifiersPerGroup),
                      )}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>

          {competition.status === "cancelled" ? (
            <div
              role="alert"
              className="border-t border-red-200 bg-red-50 px-6 py-4 text-sm text-red-800 sm:px-9 lg:px-11"
            >
              <p className="font-extrabold">{t("competition.cancelledTitle")}</p>
              <p className="mt-1 font-semibold">
                <span className="font-extrabold">
                  {t("competition.publicNote")}:
                </span>{" "}
                {competition.publicNote ?? t("competition.cancellationNote")}
              </p>
              <p className="mt-1 text-xs font-semibold text-red-700">
                {t("competition.cancelledReadOnly")}
              </p>
            </div>
          ) : null}
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-6">
            <section className="surface p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow text-green">
                    {t("competition.standings")}
                  </p>
                  <h2 className="display-title mt-2 text-3xl">
                    {isElimination
                      ? t("competition.bracketTitle")
                      : isRoundRobin
                        ? t("competition.leagueTable")
                        : data.groups.length
                          ? t("competition.groupStandingsTitle")
                          : isTennis
                            ? t("competition.partialStandings")
                            : competition.drawGeneratedAt
                              ? t("competition.footballGeneratedTitle")
                              : t("competition.footballPendingTitle")}
                  </h2>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="max-w-sm text-xs leading-5 text-muted">
                    {isElimination
                      ? t("competition.bracketBody")
                      : isRoundRobin
                        ? t("competition.leagueStandingsNote")
                        : isTennis
                          ? t("competition.standingsNote")
                          : t("competition.footballStandingsNote")}
                  </p>
                  {data.groups.length ? (
                    <Link
                      href={`/events/${data.event.slug}/standings?competition=${competition.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-green hover:underline"
                    >
                      {t("standings.viewFull")}
                      <ArrowRightIcon className="size-3.5" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/events/${data.event.slug}/leaders?competition=${competition.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-clay hover:underline"
                  >
                    {t("nav.leaders")}
                    <ArrowRightIcon className="size-3.5" />
                  </Link>
                </div>
              </div>
              {isTennis ? (
                <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-[11px] font-semibold text-muted">
                  {t("competition.seededDrawNote").replace(
                    "{seed}",
                    competition.drawSeed ?? "—",
                  )}
                </p>
              ) : null}

              {isElimination ? (
                data.bracket.length ? (
                  <div className="mt-6 space-y-5">
                    {bracketRounds.map((roundNumber) => (
                      <div key={roundNumber}>
                        <p className="eyebrow text-muted">
                          {knockoutRoundLabel(
                            roundNumber,
                            data.bracket[0]?.knockoutRoundCount ?? 1,
                            t,
                          )}
                        </p>
                        <div className="mt-1">
                          {data.bracket
                            .filter(
                              (match) => match.roundNumber === roundNumber,
                            )
                            .map((match) => (
                              <MatchRow
                                key={match.id}
                                match={match}
                                timezone={data.event.timezone}
                                eventSlug={data.event.slug}
                              />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-6 rounded-2xl bg-cream p-5">
                    <p className="text-sm font-bold">
                      {competition.drawGeneratedAt
                        ? t("competition.bracketPendingTitle")
                        : t("competition.footballPendingTitle")}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-muted">
                      {competition.drawGeneratedAt
                        ? t("competition.bracketPendingBody")
                        : t("competition.footballPendingBody")}
                    </p>
                  </div>
                )
              ) : data.groups.length ? (
                <div className="mt-6 grid gap-8">
                  {data.groups.map((group) => (
                    <StandingsTable
                      key={group.id}
                      group={group}
                      sport={competition.sport}
                      qualifiersPerGroup={
                        isGroups ? competition.qualifiersPerGroup : 0
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl bg-cream p-5">
                  <p className="text-sm font-bold">
                    {competition.drawGeneratedAt
                      ? t("competition.footballGeneratedTitle")
                      : t("competition.footballPendingTitle")}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-muted">
                    {competition.drawGeneratedAt
                      ? t("competition.footballGeneratedBody")
                      : t("competition.footballPendingBody")}
                  </p>
                </div>
              )}
            </section>

            {isTennis ? (
              <section id="leaders" className="surface p-5 sm:p-7">
                <div>
                  <p className="eyebrow text-clay">{t("home.leadersEyebrow")}</p>
                  <h2 className="display-title mt-2 text-3xl">
                    {t("competition.leadersTitle")}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {t("competition.leadersBody")}
                  </p>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      [t("leaders.aces"), data.leaders.aces],
                      [t("leaders.doubleFaults"), data.leaders.doubleFaults],
                    ] as const
                  ).map(([title, rows]) => (
                    <div
                      key={title}
                      className="rounded-2xl border border-line bg-paper/70 p-4"
                    >
                      <p className="eyebrow text-muted">{title}</p>
                      {rows.length ? (
                        <ol className="mt-3 space-y-2.5">
                          {rows.map((row, index) => (
                            <li
                              key={row.participantId}
                              className="flex items-center gap-3"
                            >
                              <span
                                className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${
                                  index === 0
                                    ? "bg-clay text-white"
                                    : "bg-cream text-muted"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold">
                                  {row.name}
                                </span>
                                <span className="block truncate text-[10px] font-medium text-muted">
                                  {row.teamName}
                                </span>
                              </span>
                              <span className="score-numeral text-lg font-semibold">
                                {row.total}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="mt-3 text-xs leading-5 text-muted">
                          {t("home.noStats")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section id="fixtures" className="surface p-5 sm:p-7">
              <div>
                <p className="eyebrow text-green">{t("competition.fixtures")}</p>
                <h2 className="display-title mt-2 text-3xl">
                  {t("competition.recentResults")}
                </h2>
                <p className="mt-1 text-xs font-medium text-muted">
                  {t("competition.resultsNote")}
                </p>
                <Link
                  href={`/events/${data.event.slug}/fixtures?competition=${competition.slug}`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-green hover:underline"
                >
                  {t("fixtures.viewAll")}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
              <div className="mt-4">
                {data.results.length ? (
                  data.results.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      timezone={data.event.timezone}
                      eventSlug={data.event.slug}
                    />
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted">
                    {t("competition.noMatches")}
                  </p>
                )}
              </div>

              <div className="mt-8 border-t border-line pt-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="display-title text-2xl">
                    {t("competition.upcoming")}
                  </h2>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {formatTimeZoneLabel(data.event.timezone)}
                  </span>
                </div>
                <div className="mt-2">
                  {data.upcoming.length ? (
                    data.upcoming.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        timezone={data.event.timezone}
                        eventSlug={data.event.slug}
                      />
                    ))
                  ) : (
                    <p className="py-8 text-center text-sm text-muted">
                      {t("competition.noUpcoming")}
                    </p>
                  )}
                </div>
              </div>

              {data.cancelled.length ? (
                <div className="mt-8 border-t border-line pt-6">
                  <h2 className="display-title text-2xl">
                    {t("matchStatus.cancelled")}
                  </h2>
                  <div className="mt-2">
                    {data.cancelled.map((match) => (
                      <MatchRow
                        key={match.id}
                        match={match}
                        timezone={data.event.timezone}
                        eventSlug={data.event.slug}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section id="entrants" className="surface p-5 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow text-green">
                    {t("competition.entrants")}
                  </p>
                  <h2 className="display-title mt-2 text-3xl">
                    {isTennis
                      ? t("competition.players")
                      : t("competition.teams")}
                  </h2>
                </div>
                <p className="max-w-sm text-xs leading-5 text-muted">
                  {t("competition.entrantsBody")}
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {data.entrants.map((entrant) => (
                  <article
                    key={entrant.id}
                    className="rounded-2xl border border-line bg-paper/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-extrabold">{entrant.name}</h3>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-muted">
                        {isTennis
                          ? t("competition.oneParticipantTeam")
                          : t("competition.squadSize").replace(
                              "{count}",
                              String(entrant.participantCount),
                            )}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="surface p-5 sm:p-6">
              <p className="eyebrow text-muted">{t("competition.rules")}</p>
              <h2 className="display-title mt-2 text-2xl">
                {t("competition.eligibility")}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {competition.eligibilityNotes}
              </p>
              <dl className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.rosterLimits")}
                  </dt>
                  <dd className="mt-0.5 font-bold">
                    {isTennis
                      ? t("competition.singleEntry")
                      : competition.rosterMin != null &&
                          competition.rosterMax != null
                        ? t("competition.rosterLimitValue")
                            .replace("{min}", String(competition.rosterMin))
                            .replace("{max}", String(competition.rosterMax))
                        : "—"}
                  </dd>
                </div>
                {competition.birthDateFrom || competition.birthDateTo ? (
                  <div>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                      {t("competition.birthRangeLabel")}
                    </dt>
                    <dd className="mt-0.5 font-bold">
                      {t("competition.birthRange")
                        .replace(
                          "{from}",
                          formatDateOnly(competition.birthDateFrom),
                        )
                        .replace(
                          "{to}",
                          formatDateOnly(competition.birthDateTo),
                        )}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.drawSeed")}
                  </dt>
                  <dd className="mt-0.5 break-all font-bold">
                    {competition.drawSeed ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                    {t("competition.venues")}
                  </dt>
                  <dd className="mt-0.5 font-bold">
                    {data.venues.map((venue) => venue.name).join(" · ")}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[1.25rem] bg-green p-5 text-white sm:p-6">
              <p className="eyebrow text-lime">{t("home.publicAccess")}</p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {t("home.publicAccessBody")}
              </p>
              <Link
                href={`/events/${data.event.slug}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-extrabold text-lime underline decoration-2 underline-offset-4"
              >
                {t("competition.backToEvent")}
                <ArrowRightIcon className="size-3.5" />
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <SiteFooter eventSlug={data.event.slug} timezone={data.event.timezone} />
    </div>
  );
}
