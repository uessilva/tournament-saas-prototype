"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { AppTopBar } from "@/components/app-top-bar";
import { MatchCancellationPanel } from "@/components/admin/match-cancellation-panel";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
} from "@/components/icons";
import { MatchStatusBadge, SportTag } from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import { formatTimeZoneLabel } from "@/lib/timezone";
import {
  createVenueAction,
  updateEventTimezoneAction,
  updateMatchScheduleAction,
  type ScheduleActionState,
  type ScheduleConflictView,
} from "@/features/matches/schedule-actions";
import { matchRoundLabel, matchSideName } from "@/features/public/labels";
import type {
  ScheduleMatch,
  ScheduleVenue,
  ScheduleWorkspaceData,
} from "@/features/matches/types";

const EMPTY_STATE: ScheduleActionState = { status: "idle" };

const fieldErrorKeys: Record<string, DictionaryKey> = {
  fix_errors: "schedule.fixErrors",
  invalid_timezone: "schedule.timezoneInvalid",
  timezone_conversion_failed: "schedule.timezoneInvalid",
  team_conflict: "schedule.errorTeamOverlap",
  venue_conflict: "schedule.errorVenueOverlap",
  venue_name_invalid: "schedule.venueNameInvalid",
  venue_exists: "schedule.venueExists",
  competition_cancelled: "compLifecycle.mutationsBlocked",
  match_cancelled: "matchCancel.cancelledTitle",
};

function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
  name,
  value,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "quiet";
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "quiet"
      ? "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[11px] font-extrabold text-muted transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex items-center justify-center gap-1.5 rounded-xl bg-green px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green-deep disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      className={className}
    >
      {pending ? pendingLabel : label}
      {pending ? null : name === "intent" ? null : (
        <ArrowRightIcon className="size-3.5" />
      )}
    </button>
  );
}

function Feedback({ state }: { state: ScheduleActionState }) {
  const { t } = useI18n();
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    const key = fieldErrorKeys[state.code ?? ""];
    return (
      <p role="alert" className="mt-2 text-xs font-bold text-red-700">
        {t(key ?? "schedule.actionFailed")}
      </p>
    );
  }

  const keys: Partial<Record<string, DictionaryKey>> = {
    venue_created: "schedule.venueCreated",
    match_scheduled: "schedule.saved",
    match_unscheduled: "schedule.cleared",
    timezone_updated: "schedule.timezoneSaved",
    timezone_unchanged: "schedule.timezoneUnchanged",
  };

  return (
    <p
      role="status"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-soft-green px-2.5 py-1.5 text-[11px] font-extrabold text-green"
    >
      <CheckIcon className="size-3.5" />
      {t(keys[state.code ?? ""] ?? "schedule.saved")}
    </p>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | null;
}) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="mt-1 text-[11px] font-bold text-red-700">
      {message}
    </p>
  );
}

