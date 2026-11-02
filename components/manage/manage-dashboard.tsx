"use client";

import Link from "next/link";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowRightIcon,
  ChevronRightIcon,
  UsersIcon,
} from "@/components/icons";
import {
  CompetitionStatusBadge,
  SportTag,
} from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { ManagedTeam } from "@/features/teams/types";

export function ManageDashboard({
  user,
  teams,
  inviteAccepted = false,
  inviteCount = 0,
}: {
  user: { name: string | null; email: string | null };
  teams: ManagedTeam[];
  inviteAccepted?: boolean;
  inviteCount?: number;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar user={user} publicHref="/" />
      <main id="main-content" className="page-shell py-8">
        <p className="eyebrow text-green">{t("manage.eyebrow")}</p>
        <h1 className="display-title mt-2 text-4xl sm:text-5xl">
          {t("manage.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t("manage.body")}
        </p>

        {inviteAccepted ? (
          <div
            role="status"
            className="mt-5 flex items-start gap-3 rounded-xl border border-green/20 bg-soft-green px-4 py-3 text-sm font-semibold text-green"
          >
            <ArrowRightIcon className="mt-0.5 size-4 shrink-0" />
            {t("manage.inviteAccepted").replace(
              "{count}",
              String(inviteCount || teams.length),
            )}
          </div>
        ) : null}

        {teams.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => (
              <article
                key={team.teamId}
                className="surface flex flex-col p-5"
                style={{
                  borderTopWidth: 4,
                  borderTopColor:
                    team.sport === "football"
                      ? "var(--color-green)"
                      : "var(--color-clay)",
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SportTag sport={team.sport} />
                  <CompetitionStatusBadge
                    status={team.competitionStatus}
                    registrationState={team.registrationState}
                  />
                </div>
                <h2 className="display-title mt-4 text-3xl">{team.teamName}</h2>
                <p className="mt-1 text-xs font-bold text-muted">
                  {team.competitionName} · {team.eventName}
                </p>

                <div className="mt-4 flex items-center gap-3 text-[11px] font-bold text-muted">
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon className="size-3.5" />
                    {t("manage.rosterTitle")}
                  </span>
                </div>

                <Link
                  href={`/manage/teams/${team.teamId}`}
                  className="mt-5 inline-flex items-center justify-between gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
                >
                  {t("manage.openTeam")}
                  <ArrowRightIcon className="size-3.5" />
                </Link>
                <Link
                  href={`/events/${team.eventSlug}/competitions/${team.competitionSlug}`}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-extrabold text-green hover:underline"
                >
                  {t("manage.publicPage")}
                  <ChevronRightIcon className="size-3" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface mt-8 flex items-start gap-3 p-6">
            <UsersIcon className="mt-0.5 size-5 text-muted" />
            <p className="text-sm font-semibold text-muted">
              {t("manage.noTeams")}
            </p>
            <ChevronRightIcon className="ml-auto size-4 text-muted" />
          </div>
        )}
      </main>
    </div>
  );
}
