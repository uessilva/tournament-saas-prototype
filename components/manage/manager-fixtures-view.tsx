"use client";

import Link from "next/link";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
} from "@/components/icons";
import { MatchRow } from "@/components/public/match-row";
import { ManagerDisputeActions } from "@/components/manage/manager-dispute-actions";
import { ManagerScoresheetActions } from "@/components/manage/manager-scoresheet-actions";
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";
import type { ManagerFixturesData } from "@/features/matches/manager-queries";

export function ManagerFixturesView({
  data,
  user,
}: {
  data: ManagerFixturesData;
  user: { name: string | null; email: string | null };
}) {
  const { t } = useI18n();
  const primaryTeam = data.teams[0];
  const eventSlug = primaryTeam?.eventSlug ?? "";
  const timezone = primaryTeam?.eventTimezone ?? "America/Sao_Paulo";

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar user={user} publicHref={eventSlug ? `/events/${eventSlug}/fixtures` : "/"} />

      <main id="main-content" className="page-shell py-8">
        <Link
          href="/manage"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("manage.backToTeams")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("manageFixtures.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("manageFixtures.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("manageFixtures.body")}
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
            <ClockIcon className="size-3.5" />
            {formatTimeZoneLabel(timezone)}
          </p>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.teams.map((team) => (
            <article key={team.id} className="surface p-4">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                {team.competitionName}
              </p>
              <h2 className="display-title mt-1 text-2xl">{team.name}</h2>
              <Link
                href={`/events/${team.eventSlug}/competitions/${team.competitionSlug}`}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-green hover:underline"
              >
                {t("manage.publicPage")}
                <ArrowRightIcon className="size-3" />
              </Link>
            </article>
          ))}
        </section>

        <section className="surface mt-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <h2 className="display-title text-3xl">
              {t("manageFixtures.fixturesTitle")}
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <CalendarIcon className="size-3.5" />
              {t("manageFixtures.matchCount").replace(
                "{count}",
                String(data.fixtures.length),
              )}
            </span>
          </div>

          {data.fixtures.length ? (
            <div className="mt-1">
              {data.fixtures.map((match) => (
                <div key={match.id}>
                  <MatchRow
                    match={match}
                    timezone={timezone}
                    eventSlug={eventSlug}
                    showCompetition
                  />
                  <ManagerScoresheetActions
                    matchId={match.id}
                    matchStatus={match.status}
                    sheets={data.scoresheetsByMatch[match.id] ?? []}
                    timezone={timezone}
                  />
                  <ManagerDisputeActions
                    matchId={match.id}
                    matchStatus={match.status}
                    timezone={timezone}
                    disputes={data.disputesByMatch[match.id] ?? []}
                    managedTeams={data.teams.filter(
                      (team) =>
                        team.id === match.homeTeamId ||
                        team.id === match.awayTeamId,
                    )}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm font-bold">
                {t("manageFixtures.emptyTitle")}
              </p>
              <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">
                {t("manageFixtures.emptyBody")}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
