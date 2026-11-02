"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AppTopBar } from "@/components/app-top-bar";
import { CompetitionLifecyclePanel } from "@/components/admin/competition-lifecycle-panel";
import { DrawAdminPanel } from "@/components/admin/draw-admin-panel";
import { StandingsTable } from "@/components/public/standings-table";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  ClockIcon,
  LockIcon,
  MailIcon,
  UsersIcon,
} from "@/components/icons";
import {
  CompetitionStatusBadge,
  RegistrationBadge,
  SportTag,
} from "@/components/public/badges";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { DemoAccount } from "@/lib/auth/guards";
import { switchDemoAccount } from "@/features/auth/actions";
import {
  deadlineAction,
  registrationStateAction,
  saveCompetitionConfigurationAction,
  type CompetitionAdminActionState,
} from "@/features/competitions/admin-actions";
import type { CompetitionLifecycleEvent } from "@/features/competitions/lifecycle-queries";
import type { AdminCompetitionData } from "@/features/competitions/types";

const EMPTY_STATE: CompetitionAdminActionState = { status: "idle" };

function CompetitionAdminFeedback({
  state,
}: {
  state: CompetitionAdminActionState;
}) {
  const { t } = useI18n();

  const keyByCode: Record<string, DictionaryKey> =
    state.status === "error"
      ? {
          reopen_after_generation: "compAdmin.reopenAfterGeneration",
          deadline_passed: "compAdmin.deadlinePassedHint",
          action_failed: "compAdmin.actionFailed",
          competition_cancelled: "compLifecycle.mutationsBlocked",
          fix_errors: "compAdmin.configFixErrors",
          sport_locked: "compAdmin.sportLocked",
          configuration_locked: "compAdmin.configurationLocked",
        }
      : {
          registration_closed: "compAdmin.registrationClosedNotice",
          registration_opened: "compAdmin.registrationOpenedNotice",
          deadline_saved: "compAdmin.deadlineSaved",
          deadline_extended: "compAdmin.deadlineExtended",
          deadline_cleared: "compAdmin.deadlineCleared",
          configuration_saved: "compAdmin.configurationSaved",
        };

  return (
    <ActionFeedback
      status={state.status}
      message={t(keyByCode[state.code ?? ""] ?? "compAdmin.actionFailed")}
    />
  );
}

