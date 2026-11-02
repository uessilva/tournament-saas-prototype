"use client";

import Link from "next/link";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
} from "@/components/icons";
import { RosterEditor } from "@/components/manage/roster-editor";
import {
  RegistrationBadge,
  SportTag,
} from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { TeamRosterData } from "@/features/teams/types";

export function TeamRosterView({
  data,
  user,
}: {
  data: TeamRosterData;
  user: { name: string | null; email: string | null };
}) {
  const { t, formatDate, formatDateTime } = useI18n();
  const registrationOpen = data.competition.registrationOpen;
  const rosterLimit =
    data.competition.rosterMin != null && data.competition.rosterMax != null
      ? t("competition.rosterLimitValue")
          .replace("{min}", String(data.competition.rosterMin))
          .replace("{max}", String(data.competition.rosterMax))
      : null;
  const birthRange =
    data.competition.birthDateFrom || data.competition.birthDateTo
      ? t("competition.birthRange")
          .replace(
            "{from}",
            data.competition.birthDateFrom
              ? formatDate(data.competition.birthDateFrom, "UTC", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—",
          )
          .replace(
            "{to}",
            data.competition.birthDateTo
              ? formatDate(data.competition.birthDateTo, "UTC", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—",
          )
      : null;

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}/competitions/${data.competition.slug}`}
        secondaryHref="/manage"
        secondaryLabel={t("manage.backToTeams")}
      />

      <main id="main-content" className="page-shell py-8">
        <Link
          href="/manage"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("manage.backToTeams")}
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SportTag sport={data.competition.sport} />
              <RegistrationBadge
                state={registrationOpen ? "open" : "closed"}
              />
            </div>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">
              {data.team.name}
            </h1>
            <p className="mt-2 text-sm font-bold text-muted">
              {data.competition.name} · {data.event.name}
            </p>
            <p className="mt-1 text-xs font-medium text-muted">
              {t("manage.rosterBody")}
            </p>
          </div>
          <Link
            href={`/events/${data.event.slug}/competitions/${data.competition.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink hover:border-green hover:text-green"
          >
            {t("manage.publicPage")}
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <span
                className={`grid size-9 place-items-center rounded-full ${
                  data.eligibilityOk
                    ? "bg-soft-green text-green"
                    : "bg-soft-orange text-clay"
                }`}
              >
                {data.eligibilityOk ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <UsersIcon className="size-4" />
                )}
              </span>
              <div>
                <h2 className="text-sm font-extrabold">
                  {data.eligibilityOk
                    ? t("manage.eligibilityOk")
                    : t("manage.eligibilityPending")}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-muted">
                  {t("manage.playerCount").replace(
                    "{count}",
                    String(data.participants.length),
                  )}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-muted">
              {rosterLimit ? (
                <span className="rounded-full bg-cream px-2.5 py-1">
                  {rosterLimit}
                </span>
              ) : null}
              {birthRange ? (
                <span className="rounded-full bg-cream px-2.5 py-1">
                  {birthRange}
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-[1.25rem] p-5 text-sm font-semibold ${
              registrationOpen
                ? "bg-soft-green text-green"
                : "bg-cream text-muted"
            }`}
          >
            <p>
              {registrationOpen
                ? t("manage.registrationOpenNotice")
                : data.competition.registrationClosedByDeadline
                  ? t("manage.registrationDeadlineNotice")
                  : t("manage.registrationClosedNotice")}
            </p>
            {data.competition.registrationDeadline && registrationOpen ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold">
                <ClockIcon className="size-3.5" />
                {t("manage.registrationDeadline")
                  .replace(
                    "{date}",
                    formatDateTime(
                      data.competition.registrationDeadline,
                      data.event.timezone,
                    ),
                  )
                  .replace("{timezone}", data.event.timezone)}
              </p>
            ) : null}
            {data.managers.length ? (
              <p className="mt-2 text-xs font-bold">
                {t("competition.manager")}: {data.managers.join(", ")}
              </p>
            ) : null}
          </div>
        </section>

        <RosterEditor
          teamId={data.team.id}
          participants={data.participants}
          canEdit={registrationOpen}
          sport={data.competition.sport}
          rosterMin={data.competition.rosterMin}
          rosterMax={data.competition.rosterMax}
        />
      </main>
    </div>
  );
}
