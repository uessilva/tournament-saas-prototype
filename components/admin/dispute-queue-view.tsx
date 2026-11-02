"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  CheckIcon,
  LockIcon,
  TrophyIcon,
} from "@/components/icons";
import { SportTag } from "@/components/public/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type {
  DisputeCorrectionOption,
  DisputeRecord,
  EventDisputesData,
} from "@/features/disputes/queries";
import {
  resolveDisputeAction,
  type DisputeActionState,
} from "@/features/disputes/actions";

const EMPTY: DisputeActionState = { status: "idle" };

function statusTone(status: DisputeRecord["status"]) {
  if (status === "open") return "bg-soft-orange text-clay";
  if (status === "resolved") return "bg-soft-green text-green";
  return "bg-cream text-muted";
}

function MatchLine({ dispute, timezone }: { dispute: DisputeRecord; timezone: string }) {
  const { t, formatDateTime, seedText } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
      <SportTag sport={dispute.sport} />
      <span>#{dispute.matchNumber}</span>
      <span>{seedText(dispute.competitionName)}</span>
      {dispute.matchStartsAt ? (
        <span className="normal-case tracking-normal">
          {formatDateTime(dispute.matchStartsAt, timezone)}
        </span>
      ) : null}
      <span className="normal-case tracking-normal text-ink">
        {dispute.homeTeamName ?? t("match.tbd")}
        <span className="px-1 text-muted">{t("match.vs")}</span>
        {dispute.awayTeamName ?? t("match.tbd")}
      </span>
    </div>
  );
}

function ResolutionForm({
  dispute,
  options,
  eventId,
}: {
  dispute: DisputeRecord;
  options: DisputeCorrectionOption[];
  eventId: string;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(resolveDisputeAction, EMPTY);

  return (
    <form action={action} className="mt-4 rounded-xl border border-line bg-paper/70 p-3">
      <input type="hidden" name="disputeId" value={dispute.id} />
      <input type="hidden" name="eventId" value={eventId} />

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label
            htmlFor={`resolution-${dispute.id}`}
            className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("disputes.owner.resolutionLabel")}
          </label>
          <select
            id={`resolution-${dispute.id}`}
            name="resolution"
            required
            defaultValue="resolved"
            className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-green"
          >
            <option value="resolved">{t("disputes.status.resolved")}</option>
            <option value="dismissed">{t("disputes.status.dismissed")}</option>
          </select>
        </div>

        <div>
          <label
            htmlFor={`response-${dispute.id}`}
            className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("disputes.owner.responseLabel")}
          </label>
          <textarea
            id={`response-${dispute.id}`}
            name="response"
            required
            minLength={10}
            maxLength={4000}
            rows={3}
            aria-describedby={`response-hint-${dispute.id}${
              state.fieldErrors?.response ? ` response-error-${dispute.id}` : ""
            }`}
            aria-invalid={state.fieldErrors?.response ? true : undefined}
            className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs leading-5 text-ink outline-none focus:border-green"
            placeholder={t("disputes.owner.responsePlaceholder")}
          />
          <p id={`response-hint-${dispute.id}`} className="mt-1 text-[10px] font-medium text-muted">
            {t("disputes.owner.responseHint")}
          </p>
          {state.fieldErrors?.response ? (
            <p
              id={`response-error-${dispute.id}`}
              role="alert"
              className="mt-1 text-[10px] font-bold text-red-700"
            >
              {t(`disputes.error.${state.fieldErrors.response}` as DictionaryKey)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3">
        {options.length ? (
          <>
            <label
              htmlFor={`correction-${dispute.id}`}
              className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
            >
              {t("disputes.owner.correctionLabel")}
            </label>
            <select
              id={`correction-${dispute.id}`}
              name="correctionResultVersionId"
              defaultValue=""
              aria-describedby={`correction-hint-${dispute.id}`}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-green"
            >
              <option value="">{t("disputes.owner.correctionNone")}</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {t("disputes.owner.correctionOption")
                    .replace("{version}", String(option.version))
                    .replace("{reason}", option.reason)}
                </option>
              ))}
            </select>
            <p id={`correction-hint-${dispute.id}`} className="mt-1 text-[10px] font-medium text-muted">
              {t("disputes.owner.correctionHint")}
            </p>
            {state.fieldErrors?.correctionResultVersionId ? (
              <p role="alert" className="mt-1 text-[10px] font-bold text-red-700">
                {t(
                  `disputes.error.${state.fieldErrors.correctionResultVersionId}` as DictionaryKey,
                )}
              </p>
            ) : null}
          </>
        ) : (
          <p className="rounded-lg bg-cream/70 px-3 py-2 text-[10px] font-semibold leading-4 text-muted">
            {t("disputes.owner.correctionUnavailable")}
          </p>
        )}
      </div>

      {state.status === "error" && state.code !== "invalid_input" ? (
        <p role="alert" className="mt-2 text-[10px] font-bold text-red-700">
          {t(`disputes.error.${state.code ?? "action_failed"}` as DictionaryKey)}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-[10px] font-bold text-green">
          {t("disputes.owner.savedNotice")}
        </p>
      ) : null}

      <div className="mt-3">
        <SubmitButton
          label={t("disputes.owner.saveDecision")}
          pendingLabel={t("disputes.owner.saving")}
          tone="pillDark"
          arrowClassName="size-3.5"
          icon={<CheckIcon className="size-3.5" />}
        />
      </div>
    </form>
  );
}

