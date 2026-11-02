"use client";

import Link from "next/link";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ShirtIcon,
  UsersIcon,
} from "@/components/icons";
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
  const { t, formatDate } = useI18n();
  const registrationOpen = data.competition.registrationState === "open";
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
              <RegistrationBadge state={data.competition.registrationState} />
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
            {registrationOpen
              ? t("manage.registrationOpenNotice")
              : t("manage.registrationClosedNotice")}
          </div>
        </section>

        <section className="surface mt-5 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <p className="eyebrow text-green">{t("manage.rosterTitle")}</p>
              <h2 className="display-title mt-1 text-2xl">
                {t("manage.playerCount").replace(
                  "{count}",
                  String(data.participants.length),
                )}
              </h2>
            </div>
            <p className="text-xs font-medium text-muted">
              {data.managers.length
                ? `${t("competition.manager")}: ${data.managers.join(", ")}`
                : null}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <caption className="sr-only">
                {data.team.name} — {t("manage.rosterTitle")}
              </caption>
              <thead>
                <tr className="border-b border-line bg-paper/60 text-[10px] uppercase tracking-[0.1em] text-muted">
                  <th className="px-5 py-3 font-extrabold">
                    {t("manage.shirt")}
                  </th>
                  <th className="px-5 py-3 font-extrabold">
                    {t("competition.players")}
                  </th>
                  <th className="px-5 py-3 font-extrabold">
                    {t("manage.position")}
                  </th>
                  <th className="px-5 py-3 font-extrabold">
                    {t("manage.birthDate")}
                  </th>
                  <th className="px-5 py-3 font-extrabold">
                    {t("manage.captain")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.participants.map((participant) => (
                  <tr
                    key={participant.id}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 font-extrabold text-muted">
                        <ShirtIcon className="size-3.5" />
                        {participant.shirtNumber ?? "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold">
                      {participant.firstName} {participant.lastName}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {participant.position ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-muted">
                      {formatDate(participant.dateOfBirth, "UTC", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      {participant.isCaptain ? (
                        <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-ink">
                          {t("manage.captain")}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
