"use client";

import Link from "next/link";

import { ArrowLeftIcon, BallIcon, TennisIcon } from "@/components/icons";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { useI18n } from "@/lib/i18n/client";
import type { LeaderRow, LeadersPageData } from "@/features/public/types";

function LeaderList({
  title,
  description,
  rows,
  emptyLabel,
}: {
  title: string;
  description: string;
  rows: LeaderRow[];
  emptyLabel: string;
}) {
  const { t } = useI18n();
  return (
    <section className="surface p-5 sm:p-6">
      <h2 className="display-title text-2xl">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      {rows.length ? (
        <ol className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.participantId}
              className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-3 py-2.5"
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-green text-[10px] font-extrabold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">
                  {row.name}
                </span>
                {row.teamName !== row.name ? (
                  <span className="block truncate text-[11px] font-semibold text-muted">
                    {row.teamName}
                  </span>
                ) : null}
              </span>
              <span className="score-numeral text-lg font-semibold">
                {row.total}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-xl bg-cream px-3 py-4 text-xs font-semibold text-muted">
          {t("leaders.empty")}
        </p>
      )}
      <p className="mt-3 text-[10px] font-medium text-muted">{emptyLabel}</p>
    </section>
  );
}

export function LeadersPage({
  data,
  signedIn,
  currentPath,
}: {
  data: LeadersPageData;
  signedIn: boolean;
  currentPath: string;
}) {
  const { t, seedText } = useI18n();
  const competitions = data.competitions.map((competition) => ({
    name: seedText(competition.name) ?? competition.name,
    slug: competition.slug,
    sport: competition.sport,
  }));
  const activeSport = data.competitions.find(
    (competition) => competition.slug === data.activeCompetitionSlug,
  )?.sport;
  const showFootball = !activeSport || activeSport === "football";
  const showTennis = !activeSport || activeSport === "tennis";

  return (
    <div className="min-h-screen">
      <SiteHeader
        eventSlug={data.event.slug}
        eventName={data.event.name}
        competitions={competitions}
        signedIn={signedIn}
        activeCompetitionSlug={data.activeCompetitionSlug ?? undefined}
        currentPath={currentPath}
      />

      <main id="main-content" className="page-shell pt-7 sm:pt-10">
        <Link
          href={`/events/${data.event.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted transition-colors hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("leaders.backToEvent")}
        </Link>

        <div className="mt-5">
          <p className="eyebrow text-green">{t("leaders.eyebrow")}</p>
          <h1 className="display-title mt-2 text-4xl sm:text-5xl">
            {t("leaders.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            {t("leaders.body")}
          </p>
        </div>

        <nav
          aria-label={t("leaders.filterLabel")}
          className="mt-6 flex flex-wrap gap-2"
        >
          <Link
            href={`/events/${data.event.slug}/leaders`}
            className={`rounded-full px-4 py-2 text-xs font-extrabold transition-colors ${
              data.activeCompetitionSlug
                ? "border border-line bg-white text-ink hover:border-green hover:text-green"
                : "bg-green text-white"
            }`}
          >
            {t("fixtures.allCompetitions")}
          </Link>
          {data.competitions.map((competition) => (
            <Link
              key={competition.id}
              href={`/events/${data.event.slug}/leaders?competition=${competition.slug}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold transition-colors ${
                data.activeCompetitionSlug === competition.slug
                  ? "bg-green text-white"
                  : "border border-line bg-white text-ink hover:border-green hover:text-green"
              }`}
            >
              {competition.sport === "football" ? (
                <BallIcon className="size-3" />
              ) : (
                <TennisIcon className="size-3" />
              )}
              {seedText(competition.name)}
            </Link>
          ))}
        </nav>

        {showFootball ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-green">{t("leaders.footballEyebrow")}</p>
                <h2 className="display-title mt-1 text-3xl">
                  {t("leaders.footballTitle")}
                </h2>
              </div>
              <p className="max-w-md text-xs leading-5 text-muted">
                {t("leaders.footballBody")}
              </p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LeaderList
                title={t("leaders.goals")}
                description={t("leaders.goalsBody")}
                rows={data.leaders.goals}
                emptyLabel={t("leaders.walkoverNote")}
              />
              <LeaderList
                title={t("leaders.assists")}
                description={t("leaders.assistsBody")}
                rows={data.leaders.assists}
                emptyLabel={t("leaders.walkoverNote")}
              />
            </div>
          </section>
        ) : null}

        {showTennis ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow text-clay">{t("leaders.tennisEyebrow")}</p>
                <h2 className="display-title mt-1 text-3xl">
                  {t("leaders.tennisTitle")}
                </h2>
              </div>
              <p className="max-w-md text-xs leading-5 text-muted">
                {t("leaders.tennisBody")}
              </p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LeaderList
                title={t("leaders.aces")}
                description={t("leaders.acesBody")}
                rows={data.leaders.aces}
                emptyLabel={t("leaders.walkoverNote")}
              />
              <LeaderList
                title={t("leaders.doubleFaults")}
                description={t("leaders.doubleFaultsBody")}
                rows={data.leaders.doubleFaults}
                emptyLabel={t("leaders.walkoverNote")}
              />
            </div>
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href={`/events/${data.event.slug}/results`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink transition-colors hover:border-green hover:text-green"
          >
            {t("leaders.viewResults")}
          </Link>
          <Link
            href={`/events/${data.event.slug}/standings`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            {t("leaders.viewStandings")}
          </Link>
        </div>
      </main>

      <SiteFooter eventSlug={data.event.slug} timezone={data.event.timezone} />
    </div>
  );
}
