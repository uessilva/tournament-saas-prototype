"use client";

import Link from "next/link";

import { ArrowLeftIcon, BallIcon, TennisIcon, TrophyIcon } from "@/components/icons";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { SportTag } from "@/components/public/badges";
import { MatchRow } from "@/components/public/match-row";
import { StandingsTable } from "@/components/public/standings-table";
import { knockoutRoundLabel } from "@/features/public/labels";
import { useI18n } from "@/lib/i18n/client";
import type { StandingsPageData } from "@/features/public/types";

function TieBreakExplanation({
  sport,
  seed,
}: {
  sport: "football" | "tennis";
  seed: string | null;
}) {
  const { t } = useI18n();
  const rules =
    sport === "football"
      ? [
          t("standings.rulePointsFootball"),
          t("standings.ruleHeadToHeadPoints"),
          t("standings.ruleHeadToHeadGoalDifference"),
          t("standings.ruleGoalDifference"),
          t("standings.ruleGoalsScored"),
          t("standings.ruleSeededDraw"),
        ]
      : [
          t("standings.rulePointsTennis"),
          t("standings.ruleHeadToHeadTennis"),
          t("standings.ruleSetDifference"),
          t("standings.ruleGameDifference"),
          t("standings.ruleSeededDraw"),
        ];

  return (
    <div className="mt-3 rounded-xl bg-paper p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {t("standings.tieBreakTitle")}
      </p>
      <ol className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-muted">
        {rules.map((rule, index) => (
          <li key={rule}>
            <span className="mr-1 font-extrabold text-ink">{index + 1}.</span>
            {rule}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] font-medium text-muted">
        {sport === "football"
          ? t("standings.headToHeadNote")
          : t("standings.tennisNote")}
      </p>
      <p className="mt-1 break-all text-[11px] font-semibold text-green">
        {t("standings.seedNote").replace("{seed}", seed ?? "—")}
      </p>
    </div>
  );
}

function KnockoutBracket({
  competition,
  eventSlug,
  timezone,
}: {
  competition: StandingsPageData["standings"][number];
  eventSlug: string;
  timezone: string;
}) {
  const { t } = useI18n();

  if (!competition.fixtures.length) {
    return (
      <div className="mt-5 rounded-2xl bg-cream p-5">
        <p className="text-sm font-bold">
          {competition.drawGeneratedAt
            ? t("standings.noBracketTitle")
            : t("standings.pendingTitle")}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          {competition.drawGeneratedAt
            ? t("standings.noBracketBody")
            : t("standings.pendingBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-wrap items-start gap-5">
      {[
        ...new Set(
          competition.fixtures.map((match) => match.roundNumber),
        ),
      ]
        .sort((a, b) => a - b)
        .map((roundNumber) => (
          <div key={roundNumber} className="min-w-[260px] flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
              {knockoutRoundLabel(
                roundNumber,
                competition.fixtures[0]?.knockoutRoundCount ?? 1,
                t,
              )}
            </p>
            {competition.fixtures
              .filter((match) => match.roundNumber === roundNumber)
              .map((match) => (
                <MatchRow
                  key={match.id}
                  match={match}
                  timezone={timezone}
                  eventSlug={eventSlug}
                />
              ))}
          </div>
        ))}
    </div>
  );
}

export function StandingsPage({
  data,
  signedIn,
  currentPath,
}: {
  data: StandingsPageData;
  signedIn: boolean;
  currentPath: string;
}) {
  const { t, seedText } = useI18n();
  const competitions = data.competitions.map((competition) => ({
    name: seedText(competition.name) ?? competition.name,
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
        activeCompetitionSlug={data.activeCompetitionSlug ?? undefined}
        currentPath={currentPath}
      />

      <main id="main-content" className="page-shell pt-7 sm:pt-10">
        <Link
          href={`/events/${data.event.slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted transition-colors hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("standings.backToEvent")}
        </Link>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("standings.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("standings.title")}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              {t("standings.body")}
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-soft-green px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-green">
            <TrophyIcon className="size-3.5" />
            {t("standings.confirmedOnly")}
          </p>
        </div>

        <nav
          aria-label={t("standings.filterLabel")}
          className="mt-6 flex flex-wrap gap-2"
        >
          <Link
            href={`/events/${data.event.slug}/standings`}
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
              href={`/events/${data.event.slug}/standings?competition=${competition.slug}`}
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

        {data.standings.length ? (
          <div className="mt-8 space-y-6">
            {data.standings.map((competition) => (
              <section
                key={competition.id}
                className="surface p-5 sm:p-7"
                style={{
                  borderTopWidth: 4,
                  borderTopColor:
                    competition.sport === "football"
                      ? "var(--color-green)"
                      : "var(--color-clay)",
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SportTag sport={competition.sport} />
                      {competition.status === "cancelled" ? (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-red-700">
                          {t("status.cancelled")}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="display-title mt-2 text-3xl">
                      {seedText(competition.name)}
                    </h2>
                  </div>
                  <Link
                    href={`/events/${data.event.slug}/competitions/${competition.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-green hover:underline"
                  >
                    {t("standings.openCompetition")}
                  </Link>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-muted">
                  {competition.format === "groups_knockout" ? (
                    <span className="rounded-full bg-cream px-2.5 py-1">
                      {t("standings.qualifiersValue").replace(
                        "{count}",
                        String(competition.qualifiersPerGroup),
                      )}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-cream px-2.5 py-1">
                    {t("standings.walkoverNote")}
                  </span>
                </div>

                {competition.format === "single_elimination" ? (
                  <KnockoutBracket
                    competition={competition}
                    eventSlug={data.event.slug}
                    timezone={data.event.timezone}
                  />
                ) : (
                  <>
                    <TieBreakExplanation
                      sport={competition.sport}
                      seed={competition.drawSeed}
                    />

                    {competition.groups.length ? (
                      <div className="mt-5 grid gap-7 lg:grid-cols-2">
                        {competition.groups.map((group) => (
                          <StandingsTable
                            key={group.id}
                            group={group}
                            sport={competition.sport}
                            qualifiersPerGroup={
                              competition.format === "groups_knockout"
                                ? competition.qualifiersPerGroup
                                : 0
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-5 rounded-2xl bg-cream p-5">
                        <p className="text-sm font-bold">
                          {competition.drawGeneratedAt
                            ? t("standings.noGroupsTitle")
                            : t("standings.pendingTitle")}
                        </p>
                        <p className="mt-1.5 text-sm leading-6 text-muted">
                          {competition.drawGeneratedAt
                            ? t("standings.noGroupsBody")
                            : t("standings.pendingBody")}
                        </p>
                      </div>
                    )}

                    {competition.format === "groups_knockout" ? (
                      <div className="mt-7 border-t border-line pt-5">
                        <h3 className="display-title text-2xl">
                          {t("competition.bracketTitle")}
                        </h3>
                        <KnockoutBracket
                          competition={competition}
                          eventSlug={data.event.slug}
                          timezone={data.event.timezone}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="surface mt-8 p-8 text-center">
            <h2 className="display-title text-2xl">
              {t("standings.emptyTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
              {t("standings.emptyBody")}
            </p>
          </div>
        )}
      </main>

      <SiteFooter eventSlug={data.event.slug} timezone={data.event.timezone} />
    </div>
  );
}
