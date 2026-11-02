"use client";

import Link from "next/link";

import {
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  MailIcon,
  MapPinIcon,
  RefreshIcon,
  UsersIcon,
} from "@/components/icons";
import { AppTopBar } from "@/components/app-top-bar";
import { SportTag, CompetitionStatusBadge } from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { DemoAccount } from "@/lib/auth/guards";
import type { AdminEventData } from "@/features/events/types";
import {
  resetDemoAction,
  switchDemoAccount,
} from "@/features/auth/actions";

function formatLabel(
  format: string,
  t: (key: DictionaryKey) => string,
) {
  return t(`format.${format}` as DictionaryKey);
}

export function AdminDashboard({
  data,
  user,
  demoAccounts,
  demoMode,
  resetSuccess,
  openDisputes,
}: {
  data: AdminEventData;
  user: { name: string | null; email: string | null };
  demoAccounts: DemoAccount[];
  demoMode: boolean;
  resetSuccess: boolean;
  openDisputes: number;
}) {
  const { t, formatDate } = useI18n();
  const doneCount = data.checklist.filter((item) => item.state === "done").length;
  const progress = Math.round((doneCount / data.checklist.length) * 100);
  const callbackUrl = `/admin/events/${data.event.id}`;

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}`}
      />

      <div className="page-shell grid gap-6 py-6 lg:grid-cols-[230px_1fr] lg:py-8">
        <aside className="hidden self-start rounded-2xl bg-ink p-4 text-white lg:sticky lg:top-6 lg:block">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-lime">
              {t("admin.eventLabel")}
            </p>
            <p className="display-title mt-1 text-xl">{data.event.name}</p>
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-white/60">
              <MapPinIcon className="size-3" />
              {data.event.locationLabel}
            </p>
          </div>

          <nav className="mt-5 grid gap-1 text-sm" aria-label={t("common.admin")}>
            <span className="rounded-lg bg-white/10 px-3 py-2 font-extrabold text-lime">
              {t("nav.overview")}
            </span>
            <a
              href="#checklist"
              className="rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("admin.checklist")}
            </a>
            <a
              href="#competitions"
              className="rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("nav.competitions")}
            </a>
            <Link
              href={`/admin/events/${data.event.id}/schedule`}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("admin.schedule")}
              <ChevronRightIcon className="size-3.5" />
            </Link>
            <Link
              href={`/admin/events/${data.event.id}/teams`}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("admin.teamsAccess")}
              <ChevronRightIcon className="size-3.5" />
            </Link>
            <Link
              href={`/admin/events/${data.event.id}/review`}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("admin.reviewQueue")}
              <ChevronRightIcon className="size-3.5" />
            </Link>
            <Link
              href={`/admin/events/${data.event.id}/disputes`}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="size-3.5" />
                {t("admin.disputes")}
              </span>
              <span className="inline-flex items-center gap-2">
                {openDisputes > 0 ? (
                  <span className="rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-extrabold text-white">
                    {openDisputes}
                  </span>
                ) : null}
                <ChevronRightIcon className="size-3.5" />
              </span>
            </Link>
            <Link
              href={`/events/${data.event.slug}`}
              className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 font-bold text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              {t("admin.publicHub")}
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </nav>

          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/40">
              {t("admin.signedInAs")}
            </p>
            <p className="mt-1 text-sm font-extrabold">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-[11px] text-white/50">{user.email}</p>
          </div>

          {demoMode ? (
            <span className="mt-4 inline-flex rounded-full bg-lime/15 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-lime">
              {t("admin.demoBadge")}
            </span>
          ) : null}
        </aside>

        <main id="main-content">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-green">{t("admin.eyebrow")}</p>
              <h1 className="display-title mt-2 text-4xl sm:text-5xl">
                {t("admin.title")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                {t("admin.body")}
              </p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
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
                <span className="text-line">·</span>
                <MapPinIcon className="size-3.5" />
                {data.event.locationLabel}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/events/${data.event.id}/schedule`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink transition-colors hover:border-green hover:text-green"
              >
                <CalendarIcon className="size-3.5" />
                {t("admin.schedule")}
              </Link>
              <Link
                href={`/events/${data.event.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
              >
                {t("admin.publicHub")}
                <ArrowUpRightIcon className="size-3.5" />
              </Link>
            </div>
          </header>

          {resetSuccess ? (
            <div
              role="status"
              className="mt-5 flex items-start gap-3 rounded-xl border border-green/20 bg-soft-green px-4 py-3 text-sm font-semibold text-green"
            >
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
              {t("admin.resetSuccess")}
            </div>
          ) : null}

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              [t("admin.teams"), data.metrics.teams],
              [t("admin.participants"), data.metrics.participants],
              [t("admin.pendingInvitations"), data.metrics.pendingInvitations],
              [t("admin.venues"), data.metrics.venues],
              [t("admin.matches"), data.metrics.matches],
              [t("admin.publishedResults"), data.metrics.publishedResults],
            ].map(([label, value]) => (
              <div key={String(label)} className="surface p-4">
                <div className="display-title text-3xl">{value}</div>
                <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  {label}
                </div>
              </div>
            ))}
          </section>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-5">
              <section id="checklist" className="surface scroll-mt-6 p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow text-green">{t("admin.checklist")}</p>
                    <h2 className="display-title mt-2 text-2xl">
                      {t("admin.checklistBody")}
                    </h2>
                  </div>
                  <span className="text-xs font-extrabold text-muted">
                    {doneCount}/{data.checklist.length}
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-cream">
                  <div
                    className="h-full rounded-full bg-green transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <ol className="mt-5 space-y-2">
                  {data.checklist.map((item) => (
                    <li
                      key={item.key}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        item.state === "current"
                          ? "border-orange/40 bg-soft-orange"
                          : "border-line bg-paper/60"
                      }`}
                    >
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-extrabold ${
                          item.state === "done"
                            ? "bg-green text-white"
                            : item.state === "current"
                              ? "bg-clay text-white"
                              : "bg-cream text-muted"
                        }`}
                      >
                        {item.state === "done" ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          data.checklist.indexOf(item) + 1
                        )}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-bold">
                        {t(item.labelKey as DictionaryKey)}
                        {item.detail ? (
                          <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold text-muted">
                            {item.detail}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase tracking-[0.1em] ${
                          item.state === "done"
                            ? "text-green"
                            : item.state === "current"
                              ? "text-clay"
                              : "text-muted/60"
                        }`}
                      >
                        {item.state === "done"
                          ? t("admin.checklistDone")
                          : item.state === "current"
                            ? t("admin.checklistCurrent")
                            : t("admin.checklistNext")}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <section id="competitions" className="scroll-mt-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="eyebrow text-green">
                      {t("admin.competitionsTitle")}
                    </p>
                    <h2 className="display-title mt-2 text-2xl">
                      {t("admin.competitionsBody")}
                    </h2>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {data.competitions.map((competition) => (
                    <article
                      key={competition.id}
                      className="surface overflow-hidden p-5"
                      style={{
                        borderTopWidth: 4,
                        borderTopColor:
                          competition.sport === "football"
                            ? "var(--color-green)"
                            : "var(--color-clay)",
                      }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <SportTag sport={competition.sport} />
                        <CompetitionStatusBadge
                          status={competition.status}
                          registrationState={competition.registrationState}
                        />
                      </div>
                      <h3 className="display-title mt-3 text-2xl">
                        {competition.name}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-muted">
                        {formatLabel(competition.format, t)}
                      </p>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-paper p-2">
                          <div className="text-lg font-extrabold">
                            {competition.teamCount}
                          </div>
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
                            {competition.sport === "football"
                              ? t("admin.cardTeams")
                              : t("admin.cardEntrants")}
                          </div>
                        </div>
                        <div className="rounded-xl bg-paper p-2">
                          <div className="text-lg font-extrabold">
                            {competition.participantCount}
                          </div>
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
                            {t("admin.cardPeople")}
                          </div>
                        </div>
                        <div className="rounded-xl bg-paper p-2">
                          <div className="text-lg font-extrabold">
                            {competition.publishedCount}
                          </div>
                          <div className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
                            {t("admin.cardPublished")}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/events/${data.event.id}/competitions/${competition.id}`}
                          className="inline-flex items-center gap-1 text-xs font-extrabold text-ink hover:text-green"
                        >
                          {t("admin.manageCompetition")}
                          <ChevronRightIcon className="size-3.5" />
                        </Link>
                        <Link
                          href={`/events/${data.event.slug}/competitions/${competition.slug}`}
                          className="inline-flex items-center gap-1 text-xs font-extrabold text-green hover:underline"
                        >
                          {t("admin.viewPublicPage")}
                          <ChevronRightIcon className="size-3.5" />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="surface p-5">
                <p className="eyebrow text-green">{t("admin.nextStepTitle")}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t("admin.nextStepBody")}
                </p>
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-soft-orange p-3 text-xs font-bold text-clay">
                  <UsersIcon className="size-4" />
                  {t("admin.checklistInvitations")
                    .replace("{accepted}", String(data.managers.accepted))
                    .replace("{total}", String(data.managers.total))}
                </div>
                <Link
                  href={`/admin/events/${data.event.id}/teams`}
                  className="mt-3 inline-flex w-full items-center justify-between gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
                >
                  {t("admin.manageAccess")}
                  <ChevronRightIcon className="size-3.5" />
                </Link>
              </section>

              <section
                id="disputes"
                className={`surface p-5 ${
                  openDisputes > 0 ? "border-clay/40 bg-soft-orange/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow text-green">{t("admin.disputes")}</p>
                    <h2 className="display-title mt-2 text-2xl">
                      {t("admin.disputeCardTitle")}
                    </h2>
                  </div>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft-orange text-clay">
                    <LockIcon className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted">
                  {t("admin.disputeCardBody")}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="display-title text-2xl">{openDisputes}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                    {t("admin.openDisputes")}
                  </span>
                </div>
                <Link
                  href={`/admin/events/${data.event.id}/disputes`}
                  className="mt-3 inline-flex w-full items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink transition-colors hover:border-green hover:text-green"
                >
                  {t("admin.openDisputesAction")}
                  <ChevronRightIcon className="size-3.5" />
                </Link>
              </section>

              {demoMode ? (
                <section id="demo" className="rounded-[1.25rem] bg-ink p-5 text-white">
                  <p className="eyebrow text-lime">{t("admin.demoBadge")}</p>
                  <h2 className="display-title mt-2 text-2xl">
                    {t("admin.resetTitle")}
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-white/60">
                    {t("admin.resetBody")}
                  </p>

                  <form action={switchDemoAccount} className="mt-5 space-y-2">
                    <input type="hidden" name="callbackUrl" value={callbackUrl} />
                    <label
                      htmlFor="demo-account"
                      className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50"
                    >
                      {t("admin.switchAccount")}
                    </label>
                    <select
                      id="demo-account"
                      name="email"
                      defaultValue={
                        demoAccounts.find(
                          (account) => account.email === user.email,
                        )?.email ??
                        demoAccounts[0]?.email ??
                        ""
                      }
                      className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-lime"
                    >
                      {demoAccounts.map((account) => (
                        <option
                          key={account.id}
                          value={account.email}
                          className="text-ink"
                        >
                          {account.name} ·{" "}
                          {account.role === "owner"
                            ? t("auth.owner")
                            : account.detail}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-lime px-3 py-2 text-xs font-extrabold text-ink transition-colors hover:bg-white"
                    >
                      {t("admin.switchAccountAction")}
                    </button>
                  </form>

                  <form action={resetDemoAction} className="mt-5 border-t border-white/10 pt-4">
                    <input type="hidden" name="eventId" value={data.event.id} />
                    <p className="text-[11px] leading-5 text-white/50">
                      {t("admin.resetWarning")}
                    </p>
                    <button
                      type="submit"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:border-orange hover:bg-orange/20"
                    >
                      <RefreshIcon className="size-3.5" />
                      {t("admin.resetDemo")}
                    </button>
                  </form>

                  <a
                    href="http://localhost:8025"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-lime hover:underline"
                  >
                    <MailIcon className="size-3.5" />
                    {t("home.mailpit")}
                  </a>
                </section>
              ) : null}
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