function ActiveDisputeCard({
  dispute,
  options,
  eventId,
  timezone,
}: {
  dispute: DisputeRecord;
  options: DisputeCorrectionOption[];
  eventId: string;
  timezone: string;
}) {
  const { t, formatDateTime } = useI18n();

  return (
    <article className="border-b border-line/80 py-5 first:pt-2 last:border-b-0">
      <MatchLine dispute={dispute} timezone={timezone} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-soft-orange px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-clay">
          {t("disputes.status.open")}
        </span>
        <span className="text-[10px] font-bold text-muted">
          {t("disputes.owner.openedBy")}{" "}
          <span className="text-ink">
            {dispute.openedByName ?? dispute.openedByEmail ?? t("disputes.unknownUser")}
          </span>
          <span aria-hidden="true"> · </span>
          {formatDateTime(dispute.openedAt, timezone)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-xl bg-paper/70 px-3 py-2.5 text-sm leading-6 text-ink">
        {dispute.explanation}
      </p>

      <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
        <LockIcon className="size-3" />
        {t("disputes.owner.teamLabel")}: {dispute.teamName}
      </p>

      <ResolutionForm dispute={dispute} options={options} eventId={eventId} />
    </article>
  );
}

function HistoryDisputeCard({
  dispute,
  timezone,
}: {
  dispute: DisputeRecord;
  timezone: string;
}) {
  const { t, formatDateTime } = useI18n();

  return (
    <article className="border-b border-line/80 py-4 last:border-b-0">
      <MatchLine dispute={dispute} timezone={timezone} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${statusTone(
            dispute.status,
          )}`}
        >
          {t(`disputes.status.${dispute.status}` as DictionaryKey)}
        </span>
        <span className="text-[10px] font-bold text-muted">
          {dispute.openedByName ?? dispute.openedByEmail ?? t("disputes.unknownUser")}
          <span aria-hidden="true"> · </span>
          {formatDateTime(dispute.openedAt, timezone)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink">
        {dispute.explanation}
      </p>
      {dispute.response ? (
        <div className="mt-2 rounded-lg bg-paper/70 px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("disputes.responseLabel")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">
            {dispute.response}
          </p>
          <p className="mt-1 text-[10px] font-bold text-muted">
            {dispute.resolvedByName ?? dispute.resolvedByEmail ?? t("disputes.unknownUser")}
            {dispute.resolvedAt ? (
              <>
                <span aria-hidden="true"> · </span>
                {formatDateTime(dispute.resolvedAt, timezone)}
              </>
            ) : null}
          </p>
          {dispute.correctionResultVersionId ? (
            <p className="mt-1 text-[10px] font-bold text-green">
              {t("disputes.correctionLinked").replace(
                "{version}",
                String(dispute.correctionVersion ?? "?"),
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DisputeQueueView({
  data,
  user,
}: {
  data: EventDisputesData;
  user: { name: string | null; email: string | null };
}) {
  const { t, formatDateTime } = useI18n();
  const active = data.disputes.filter((dispute) => dispute.status === "open");
  const history = data.disputes.filter((dispute) => dispute.status !== "open");

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar user={user} publicHref={`/events/${data.event.slug}`} />

      <main id="main-content" className="page-shell py-8">
        <Link
          href={`/admin/events/${data.event.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("disputes.owner.backToDashboard")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("disputes.owner.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("disputes.owner.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("disputes.owner.body")}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
            <div className="display-title text-3xl">{active.length}</div>
            <div className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
              {t("disputes.owner.openCount")}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-5">
            <section className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <p className="eyebrow text-green">{t("disputes.owner.queueEyebrow")}</p>
                  <h2 className="display-title mt-1 text-2xl">
                    {t("disputes.owner.queueTitle")}
                  </h2>
                </div>
                <span className="text-xs font-extrabold text-muted">
                  {active.length}
                </span>
              </div>

              {active.length ? (
                active.map((dispute) => (
                  <ActiveDisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    options={data.correctionOptionsByMatch[dispute.matchId] ?? []}
                    eventId={data.event.id}
                    timezone={data.event.timezone}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm font-bold">{t("disputes.owner.queueEmptyTitle")}</p>
                  <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">
                    {t("disputes.owner.queueEmptyBody")}
                  </p>
                </div>
              )}
            </section>

            <section className="surface p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <p className="eyebrow text-green">{t("disputes.owner.historyEyebrow")}</p>
                  <h2 className="display-title mt-1 text-2xl">
                    {t("disputes.owner.historyTitle")}
                  </h2>
                </div>
                <span className="text-xs font-extrabold text-muted">
                  {history.length}
                </span>
              </div>

              {history.length ? (
                history.map((dispute) => (
                  <HistoryDisputeCard
                    key={dispute.id}
                    dispute={dispute}
                    timezone={data.event.timezone}
                  />
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted">
                  {t("disputes.owner.historyEmpty")}
                </p>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="surface p-5">
              <div className="flex items-center gap-2">
                <TrophyIcon className="size-4 text-green" />
                <p className="eyebrow text-green">{t("disputes.owner.activityEyebrow")}</p>
              </div>
              <h2 className="display-title mt-2 text-2xl">
                {t("disputes.owner.activityTitle")}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t("disputes.owner.activityBody")}
              </p>
              {data.activity.length ? (
                <ol className="mt-4 space-y-2">
                  {data.activity.map((entry) => (
                    <li
                      key={entry.id}
                      className="rounded-xl border border-line bg-paper/60 px-3 py-2"
                    >
                      <p className="text-[10px] font-extrabold text-ink">
                        {t(`disputes.activity.${entry.type}` as DictionaryKey)}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium text-muted">
                        {entry.actorName ?? t("disputes.unknownUser")}
                        <span aria-hidden="true"> · </span>
                        {formatDateTime(entry.createdAt, data.event.timezone)}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-4 text-xs text-muted">
                  {t("disputes.owner.activityEmpty")}
                </p>
              )}
            </section>

            <section className="rounded-[1.25rem] bg-ink p-5 text-white">
              <div className="flex items-center gap-2">
                <LockIcon className="size-4 text-lime" />
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-lime">
                  {t("disputes.owner.privacyTitle")}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-white/70">
                {t("disputes.owner.privacyBody")}
              </p>
              <Link
                href={`/events/${data.event.slug}/results`}
                className="mt-4 inline-flex items-center gap-1 text-[11px] font-extrabold text-lime hover:underline"
              >
                {t("disputes.owner.viewPublicResults")}
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