function ConflictList({
  id,
  conflicts,
  timezone,
}: {
  id: string;
  conflicts: ScheduleConflictView[];
  timezone: string;
}) {
  const { t, message, formatDateTime, formatTime } = useI18n();

  return (
    <div
      id={id}
      role="alert"
      className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
    >
      <p className="font-extrabold">{t("schedule.conflictsTitle")}</p>
      <ul className="mt-2 space-y-1.5">
        {conflicts.map((conflict, index) => {
          const start = formatDateTime(conflict.otherStartsAt, timezone);
          const end = formatTime(conflict.otherEndsAt, timezone);
          return (
            <li key={`${conflict.kind}-${conflict.otherMatchNumber}-${index}`}>
              {conflict.kind === "team"
                ? message(t("schedule.conflictTeam"), {
                    team: conflict.teamNames.join(", "),
                    match: String(conflict.otherMatchNumber),
                    competition: conflict.otherCompetitionName,
                    start,
                    end,
                  })
                : message(t("schedule.conflictVenue"), {
                    venue: conflict.venueName ?? "",
                    match: String(conflict.otherMatchNumber),
                    competition: conflict.otherCompetitionName,
                    start,
                    end,
                  })}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 font-bold">{t("schedule.conflictHelp")}</p>
    </div>
  );
}

function MatchScheduleCard({
  match,
  eventId,
  eventSlug,
  timezone,
  venues,
  defaultDurationMinutes,
  competitionStatus,
}: {
  match: ScheduleMatch;
  eventId: string;
  eventSlug: string;
  timezone: string;
  venues: ScheduleVenue[];
  defaultDurationMinutes: number;
  competitionStatus: string;
}) {
  const { t } = useI18n();
  const competitionCancelled = competitionStatus === "cancelled";
  const formLocked =
    competitionCancelled || match.status === "cancelled";
  const [state, action] = useActionState(
    updateMatchScheduleAction,
    EMPTY_STATE,
  );
  const draft = state.draft;
  const startError = state.fieldErrors?.startsAt;
  const venueError = state.fieldErrors?.venueId;
  const durationError = state.fieldErrors?.durationMinutes;
  const startErrorId = `match-${match.id}-start-error`;
  const venueErrorId = `match-${match.id}-venue-error`;
  const durationErrorId = `match-${match.id}-duration-error`;
  const conflictId = `match-${match.id}-conflicts`;
  const describedBy = [
    startError ? startErrorId : null,
    state.conflicts?.length ? conflictId : null,
  ]
    .filter(Boolean)
    .join(" ");

  const homeName = matchSideName(
    match.homeTeamName,
    match.homeSource,
    match.knockoutRoundCount,
    t,
  );
  const awayName = matchSideName(
    match.awayTeamName,
    match.awaySource,
    match.knockoutRoundCount,
    t,
  );

  return (
    <article className="border-t border-line/80 px-4 py-5 first:border-t-0 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
            <SportTag sport={match.sport} />
            <span>
              {t("schedule.matchNumber").replace(
                "{number}",
                String(match.matchNumber),
              )}
            </span>
            <span className="text-line">·</span>
            <span>{matchRoundLabel(match, t)}</span>
            {match.status === "cancelled" ? (
              <MatchStatusBadge status="cancelled" />
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-extrabold">
            <span className={match.homeTeamName ? "" : "text-muted"}>
              {homeName}
            </span>{" "}
            <span className="text-xs font-bold text-muted">
              {t("match.vs")}
            </span>{" "}
            <span className={match.awayTeamName ? "" : "text-muted"}>
              {awayName}
            </span>
          </h3>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
            match.startsAt
              ? "bg-soft-green text-green"
              : "bg-cream text-muted"
          }`}
        >
          <ClockIcon className="size-3" />
          {match.startsAt
            ? t("schedule.scheduledBadge")
            : t("schedule.unscheduledBadge")}
        </span>
      </div>

      <form
        key={
          draft
            ? `draft-${draft.startsAt}-${draft.venueId}-${draft.durationMinutes}`
            : `${match.startsAtInput ?? "none"}-${match.venueId ?? "none"}-${match.durationOverrideMinutes ?? "default"}`
        }
        action={action}
        className="mt-4"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="matchId" value={match.id} />
        <div className="grid gap-3 lg:grid-cols-[1.25fr_1fr_0.8fr]">
          <div>
            <label
              htmlFor={`match-${match.id}-start`}
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              {t("schedule.startLabel").replace("{timezone}", timezone)}
            </label>
            <input
              id={`match-${match.id}-start`}
              name="startsAt"
              type="datetime-local"
              defaultValue={draft?.startsAt ?? match.startsAtInput ?? ""}
              disabled={formLocked}
              aria-invalid={Boolean(startError)}
              aria-describedby={describedBy || undefined}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <p className="mt-1 text-[10px] font-medium text-muted">
              {t("schedule.startHint")}
            </p>
            <FieldError
              id={startErrorId}
              message={startError ? t(fieldErrorKeys[startError] ?? "schedule.errorInvalidStart") : null}
            />
          </div>

          <div>
            <label
              htmlFor={`match-${match.id}-venue`}
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              {t("schedule.venueLabel")}
            </label>
            <select
              id={`match-${match.id}-venue`}
              name="venueId"
              defaultValue={draft?.venueId ?? match.venueId ?? ""}
              disabled={formLocked}
              aria-invalid={Boolean(venueError)}
              aria-describedby={
                [
                  venueError ? venueErrorId : null,
                  state.conflicts?.length ? conflictId : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none"
            >
              <option value="">{t("schedule.venueNone")}</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>
            <FieldError
              id={venueErrorId}
              message={venueError ? t(fieldErrorKeys[venueError] ?? "schedule.errorInvalidVenue") : null}
            />
          </div>

          <div>
            <label
              htmlFor={`match-${match.id}-duration`}
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              {t("schedule.durationLabel")}
            </label>
            <input
              id={`match-${match.id}-duration`}
              name="durationMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              step={1}
              defaultValue={
                draft?.durationMinutes ??
                (match.durationOverrideMinutes ?? "")
              }
              disabled={formLocked}
              placeholder={t("schedule.durationPlaceholder").replace(
                "{minutes}",
                String(defaultDurationMinutes),
              )}
              aria-invalid={Boolean(durationError)}
              aria-describedby={durationError ? durationErrorId : undefined}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none"
            />
            <p className="mt-1 text-[10px] font-medium text-muted">
              {t("schedule.durationHint").replace(
                "{minutes}",
                String(defaultDurationMinutes),
              )}
            </p>
            <FieldError
              id={durationErrorId}
              message={
                durationError
                  ? t(
                      fieldErrorKeys[durationError] ??
                        "schedule.errorInvalidDuration",
                    )
                  : null
              }
            />
          </div>
        </div>

        {state.conflicts?.length ? (
          <ConflictList
            id={conflictId}
            conflicts={state.conflicts}
            timezone={timezone}
          />
        ) : null}

        {state.status === "error" && state.code !== "schedule_conflict" ? (
          <Feedback state={state} />
        ) : null}
        {state.status === "success" ? <Feedback state={state} /> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SubmitButton
            label={t("schedule.save")}
            pendingLabel={t("schedule.saving")}
            disabled={formLocked}
          />
          {match.startsAt ? (
            <SubmitButton
              label={t("schedule.clearTime")}
              pendingLabel={t("schedule.saving")}
              tone="quiet"
              name="intent"
              value="clear"
              disabled={formLocked}
            />
          ) : null}
          <Link
            href={`/events/${eventSlug}/fixtures?competition=${match.competitionSlug}`}
            className="inline-flex items-center gap-1 px-2 py-2 text-[11px] font-extrabold text-muted hover:text-green"
          >
            {t("schedule.viewPublicFixtures")}
            <ArrowUpRightIcon className="size-3" />
          </Link>
        </div>
      </form>

      <MatchCancellationPanel
        eventId={eventId}
        matchId={match.id}
        matchStatus={match.status}
        cancellationReason={match.cancellationReason}
        competitionCancelled={competitionCancelled}
        compact
      />
    </article>
  );
}

function VenuePanel({
  data,
  usedByVenue,
}: {
  data: ScheduleWorkspaceData;
  usedByVenue: Map<string, number>;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(createVenueAction, EMPTY_STATE);
  const nameError = state.fieldErrors?.name;

  return (
    <section className="surface p-5 sm:p-6">
      <p className="eyebrow text-green">{t("schedule.venuesEyebrow")}</p>
      <h2 className="display-title mt-2 text-2xl">
        {t("schedule.venuesTitle")}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        {t("schedule.venuesBody")}
      </p>

      <form
        key={state.venueId ?? "venue-form"}
        action={action}
        className="mt-4"
      >
        <input type="hidden" name="eventId" value={data.event.id} />
        <label
          htmlFor="venue-name"
          className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
        >
          {t("schedule.venueName")}
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            id="venue-name"
            name="name"
            type="text"
            maxLength={60}
            placeholder={t("schedule.venuePlaceholder")}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "venue-name-error" : undefined}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            <PlusIcon className="size-3.5" />
            {t("schedule.createVenue")}
          </button>
        </div>
        <FieldError
          id="venue-name-error"
          message={
            nameError
              ? t(fieldErrorKeys[nameError] ?? "schedule.venueNameInvalid")
              : null
          }
        />
        <Feedback state={state} />
      </form>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
          {t("schedule.venueListTitle")}
        </h3>
        {data.venues.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.venues.map((venue) => (
              <li
                key={venue.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-bold"
              >
                <MapPinIcon className="size-3 text-green" />
                {venue.name}
                <span className="text-[10px] font-extrabold text-muted">
                  {t("schedule.venueUsage").replace(
                    "{count}",
                    String(usedByVenue.get(venue.id) ?? 0),
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs leading-5 text-muted">
            {t("schedule.noVenues")}
          </p>
        )}
      </div>
    </section>
  );
}

function TimezonePanel({ data }: { data: ScheduleWorkspaceData }) {
  const { t } = useI18n();
  const [state, action] = useActionState(
    updateEventTimezoneAction,
    EMPTY_STATE,
  );
  const timezoneError = state.fieldErrors?.timezone;
  const zones = data.timezones.includes(data.event.timezone)
    ? data.timezones
    : [data.event.timezone, ...data.timezones];

  return (
    <section className="surface p-5 sm:p-6">
      <p className="eyebrow text-green">{t("schedule.timezoneEyebrow")}</p>
      <h2 className="display-title mt-2 text-2xl">
        {t("schedule.timezoneTitle")}
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-muted">
        {t("schedule.timezoneBody")}
      </p>

      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-paper px-2.5 py-1.5 text-[11px] font-bold text-muted">
        <ClockIcon className="size-3.5" />
        {t("schedule.timezoneCurrent")}:{" "}
        {formatTimeZoneLabel(data.event.timezone)}
      </p>

      <form key={data.event.timezone} action={action} className="mt-4">
        <input type="hidden" name="eventId" value={data.event.id} />
        <label
          htmlFor="event-timezone"
          className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
        >
          {t("schedule.timezoneLabel")}
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <select
            id="event-timezone"
            name="timezone"
            defaultValue={data.event.timezone}
            aria-invalid={Boolean(timezoneError)}
            aria-describedby={
              timezoneError ? "event-timezone-error" : undefined
            }
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            {t("schedule.timezoneSave")}
            <ArrowRightIcon className="size-3.5" />
          </button>
        </div>
        <FieldError
          id="event-timezone-error"
          message={
            timezoneError
              ? t(
                  fieldErrorKeys[timezoneError] ??
                    "schedule.timezoneInvalid",
                )
              : null
          }
        />
        <Feedback state={state} />
      </form>
    </section>
  );
}

export function ScheduleView({
  data,
  user,
}: {
  data: ScheduleWorkspaceData;
  user: { name: string | null; email: string | null };
}) {
  const { t } = useI18n();
  const scheduledCount = data.matches.filter(
    (match) => match.startsAt != null,
  ).length;
  const usedByVenue = new Map<string, number>();
  for (const match of data.matches) {
    if (!match.venueId) {
      continue;
    }
    usedByVenue.set(
      match.venueId,
      (usedByVenue.get(match.venueId) ?? 0) + 1,
    );
  }

  const competitionGroups = data.competitions
    .map((competition) => ({
      competition,
      matches: data.matches
        .filter((match) => match.competitionId === competition.id)
        .sort(
          (a, b) =>
            (a.startsAt ? 0 : 1) - (b.startsAt ? 0 : 1) ||
            (a.startsAt ?? "").localeCompare(b.startsAt ?? "") ||
            a.matchNumber - b.matchNumber,
        ),
    }))
    .filter((group) => group.matches.length > 0);

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}/fixtures`}
      />

      <main id="main-content" className="page-shell py-8">
        <Link
          href={`/admin/events/${data.event.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("schedule.backToEvent")}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("schedule.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("schedule.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("schedule.body")}
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
              <CalendarIcon className="size-3.5" />
              {data.event.name}
              <span className="text-line">·</span>
              <ClockIcon className="size-3.5" />
              {formatTimeZoneLabel(data.event.timezone)}
            </p>
          </div>
          <Link
            href={`/events/${data.event.slug}/fixtures`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            {t("schedule.publicFixtures")}
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </div>

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t("schedule.statMatches"), data.matches.length],
            [t("schedule.statScheduled"), scheduledCount],
            [
              t("schedule.statUnscheduled"),
              data.matches.length - scheduledCount,
            ],
            [t("schedule.statVenues"), data.venues.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="surface p-4">
              <div className="display-title text-3xl">{value}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-5">
            <section className="surface overflow-hidden">
              <div className="border-b border-line p-5 sm:p-6">
                <p className="eyebrow text-green">
                  {t("schedule.matchesEyebrow")}
                </p>
                <h2 className="display-title mt-2 text-2xl">
                  {t("schedule.matchesTitle")}
                </h2>
                <p className="mt-1.5 text-xs leading-5 text-muted">
                  {t("schedule.matchesBody")}
                </p>
              </div>

              {competitionGroups.length ? (
                competitionGroups.map(({ competition, matches }) => (
                  <div key={competition.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-paper px-4 py-3 sm:px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <SportTag sport={competition.sport} />
                        <h3 className="text-sm font-extrabold">
                          {competition.name}
                        </h3>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                        {t("schedule.competitionDefaults")
                          .replace(
                            "{scheduled}",
                            String(competition.scheduledCount),
                          )
                          .replace(
                            "{total}",
                            String(competition.matchCount),
                          )
                          .replace(
                            "{minutes}",
                            String(competition.defaultMatchDurationMinutes),
                          )}
                      </span>
                      {competition.status === "cancelled" ? (
                        <p className="basis-full rounded-lg bg-red-50 px-3 py-2 text-[11px] font-bold text-red-700">
                          {t("compLifecycle.competitionCancelledSchedule")}
                          {competition.publicNote
                            ? ` ${t("competition.publicNote")}: ${competition.publicNote}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    {matches.map((match) => (
                      <MatchScheduleCard
                        key={match.id}
                        match={match}
                        eventId={data.event.id}
                        eventSlug={data.event.slug}
                        timezone={data.event.timezone}
                        venues={data.venues}
                        defaultDurationMinutes={
                          competition.defaultMatchDurationMinutes
                        }
                        competitionStatus={competition.status}
                      />
                    ))}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <h3 className="display-title text-2xl">
                    {t("schedule.noMatchesTitle")}
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                    {t("schedule.noMatchesBody")}
                  </p>
                  <Link
                    href={`/admin/events/${data.event.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white hover:bg-green"
                  >
                    {t("schedule.backToEvent")}
                    <ArrowRightIcon className="size-3.5" />
                  </Link>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <VenuePanel data={data} usedByVenue={usedByVenue} />
            <TimezonePanel data={data} />
          </aside>
        </div>
      </main>
    </div>
  );
}
