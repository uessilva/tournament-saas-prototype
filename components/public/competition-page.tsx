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
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";
import { groupDisplayName } from "@/features/public/labels";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { CompetitionPageData } from "@/features/competitions/types";

function formatLabel(
  format: string,
  t: (key: DictionaryKey) => string,
) {
  return t(`format.${format}` as DictionaryKey);
}

function Signed(value: number) {
  if (value === 0) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

function TiebreakBadge({
  reason,
  t,
}: {
  reason: string;
  t: (key: DictionaryKey) => string;
}) {
  return (
    <span className="ml-1.5 inline-flex rounded-full bg-soft-orange px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.06em] text-clay">
      {t(`standings.tiebreak.${reason}` as DictionaryKey)}
    </span>
  );
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
                  registrationState={competition.registrationState}
                />
                <RegistrationBadge state={competition.registrationState} />
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
                    {competition.registrationState === "open"
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
              </dl>
            </aside>
          </div>

          {competition.status === "cancelled" ? (
            <div className="border-t border-line bg-red-50 px-6 py-4 text-sm font-semibold text-red-800 sm:px-9 lg:px-11">
              <span className="font-extrabold">
                {t("competition.publicNote")}:
              </span>{" "}
              {competition.publicNote ?? t("competition.cancellationNote")}
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
                    {isTennis
                      ? t("competition.partialStandings")
                      : competition.drawGeneratedAt
                        ? t("competition.footballGeneratedTitle")
                        : t("competition.footballPendingTitle")}
                  </h2>
                </div>
                <p className="max-w-sm text-xs leading-5 text-muted">
                  {isTennis
                    ? t("competition.standingsNote")
                    : t("competition.footballStandingsNote")}
                </p>
              </div>
              {isTennis ? (
                <p className="mt-3 rounded-xl bg-cream px-3 py-2 text-[11px] font-semibold text-muted">
                  {t("competition.seededDrawNote").replace(
                    "{seed}",
                    competition.drawSeed ?? "—",
                  )}
                </p>
              ) : null}

              {isTennis && data.groups.length ? (
                <div className="mt-6 grid gap-8">
                  {data.groups.map((group) => (
                    <div key={group.id}>
                      <h3 className="text-sm font-extrabold">
                        {groupDisplayName(group.name, t)}
                      </h3>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left text-sm">
                          <caption className="sr-only">
                            {groupDisplayName(group.name, t)} —{" "}
                            {t("competition.partialStandings")}
                          </caption>
                          <thead>
                            <tr className="border-b border-line text-[10px] uppercase tracking-[0.1em] text-muted">
                              <th className="py-2 pr-2 font-extrabold">
                                {t("standings.pos")}
                              </th>
                              <th className="py-2 pr-2 font-extrabold">
                                {t("standings.entrant")}
                              </th>
                              <th className="py-2 pr-2 text-center font-extrabold">
                                {t("standings.played")}
                              </th>
                              <th className="py-2 pr-2 text-center font-extrabold">
                                {t("standings.won")}
                              </th>
                              <th className="py-2 pr-2 text-center font-extrabold">
                                {t("standings.lost")}
                              </th>
                              <th className="py-2 pr-2 text-center font-extrabold">
                                {t("standings.sets")}
                              </th>
                              <th className="py-2 pr-2 text-center font-extrabold">
                                {t("standings.games")}
                              </th>
                              <th className="py-2 text-center font-extrabold">
                                {t("standings.points")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.standings.map((row, index) => (
                              <tr
                                key={row.teamId}
                                className={`border-b border-line/70 last:border-b-0 ${
                                  index < competition.qualifiersPerGroup
                                    ? "bg-soft-green/50"
                                    : ""
                                }`}
                              >
                                <td className="py-2.5 pr-2 font-extrabold text-muted">
                                  {index + 1}
                                </td>
                                <td className="py-2.5 pr-2 font-bold">
                                  {row.teamName}
                                  {row.tiebreakReason ? (
                                    <TiebreakBadge
                                      reason={row.tiebreakReason}
                                      t={t}
                                    />
                                  ) : null}
                                </td>
                                <td className="py-2.5 pr-2 text-center">
                                  {row.played}
                                </td>
                                <td className="py-2.5 pr-2 text-center">
                                  {row.wins}
                                </td>
                                <td className="py-2.5 pr-2 text-center">
                                  {row.losses}
                                </td>
                                <td className="py-2.5 pr-2 text-center">
                                  {Signed(row.setDifference)}
                                </td>
                                <td className="py-2.5 pr-2 text-center">
                                  {Signed(row.gameDifference)}
                                </td>
                                <td className="py-2.5 text-center text-lg font-extrabold">
                                  {row.points}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
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
