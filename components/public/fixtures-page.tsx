"use client";

import Link from "next/link";

import { CalendarIcon, ClockIcon } from "@/components/icons";
import { MatchRow } from "@/components/public/match-row";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";
import type { FixturesPageData, PublicMatch } from "@/features/public/types";

function dateKey(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function FixturesPage({
  data,
  signedIn,
  currentPath,
}: {
  data: FixturesPageData;
  signedIn: boolean;
  currentPath: string;
}) {
  const { t, formatDate } = useI18n();
  const competitions = data.competitions.map((competition) => ({
    name: competition.name,
    slug: competition.slug,
    sport: competition.sport,
  }));

  const groups: Array<{
    key: string;
    label: string;
    matches: PublicMatch[];
  }> = [];
  const byKey = new Map<string, (typeof groups)[number]>();

  for (const match of data.fixtures) {
    const key = match.startsAt
      ? dateKey(match.startsAt, data.event.timezone)
      : "unscheduled";
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        label: match.startsAt
          ? formatDate(match.startsAt, data.event.timezone, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : t("fixtures.unscheduled"),
        matches: [],
      };
      byKey.set(key, group);
      groups.push(group);
    }
    group.matches.push(match);
  }

  const activeCompetition = data.competitions.find(
    (competition) => competition.slug === data.activeCompetitionSlug,
  );

  return (
    <div className="min-h-screen">
      <SiteHeader
        eventSlug={data.event.slug}
        eventName={data.event.name}
        competitions={competitions}
        signedIn={signedIn}
        currentPath={currentPath}
      />

      <main id="main-content" className="page-shell pt-7 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("fixtures.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {activeCompetition
                ? activeCompetition.name
                : t("fixtures.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {t("fixtures.body")}
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
            <ClockIcon className="size-3.5" />
            {t("home.timezone")}:{" "}
            {formatTimeZoneLabel(
              data.event.timezone,
              new Date(data.event.startsAt),
            )}
          </p>
        </div>

        <nav
          aria-label={t("fixtures.filterLabel")}
          className="mt-6 flex flex-wrap gap-2"
        >
          <Link
            href={`/events/${data.event.slug}/fixtures`}
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
              href={`/events/${data.event.slug}/fixtures?competition=${competition.slug}`}
              className={`rounded-full px-4 py-2 text-xs font-extrabold transition-colors ${
                data.activeCompetitionSlug === competition.slug
                  ? "bg-green text-white"
                  : "border border-line bg-white text-ink hover:border-green hover:text-green"
              }`}
            >
              {competition.name}
              <span className="ml-1.5 text-[10px] opacity-70">
                {competition.matchCount}
              </span>
            </Link>
          ))}
        </nav>

        {groups.length ? (
          <div className="mt-8 space-y-7">
            {groups.map((group) => (
              <section key={group.key} className="surface p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <h2 className="display-title text-2xl">{group.label}</h2>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                    <CalendarIcon className="size-3.5" />
                    {t("fixtures.matchCount").replace(
                      "{count}",
                      String(group.matches.length),
                    )}
                  </span>
                </div>
                <div className="mt-1">
                  {group.matches.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      timezone={data.event.timezone}
                      eventSlug={data.event.slug}
                      showCompetition
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="surface mt-8 p-8 text-center">
            <h2 className="display-title text-2xl">
              {t("fixtures.emptyTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              {t("fixtures.emptyBody")}
            </p>
          </div>
        )}
      </main>

      <SiteFooter eventSlug={data.event.slug} timezone={data.event.timezone} />
    </div>
  );
}