function RegistrationStateCard({ data }: { data: AdminCompetitionData }) {
  const { t } = useI18n();
  const [state, action] = useActionState(
    registrationStateAction,
    EMPTY_STATE,
  );
  const competition = data.competition;
  const cancelled = competition.status === "cancelled";
  const generated = Boolean(competition.drawGeneratedAt);
  const reopenDisabled = generated || competition.deadlinePassed;

  return (
    <section className="surface p-5 sm:p-6">
      <p className="eyebrow text-green">{t("compAdmin.registrationEyebrow")}</p>
      <h2 className="display-title mt-2 text-2xl">
        {t("compAdmin.registrationTitle")}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        {t("compAdmin.registrationBody")}
      </p>

      <div
        className={`mt-4 rounded-xl p-4 ${
          competition.registrationOpen
            ? "bg-soft-green"
            : "bg-cream"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RegistrationBadge
            state={competition.registrationOpen ? "open" : "closed"}
          />
          <span className="text-[11px] font-bold text-muted">
            {competition.registrationOpen
              ? t("compAdmin.stateOpen")
              : competition.registrationClosedByDeadline
                ? t("compAdmin.stateClosedByDeadline")
                : t("compAdmin.stateClosed")}
          </span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold text-muted">
          <ClockIcon className="size-3.5" />
          {t("compAdmin.deadline")}:{" "}
          {competition.registrationDeadline
            ? new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: data.event.timezone,
              }).format(new Date(competition.registrationDeadline))
            : t("compAdmin.noDeadline")}
          <span className="text-line">·</span>
          {data.event.timezone}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={action}>
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="competitionId" value={competition.id} />
          <input type="hidden" name="intent" value="close" />
          <SubmitButton
            label={t("compAdmin.closeRegistration")}
            pendingLabel={t("common.loading")}
            tone="danger"
            disabled={!competition.registrationOpen || cancelled}
          />
        </form>
        <form action={action}>
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="competitionId" value={competition.id} />
          <input type="hidden" name="intent" value="open" />
          <SubmitButton
            label={t("compAdmin.reopenRegistration")}
            pendingLabel={t("common.loading")}
            tone="dark"
            disabled={competition.registrationOpen || reopenDisabled || cancelled}
          />
        </form>
      </div>
      {cancelled ? (
        <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700">
          {t("compLifecycle.mutationsBlocked")}
        </p>
      ) : generated ? (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-soft-orange px-2.5 py-1.5 text-[11px] font-bold text-clay">
          <LockIcon className="mt-0.5 size-3.5 shrink-0" />
          {t("compAdmin.reopenAfterGeneration")}
        </p>
      ) : competition.deadlinePassed && !competition.registrationOpen ? (
        <p className="mt-2 text-[11px] font-bold text-clay">
          {t("compAdmin.deadlinePassedHint")}
        </p>
      ) : null}
      <CompetitionAdminFeedback state={state} />
    </section>
  );
}

function ConfigurationEditor({ data }: { data: AdminCompetitionData }) {
  const { t } = useI18n();
  const [state, action] = useActionState(
    saveCompetitionConfigurationAction,
    EMPTY_STATE,
  );
  const competition = data.competition;
  const cancelled = competition.status === "cancelled";
  const sportLocked = cancelled || data.counts.entrants > 0;
  const eligibilityLocked =
    cancelled || data.draw.generated || data.draw.confirmedResultExists;
  const durationLocked = cancelled || data.draw.confirmedResultExists;
  const inputClass =
    "mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";
  const labelClass =
    "text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted";

  return (
    <section id="configuration" className="surface p-5 sm:p-6">
      <p className="eyebrow text-green">{t("compAdmin.configEyebrow")}</p>
      <h2 className="display-title mt-2 text-2xl">
        {t("compAdmin.configTitle")}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        {t("compAdmin.configBody")}
      </p>

      <form
        key={state.status === "success" ? state.code : "config-form"}
        action={action}
        className="mt-4 space-y-4"
      >
        <input type="hidden" name="eventId" value={data.event.id} />
        <input type="hidden" name="competitionId" value={competition.id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="competition-sport" className={labelClass}>
              {t("competition.sport")}
            </label>
            <select
              id="competition-sport"
              name="sport"
              defaultValue={competition.sport}
              disabled={sportLocked}
              className={inputClass}
            >
              <option value="football">{t("competition.football")}</option>
              <option value="tennis">{t("competition.tennis")}</option>
            </select>
            {sportLocked ? (
              <p className="mt-1 text-[10px] font-semibold text-clay">
                {cancelled
                  ? t("compLifecycle.mutationsBlocked")
                  : t("compAdmin.sportLocked")}
              </p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="competition-duration"
              className={labelClass}
            >
              {t("competition.defaultDuration")}
            </label>
            <input
              id="competition-duration"
              name="defaultMatchDurationMinutes"
              type="number"
              min={1}
              max={600}
              defaultValue={competition.defaultMatchDurationMinutes}
              disabled={durationLocked}
              className={inputClass}
            />
            {state.fieldErrors?.defaultMatchDurationMinutes ? (
              <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                {t("compAdmin.durationInvalid")}
              </p>
            ) : durationLocked && !cancelled ? (
              <p className="mt-1 text-[10px] font-semibold text-clay">
                {t("compAdmin.configurationLocked")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="birth-date-from" className={labelClass}>
              {t("compAdmin.birthDateFrom")}
            </label>
            <input
              id="birth-date-from"
              name="birthDateFrom"
              type="date"
              defaultValue={competition.birthDateFrom ?? ""}
              disabled={eligibilityLocked}
              className={inputClass}
            />
            {state.fieldErrors?.birthDateFrom ? (
              <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                {t("compAdmin.dateInvalid")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="birth-date-to" className={labelClass}>
              {t("compAdmin.birthDateTo")}
            </label>
            <input
              id="birth-date-to"
              name="birthDateTo"
              type="date"
              defaultValue={competition.birthDateTo ?? ""}
              disabled={eligibilityLocked}
              className={inputClass}
            />
            {state.fieldErrors?.birthDateTo ? (
              <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                {state.fieldErrors.birthDateTo === "before_from"
                  ? t("compAdmin.dateRangeInvalid")
                  : t("compAdmin.dateInvalid")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="roster-min" className={labelClass}>
              {t("compAdmin.rosterMin")}
            </label>
            <input
              id="roster-min"
              name="rosterMin"
              type="number"
              min={1}
              max={99}
              defaultValue={competition.rosterMin ?? ""}
              disabled={eligibilityLocked}
              className={inputClass}
            />
            {state.fieldErrors?.rosterMin ? (
              <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                {t("compAdmin.rosterInvalid")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="roster-max" className={labelClass}>
              {t("compAdmin.rosterMax")}
            </label>
            <input
              id="roster-max"
              name="rosterMax"
              type="number"
              min={1}
              max={99}
              defaultValue={competition.rosterMax ?? ""}
              disabled={eligibilityLocked}
              className={inputClass}
            />
            {state.fieldErrors?.rosterMax ? (
              <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                {state.fieldErrors.rosterMax === "before_min"
                  ? t("compAdmin.rosterRangeInvalid")
                  : t("compAdmin.rosterInvalid")}
              </p>
            ) : null}
          </div>
        </div>

        {eligibilityLocked && !cancelled ? (
          <p className="rounded-lg bg-soft-orange px-2.5 py-1.5 text-[11px] font-bold text-clay">
            {t("compAdmin.eligibilityLocked")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton
            label={t("compAdmin.saveConfiguration")}
            pendingLabel={t("common.loading")}
            tone="dark"
            disabled={cancelled}
          />
          <span className="text-[11px] font-semibold text-muted">
            {t("compAdmin.configHint")}
          </span>
        </div>
      </form>
      <CompetitionAdminFeedback state={state} />
    </section>
  );
}

function DeadlineEditor({ data }: { data: AdminCompetitionData }) {
  const { t } = useI18n();
  const [state, action] = useActionState(deadlineAction, EMPTY_STATE);
  const cancelled = data.competition.status === "cancelled";

  return (
    <section id="deadline" className="surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft-green text-green">
          <CalendarIcon className="size-4" />
        </span>
        <div>
          <h2 className="display-title text-2xl">
            {t("compAdmin.deadlineTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("compAdmin.deadlineBody").replace(
              "{timezone}",
              data.event.timezone,
            )}
          </p>
        </div>
      </div>

      <form
        key={state.status === "success" ? state.code : "deadline-form"}
        action={action}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="eventId" value={data.event.id} />
        <input type="hidden" name="competitionId" value={data.competition.id} />
        <input type="hidden" name="intent" value="save" />
        <div>
          <label
            htmlFor="registration-deadline"
            className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
          >
            {t("compAdmin.deadlineLabel").replace(
              "{timezone}",
              data.event.timezone,
            )}
          </label>
          <input
            id="registration-deadline"
            name="deadline"
            type="datetime-local"
            defaultValue={data.competition.registrationDeadlineInput ?? ""}
            disabled={cancelled}
            className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
          />
          {state.fieldErrors?.deadline ? (
            <p role="alert" className="mt-1 text-xs font-bold text-red-700">
              {t("compAdmin.deadlineInvalid")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton
            label={t("compAdmin.saveDeadline")}
            pendingLabel={t("common.loading")}
            tone="dark"
            disabled={cancelled}
          />
          <span className="text-[11px] font-semibold text-muted">
            {t("compAdmin.deadlineHint")}
          </span>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        <form action={action}>
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="competitionId" value={data.competition.id} />
          <input type="hidden" name="intent" value="extend" />
          <SubmitButton
            label={t("compAdmin.extendSevenDays")}
            pendingLabel={t("common.loading")}
            tone="quiet"
            disabled={cancelled}
          />
        </form>
        <form action={action}>
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="competitionId" value={data.competition.id} />
          <input type="hidden" name="intent" value="clear" />
          <SubmitButton
            label={t("compAdmin.clearDeadline")}
            pendingLabel={t("common.loading")}
            tone="quiet"
            disabled={cancelled}
          />
        </form>
      </div>
      <CompetitionAdminFeedback state={state} />
    </section>
  );
}

function statusKey(status: string): DictionaryKey {
  switch (status) {
    case "ok":
      return "compAdmin.statusOk";
    case "empty":
      return "compAdmin.statusEmpty";
    case "below_min":
      return "compAdmin.statusBelowMin";
    case "above_max":
      return "compAdmin.statusAboveMax";
    case "birth_range":
      return "compAdmin.statusBirthRange";
    default:
      return "compAdmin.statusIssue";
  }
}

export function CompetitionAdminView({
  data,
  user,
  demoAccounts,
  demoMode,
  lifecycle,
}: {
  data: AdminCompetitionData;
  user: { name: string | null; email: string | null };
  demoAccounts: DemoAccount[];
  demoMode: boolean;
  lifecycle: CompetitionLifecycleEvent[];
}) {
  const { t, formatDate, seedText } = useI18n();
  const competition = data.competition;
  const cancelled = competition.status === "cancelled";
  const effectiveRegistrationOpen =
    competition.registrationOpen && !cancelled;
  const formatLabel = t(`format.${competition.format}` as DictionaryKey);
  const qualifyingPlaces =
    competition.format === "groups_knockout"
      ? competition.qualifiersPerGroup
      : 0;
  const birthRange =
    competition.birthDateFrom || competition.birthDateTo
      ? t("competition.birthRange")
          .replace(
            "{from}",
            competition.birthDateFrom
              ? formatDate(competition.birthDateFrom, "UTC", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—",
          )
          .replace(
            "{to}",
            competition.birthDateTo
              ? formatDate(competition.birthDateTo, "UTC", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "—",
          )
      : t("compAdmin.noBirthRange");

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}/competitions/${competition.slug}`}
        secondaryHref={`/admin/events/${data.event.id}`}
        secondaryLabel={t("compAdmin.backToEvent")}
      />

      <main id="main-content" className="page-shell py-6 sm:py-8">
        <Link
          href={`/admin/events/${data.event.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("compAdmin.backToEvent")}
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <SportTag sport={competition.sport} />
              <CompetitionStatusBadge
                status={competition.status}
                registrationState={
                  effectiveRegistrationOpen ? "open" : "closed"
                }
              />
            </div>
            <h1 className="display-title mt-3 text-4xl sm:text-5xl">
              {seedText(competition.name)}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {seedText(competition.description) ?? t("compAdmin.body")}
            </p>
            <p className="mt-1 text-xs font-bold text-muted">
              {data.event.name} · {formatLabel}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/events/${data.event.id}/teams`}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink hover:border-green hover:text-green"
            >
              <UsersIcon className="size-3.5" />
              {t("compAdmin.manageTeams")}
            </Link>
            <Link
              href={`/events/${data.event.slug}/competitions/${competition.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink hover:border-green hover:text-green"
            >
              {t("admin.viewPublicPage")}
              <ArrowUpRightIcon className="size-3.5" />
            </Link>
          </div>
        </header>

        {cancelled ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:p-5"
          >
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-clay">
              {t("compLifecycle.cancelledTitle")}
            </p>
            <p className="mt-1 font-extrabold">
              {t("compLifecycle.bannerBody")}
            </p>
            {competition.publicNote ? (
              <p className="mt-2 leading-6">
                <span className="font-extrabold">
                  {t("competition.publicNote")}:
                </span>{" "}
                {competition.publicNote}
              </p>
            ) : null}
            <a
              href="#lifecycle"
              className="mt-3 inline-flex text-xs font-extrabold text-red-800 underline decoration-2 underline-offset-4"
            >
              {t("compLifecycle.restoreAction")}
            </a>
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t("compAdmin.statEntrants"), data.counts.entrants],
            [t("compAdmin.statParticipants"), data.counts.participants],
            [t("compAdmin.statEligible"), data.counts.eligibleEntrants],
            [
              t("compAdmin.statRegistration"),
              effectiveRegistrationOpen
                ? t("compAdmin.openShort")
                : t("compAdmin.closedShort"),
            ],
          ].map(([label, value]) => (
            <div key={String(label)} className="surface p-4">
              <div className="display-title text-3xl">{value}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 space-y-5">
            <RegistrationStateCard data={data} />

            <ConfigurationEditor data={data} />

            <DrawAdminPanel data={data} />

            {data.standings.length ? (
              <section className="surface p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="eyebrow text-green">
                      {t("compAdmin.standingsEyebrow")}
                    </p>
                    <h2 className="display-title mt-2 text-3xl">
                      {competition.format === "round_robin"
                        ? t("competition.leagueTable")
                        : t("compAdmin.standingsTitle")}
                    </h2>
                  </div>
                  <Link
                    href={`/events/${data.event.slug}/standings?competition=${competition.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-green hover:underline"
                  >
                    {t("standings.viewFull")}
                    <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t("compAdmin.standingsBody")}
                </p>
                <div className="mt-5 grid gap-7 lg:grid-cols-2">
                  {data.standings.map((group) => (
                    <StandingsTable
                      key={group.id}
                      group={group}
                      sport={competition.sport}
                      qualifiersPerGroup={qualifyingPlaces}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            <section className="surface p-5 sm:p-6">
              <p className="eyebrow text-green">{t("compAdmin.rulesEyebrow")}</p>
              <h2 className="display-title mt-2 text-3xl">
                {t("compAdmin.rulesTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {seedText(competition.eligibilityNotes) ?? t("compAdmin.rulesBody")}
              </p>

              <dl className="mt-5 grid gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
                {[
                  [t("competition.format"), formatLabel],
                  [
                    t("competition.rosterLimits"),
                    competition.sport === "tennis"
                      ? t("competition.singleEntry")
                      : competition.rosterMin != null &&
                          competition.rosterMax != null
                        ? t("competition.rosterLimitValue")
                            .replace("{min}", String(competition.rosterMin))
                            .replace("{max}", String(competition.rosterMax))
                        : "—",
                  ],
                  [t("competition.birthRangeLabel"), birthRange],
                  ...(competition.format === "groups_knockout"
                    ? [
                        [
                          t("competition.qualifiers"),
                          t("competition.qualifiersValue").replace(
                            "{count}",
                            String(competition.qualifiersPerGroup),
                          ),
                        ],
                      ]
                    : []),
                  [
                    t("competition.defaultDuration"),
                    `${competition.defaultMatchDurationMinutes} ${t("common.minutes")}`,
                  ],
                  [
                    t("competition.drawSeed"),
                    competition.drawSeed ?? t("compAdmin.notSet"),
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="eyebrow text-green">{t("compAdmin.entrantsEyebrow")}</p>
                  <h2 className="display-title mt-2 text-3xl">
                    {t("compAdmin.entrantsTitle")}
                  </h2>
                </div>
                <span className="text-xs font-extrabold text-muted">
                  {t("compAdmin.eligibleCount").replace(
                    "{eligible}",
                    String(data.counts.eligibleEntrants),
                  ).replace("{total}", String(data.counts.entrants))}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t("compAdmin.entrantsBody")}
              </p>

              <div
                className="mt-4 overflow-x-auto"
                role="region"
                aria-label={t("compAdmin.entrantsTitle")}
                tabIndex={0}
              >
                <table className="w-full min-w-[620px] text-left text-xs">
                  <caption className="sr-only">
                    {seedText(competition.name)} — {t("compAdmin.entrantsTitle")}
                  </caption>
                  <thead>
                    <tr className="border-b border-line bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
                      <th scope="col" className="px-3 py-2.5 font-extrabold">
                        {t("compAdmin.entrant")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-extrabold">
                        {t("compAdmin.roster")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-extrabold">
                        {t("compAdmin.managers")}
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-extrabold">
                        {t("compAdmin.eligibility")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entrants.map((entrant) => (
                      <tr key={entrant.id} className="border-b border-line/70 last:border-b-0">
                        <td className="px-3 py-2.5 font-extrabold">{entrant.name}</td>
                        <td className="px-3 py-2.5 text-muted">
                          {entrant.participantCount}
                          {competition.rosterMin != null &&
                          competition.rosterMax != null
                            ? ` / ${competition.rosterMin}–${competition.rosterMax}`
                            : ""}
                        </td>
                        <td className="px-3 py-2.5 text-muted">
                          {entrant.managerNames.length
                            ? entrant.managerNames.join(", ")
                            : t("compAdmin.noManagers")}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${
                              entrant.rosterStatus === "ok"
                                ? "bg-soft-green text-green"
                                : "bg-soft-orange text-clay"
                            }`}
                          >
                            {t(statusKey(entrant.rosterStatus))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.entrants.length ? (
                <p className="mt-4 rounded-xl bg-cream p-4 text-sm font-semibold text-muted">
                  {t("compAdmin.noEntrants")}
                </p>
              ) : null}
            </section>
          </div>

          <div className="min-w-0 space-y-5">
            <CompetitionLifecyclePanel
              eventId={data.event.id}
              competitionId={competition.id}
              competitionName={seedText(competition.name) ?? competition.name}
              status={competition.status}
              publicNote={competition.publicNote}
              cancelledAt={competition.cancelledAt}
              timezone={data.event.timezone}
              history={lifecycle}
            />

            <DeadlineEditor data={data} />

            {demoMode ? (
              <section className="rounded-[1.25rem] bg-ink p-5 text-white">
                <p className="eyebrow text-lime">{t("compAdmin.demoTitle")}</p>
                <p className="mt-2 text-[11px] leading-5 text-white/60">
                  {t("compAdmin.demoBody")}
                </p>
                <form action={switchDemoAccount} className="mt-4">
                  <input
                    type="hidden"
                    name="callbackUrl"
                    value={`/admin/events/${data.event.id}/competitions/${competition.id}`}
                  />
                  <label
                    htmlFor="competition-demo-account"
                    className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50"
                  >
                    {t("admin.switchAccount")}
                  </label>
                  <select
                    id="competition-demo-account"
                    name="email"
                    defaultValue={
                      demoAccounts.find((account) => account.email === user.email)
                        ?.email ??
                      demoAccounts[0]?.email ??
                      ""
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-lime"
                  >
                    {demoAccounts.map((account) => (
                      <option key={account.id} value={account.email} className="text-ink">
                        {account.name} ·{" "}
                        {account.role === "owner" ? t("auth.owner") : account.detail}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-xl bg-lime px-3 py-2 text-xs font-extrabold text-ink hover:bg-white"
                  >
                    {t("admin.switchAccountAction")}
                  </button>
                </form>
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-lime hover:underline"
                >
                  <MailIcon className="size-3.5" />
                  {t("compAdmin.mailpit")}
                </a>
              </section>
            ) : null}

            <section className="surface p-5">
              <p className="eyebrow text-green">{t("compAdmin.lifecycleEyebrow")}</p>
              <h2 className="display-title mt-2 text-2xl">
                {t("compAdmin.lifecycleTitle")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t("compAdmin.lifecycleBody")}
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
                <LockIcon className="size-3" />
                {competition.drawGeneratedAt
                  ? t("compAdmin.generated")
                  : t("compAdmin.notGenerated")}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
