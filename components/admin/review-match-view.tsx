"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  MapPinIcon,
  RefreshIcon,
} from "@/components/icons";
import { MatchStatusBadge, SportTag } from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type {
  ReviewFieldData,
  ReviewMatchDetail,
  ReviewScoresheetData,
} from "@/features/scoresheets/queries";
import {
  confirmScoresheetAction,
  correctFootballResultAction,
  manualResultAction,
  reopenFootballResultAction,
  rejectScoresheetAction,
  retryExtractionAction,
  saveReviewAction,
  type ScoresheetActionState,
} from "@/features/scoresheets/actions";

const EMPTY: ScoresheetActionState = { status: "idle" };

function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "dark" | "danger" | "quiet";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "dark"
      ? "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green disabled:cursor-wait disabled:opacity-60"
      : tone === "danger"
        ? "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-extrabold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
        : tone === "quiet"
          ? "inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-extrabold text-muted transition-colors hover:border-green hover:text-green disabled:cursor-wait disabled:opacity-60"
          : "inline-flex items-center justify-center gap-2 rounded-xl bg-green px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green-deep disabled:cursor-wait disabled:opacity-60";
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function fieldDefault(field: ReviewFieldData) {
  return field.reviewedValue ?? field.normalizedValue ?? field.rawValue ?? "";
}

function ReviewFieldInputs({
  fields,
  prefix,
  scoresheetId,
}: {
  fields: ReviewFieldData[];
  prefix: string;
  scoresheetId: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const flagged = field.validationFlags.length > 0 || field.needsReview;
        const id = `${prefix}-${field.fieldKey}`;
        const defaultValue = fieldDefault(field);
        return (
          <div
            key={field.id}
            className={`rounded-xl border p-3 ${
              flagged
                ? "border-clay/40 bg-soft-orange/50"
                : "border-line bg-paper/60"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <label
                  htmlFor={id}
                  className="block text-[11px] font-extrabold text-ink"
                >
                  {field.label}
                </label>
                <p className="mt-0.5 text-[10px] font-medium text-muted">
                  {t("review.rawValue")}:{" "}
                  <span className="font-mono">{field.rawValue ?? "—"}</span>
                  {field.confidence != null ? (
                    <>
                      {" "}
                      · {t("review.confidence")}: {field.confidence}%
                    </>
                  ) : null}
                  {field.source ? <> · {field.source}</> : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {flagged ? (
                  <span className="rounded-full bg-clay px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-white">
                    {t("review.needsAttention")}
                  </span>
                ) : (
                  <span className="rounded-full bg-soft-green px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-green">
                    {t("review.fieldOk")}
                  </span>
                )}
              </div>
            </div>

            {field.validationFlags.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {field.validationFlags.map((flag, index) => (
                  <li
                    key={`${flag}-${index}`}
                    className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-clay"
                  >
                    {field.flagLabels[index] ?? flag}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_150px]">
              {field.fieldKey === "result_walkover" ? (
                <select
                  id={id}
                  name={`field_${field.fieldKey}`}
                  defaultValue={defaultValue === "true" ? "true" : "false"}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green"
                >
                  <option value="false">{t("common.no")}</option>
                  <option value="true">{t("common.yes")}</option>
                </select>
              ) : field.fieldKey === "result_walkover_winner" ? (
                <select
                  id={id}
                  name={`field_${field.fieldKey}`}
                  defaultValue={defaultValue}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green"
                >
                  <option value="">{t("review.noWinner")}</option>
                  <option value="home">{t("review.homeSide")}</option>
                  <option value="away">{t("review.awaySide")}</option>
                </select>
              ) : field.fieldKey === "result_notes" ? (
                <textarea
                  id={id}
                  name={`field_${field.fieldKey}`}
                  defaultValue={defaultValue}
                  rows={2}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
                />
              ) : (
                <input
                  id={id}
                  name={`field_${field.fieldKey}`}
                  defaultValue={defaultValue}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm font-bold outline-none focus:border-green"
                />
              )}

              {field.cropStorageKey ? (
                <a
                  href={`/api/scoresheets/${scoresheetId}/crop/${field.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg border border-line bg-white p-1"
                  aria-label={t("review.openCrop")}
                >
                  <img
                    src={`/api/scoresheets/${scoresheetId}/crop/${field.id}`}
                    alt={`${t("review.sourceCrop")}: ${field.label}`}
                    className="h-[52px] w-full object-cover"
                  />
                </a>
              ) : (
                <div className="grid h-[60px] place-items-center rounded-lg border border-dashed border-line text-[9px] font-bold text-muted">
                  {t("review.noCrop")}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatisticsFields({
  participants,
  prefix,
  disabled = false,
}: {
  participants: ReviewMatchDetail["participants"];
  prefix: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const home = participants.filter((participant) => participant.teamName);
  const byTeam = new Map<string, ReviewMatchDetail["participants"]>();
  for (const participant of home) {
    const list = byTeam.get(participant.teamName) ?? [];
    list.push(participant);
    byTeam.set(participant.teamName, list);
  }

  if (!participants.length) {
    return null;
  }

  return (
    <details className="mt-4 rounded-xl border border-line bg-paper/60 p-3">
      <summary className="cursor-pointer text-xs font-extrabold text-ink focus-ring">
        {t("review.statsTitle")}
      </summary>
      <p className="mt-1 text-[10px] font-medium text-muted">
        {t("review.statsBody")}
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {[...byTeam.entries()].map(([teamName, roster]) => (
          <div key={teamName}>
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
              {teamName}
            </h3>
            <div className="mt-1.5 space-y-1.5">
              {roster.map((participant) => (
                <div
                  key={participant.id}
                  className="grid grid-cols-[1fr_54px_54px] items-center gap-1.5"
                >
                  <label
                    htmlFor={`${prefix}-goals-${participant.id}`}
                    className="truncate text-[11px] font-semibold"
                  >
                    {participant.shirtNumber != null ? (
                      <span className="mr-1 text-muted">
                        #{participant.shirtNumber}
                      </span>
                    ) : null}
                    {participant.name}
                  </label>
                  <span>
                    <span className="sr-only">
                      {t("review.statsGoals")} — {participant.name}
                    </span>
                    <input
                      id={`${prefix}-goals-${participant.id}`}
                      name={`stat_goals_${participant.id}`}
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={participant.goals || ""}
                      disabled={disabled}
                      aria-label={`${t("review.statsGoals")} — ${participant.name}`}
                      className="w-full rounded-md border border-line bg-white px-1.5 py-1 text-center font-mono text-xs font-bold outline-none focus:border-green disabled:bg-cream"
                      placeholder={t("review.statsGoalsShort")}
                    />
                  </span>
                  <span>
                    <span className="sr-only">
                      {t("review.statsAssists")} — {participant.name}
                    </span>
                    <input
                      id={`${prefix}-assists-${participant.id}`}
                      name={`stat_assists_${participant.id}`}
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={participant.assists || ""}
                      disabled={disabled}
                      aria-label={`${t("review.statsAssists")} — ${participant.name}`}
                      className="w-full rounded-md border border-line bg-white px-1.5 py-1 text-center font-mono text-xs font-bold outline-none focus:border-green disabled:bg-cream"
                      placeholder={t("review.statsAssistsShort")}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] font-semibold text-clay">
        {t("review.statsWalkoverNote")}
      </p>
    </details>
  );
}

function ErrorNotice({ code }: { code?: string }) {
  const { t } = useI18n();
  if (!code) return null;
  return (
    <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
      {t(`review.error.${code}` as DictionaryKey)}
    </p>
  );
}

function ScoresheetReviewForms({
  data,
  sheet,
  published,
}: {
  data: ReviewMatchDetail;
  sheet: ReviewScoresheetData;
  published: boolean;
}) {
  const { t } = useI18n();
  const [saveState, saveAction] = useActionState(saveReviewAction, EMPTY);
  const [confirmState, confirmAction] = useActionState(
    confirmScoresheetAction,
    EMPTY,
  );
  const [rejectState, rejectAction] = useActionState(
    rejectScoresheetAction,
    EMPTY,
  );
  const [retryState, retryAction] = useActionState(
    retryExtractionAction,
    EMPTY,
  );

  return (
    <div className="space-y-4">
      <section className="surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-clay">{t("review.machineEyebrow")}</p>
            <h2 className="display-title mt-1 text-2xl">
              {t("review.machineTitle")}
            </h2>
          </div>
          <span className="rounded-full bg-soft-orange px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-clay">
            {t(`scoresheetStatus.${sheet.status}` as DictionaryKey)}
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted">
          {t("review.machineBody")}
        </p>
        {sheet.extractionNote ? (
          <p
            className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
              sheet.extractionSource === "seeded_fallback"
                ? "border-clay/30 bg-soft-orange text-clay"
                : "border-green/20 bg-soft-green text-green"
            }`}
          >
            {sheet.extractionNote}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-muted">
          <span>
            {t("review.extractionSource")}:{" "}
            {sheet.extractionSource === "seeded_fallback"
              ? t("review.sourceFallback")
              : sheet.extractionSource === "acroform"
                ? t("review.sourceAcroform")
                : t("review.sourceQr")}
          </span>
          <span>·</span>
          <span>
            {t("review.templateVersion")}: {sheet.templateVersion ?? "—"}
          </span>
          <span>·</span>
          <span>
            {t("review.qrIdentity")}: {sheet.qrSheetId ?? "—"}
          </span>
        </div>
      </section>

      <form action={saveAction} className="surface p-4 sm:p-5">
        <input type="hidden" name="eventId" value={data.event.id} />
        <input type="hidden" name="scoresheetId" value={sheet.id} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="eyebrow text-green">{t("review.fieldsEyebrow")}</p>
            <h2 className="display-title mt-1 text-2xl">
              {t("review.fieldsTitle")}
            </h2>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("review.fieldsCount").replace(
              "{count}",
              String(sheet.fields.length),
            )}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted">
          {t("review.fieldsBody")}
        </p>
        <div className="mt-4">
          <ReviewFieldInputs
            fields={sheet.fields}
            prefix={`save-${sheet.id}`}
            scoresheetId={sheet.id}
          />
        </div>
        {saveState.status === "success" ? (
          <p role="status" className="mt-3 text-xs font-bold text-green">
            {t("review.reviewSaved")}
          </p>
        ) : (
          <ErrorNotice code={saveState.code} />
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <SubmitButton
            label={t("review.saveReview")}
            pendingLabel={t("review.saving")}
            tone="dark"
            disabled={published}
          />
          <span className="self-center text-[10px] font-semibold text-muted">
            {t("review.saveHint")}
          </span>
        </div>
      </form>

      <form action={confirmAction} className="surface p-4 sm:p-5">
        <input type="hidden" name="eventId" value={data.event.id} />
        <input type="hidden" name="scoresheetId" value={sheet.id} />
        <p className="eyebrow text-green">{t("review.confirmEyebrow")}</p>
        <h2 className="display-title mt-1 text-2xl">
          {t("review.confirmTitle")}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted">
          {t("review.confirmBody")}
        </p>
        <div className="mt-4">
          <ReviewFieldInputs
            fields={sheet.fields}
            prefix={`confirm-${sheet.id}`}
            scoresheetId={sheet.id}
          />
          <StatisticsFields
            participants={data.participants}
            prefix={`confirm-${sheet.id}`}
            disabled={published}
          />
        </div>
        {confirmState.status === "error" ? (
          <ErrorNotice code={confirmState.code} />
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SubmitButton
            label={t("review.confirmPublish")}
            pendingLabel={t("review.publishing")}
            disabled={published}
          />
          <span className="text-[10px] font-semibold text-muted">
            {t("review.confirmHint")}
          </span>
        </div>
      </form>

      <section className="grid gap-4 lg:grid-cols-2">
        <form action={rejectAction} className="surface p-4 sm:p-5">
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="scoresheetId" value={sheet.id} />
          <h2 className="text-sm font-extrabold">{t("review.rejectTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("review.rejectBody")}
          </p>
          <label
            htmlFor={`reject-reason-${sheet.id}`}
            className="mt-3 block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.rejectReason")}
          </label>
          <input
            id={`reject-reason-${sheet.id}`}
            name="reason"
            required
            minLength={3}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
          />
          {rejectState.status === "success" ? (
            <p role="status" className="mt-2 text-xs font-bold text-green">
              {t("review.rejected")}
            </p>
          ) : (
            <ErrorNotice code={rejectState.code} />
          )}
          <div className="mt-3">
            <SubmitButton
              label={t("review.rejectAction")}
              pendingLabel={t("review.rejecting")}
              tone="danger"
              disabled={published}
            />
          </div>
        </form>

        <form action={retryAction} className="surface p-4 sm:p-5">
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="scoresheetId" value={sheet.id} />
          <h2 className="text-sm font-extrabold">{t("review.retryTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("review.retryBody")}
          </p>
          {retryState.status === "success" ? (
            <p role="status" className="mt-2 text-xs font-bold text-green">
              {t("review.retried")}
            </p>
          ) : (
            <ErrorNotice code={retryState.code} />
          )}
          <div className="mt-3">
            <SubmitButton
              label={t("review.retryAction")}
              pendingLabel={t("review.retrying")}
              tone="quiet"
              disabled={published}
            />
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <RefreshIcon className="size-3" />
            {t("review.retrySyncHint")}
          </div>
        </form>
      </section>
    </div>
  );
}

function ManualEntryForm({
  data,
  published,
}: {
  data: ReviewMatchDetail;
  published: boolean;
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(manualResultAction, EMPTY);
  const [walkover, setWalkover] = useState(false);

  return (
    <form action={action} className="surface p-4 sm:p-5">
      <input type="hidden" name="eventId" value={data.event.id} />
      <input type="hidden" name="matchId" value={data.match.id} />
      <p className="eyebrow text-clay">{t("review.manualEyebrow")}</p>
      <h2 className="display-title mt-1 text-2xl">{t("review.manualTitle")}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {t("review.manualBody")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`manual-home-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {data.match.homeTeamName ?? t("review.homeSide")}
          </label>
          <input
            id={`manual-home-${data.match.id}`}
            name="homeScore"
            type="number"
            min={0}
            max={30}
            required
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-lg font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
        <div>
          <label
            htmlFor={`manual-away-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {data.match.awayTeamName ?? t("review.awaySide")}
          </label>
          <input
            id={`manual-away-${data.match.id}`}
            name="awayScore"
            type="number"
            min={0}
            max={30}
            required
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-lg font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-bold">
        <input
          type="checkbox"
          name="isWalkover"
          value="true"
          checked={walkover}
          onChange={(event) => setWalkover(event.target.checked)}
          className="size-4 accent-clay"
        />
        {t("review.manualWalkover")}
      </label>

      {walkover ? (
        <div className="mt-3">
          <label
            htmlFor={`manual-winner-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualWalkoverWinner")}
          </label>
          <select
            id={`manual-winner-${data.match.id}`}
            name="walkoverWinner"
            required
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green"
          >
            <option value="">{t("review.noWinner")}</option>
            <option value="home">{data.match.homeTeamName ?? t("review.homeSide")}</option>
            <option value="away">{data.match.awayTeamName ?? t("review.awaySide")}</option>
          </select>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`manual-pen-home-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualPenaltyHome")}
          </label>
          <input
            id={`manual-pen-home-${data.match.id}`}
            name="penaltyHome"
            type="number"
            min={0}
            max={30}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
        <div>
          <label
            htmlFor={`manual-pen-away-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualPenaltyAway")}
          </label>
          <input
            id={`manual-pen-away-${data.match.id}`}
            name="penaltyAway"
            type="number"
            min={0}
            max={30}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
      </div>

      <div className="mt-3">
        <label
          htmlFor={`manual-notes-${data.match.id}`}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
        >
          {t("review.manualNotes")}
        </label>
        <textarea
          id={`manual-notes-${data.match.id}`}
          name="notes"
          rows={2}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
        />
      </div>

      <StatisticsFields
        participants={data.participants}
        prefix={`manual-${data.match.id}`}
        disabled={walkover}
      />

      <label className="mt-4 flex items-start gap-2 rounded-xl border border-clay/30 bg-soft-orange p-3 text-xs font-bold text-clay">
        <input
          type="checkbox"
          name="explicitConfirmation"
          value="true"
          required
          className="mt-0.5 size-4 shrink-0 accent-clay"
        />
        {t("review.manualConfirmation")}
      </label>

      {state.status === "error" ? <ErrorNotice code={state.code} /> : null}

      <div className="mt-3">
        <SubmitButton
          label={t("review.manualPublish")}
          pendingLabel={t("review.publishing")}
          tone="dark"
          disabled={published}
        />
      </div>
    </form>
  );
}

function CorrectionForm({
  data,
  current,
}: {
  data: ReviewMatchDetail;
  current: ReviewMatchDetail["resultVersions"][number];
}) {
  const { t } = useI18n();
  const [state, action] = useActionState(correctFootballResultAction, EMPTY);
  const [walkover, setWalkover] = useState(current.isWalkover);
  const walkoverWinner =
    current.isWalkover && current.homeScore != null && current.awayScore != null
      ? current.homeScore > current.awayScore
        ? "home"
        : "away"
      : "";

  return (
    <form action={action} className="surface p-4 sm:p-5">
      <input type="hidden" name="eventId" value={data.event.id} />
      <input type="hidden" name="matchId" value={data.match.id} />
      <p className="eyebrow text-clay">{t("review.correctionEyebrow")}</p>
      <h2 className="display-title mt-1 text-2xl">
        {t("review.correctionTitle")}
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {t("review.correctionBody")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`correction-home-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {data.match.homeTeamName ?? t("review.homeSide")}
          </label>
          <input
            id={`correction-home-${data.match.id}`}
            name="homeScore"
            type="number"
            min={0}
            max={30}
            required
            defaultValue={current.homeScore ?? 0}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-lg font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
        <div>
          <label
            htmlFor={`correction-away-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {data.match.awayTeamName ?? t("review.awaySide")}
          </label>
          <input
            id={`correction-away-${data.match.id}`}
            name="awayScore"
            type="number"
            min={0}
            max={30}
            required
            defaultValue={current.awayScore ?? 0}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-lg font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs font-bold">
        <input
          type="checkbox"
          name="isWalkover"
          value="true"
          checked={walkover}
          onChange={(event) => setWalkover(event.target.checked)}
          className="size-4 accent-clay"
        />
        {t("review.manualWalkover")}
      </label>

      {walkover ? (
        <div className="mt-3">
          <label
            htmlFor={`correction-winner-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualWalkoverWinner")}
          </label>
          <select
            id={`correction-winner-${data.match.id}`}
            name="walkoverWinner"
            required
            defaultValue={walkoverWinner}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-bold outline-none focus:border-green"
          >
            <option value="">{t("review.noWinner")}</option>
            <option value="home">
              {data.match.homeTeamName ?? t("review.homeSide")}
            </option>
            <option value="away">
              {data.match.awayTeamName ?? t("review.awaySide")}
            </option>
          </select>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`correction-pen-home-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualPenaltyHome")}
          </label>
          <input
            id={`correction-pen-home-${data.match.id}`}
            name="penaltyHome"
            type="number"
            min={0}
            max={30}
            defaultValue={current.penaltyHome ?? ""}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
        <div>
          <label
            htmlFor={`correction-pen-away-${data.match.id}`}
            className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
          >
            {t("review.manualPenaltyAway")}
          </label>
          <input
            id={`correction-pen-away-${data.match.id}`}
            name="penaltyAway"
            type="number"
            min={0}
            max={30}
            defaultValue={current.penaltyAway ?? ""}
            disabled={walkover}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-sm font-bold outline-none focus:border-green disabled:bg-cream"
          />
        </div>
      </div>

      <StatisticsFields
        participants={data.participants}
        prefix={`correction-${data.match.id}`}
        disabled={walkover}
      />

      <div className="mt-4">
        <label
          htmlFor={`correction-reason-${data.match.id}`}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
        >
          {t("review.correctionReason")}
        </label>
        <textarea
          id={`correction-reason-${data.match.id}`}
          name="reason"
          required
          minLength={3}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
        />
        <p className="mt-1 text-[10px] font-medium text-muted">
          {t("review.correctionReasonHint")}
        </p>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-xl border border-clay/30 bg-soft-orange p-3 text-xs font-bold text-clay">
        <input
          type="checkbox"
          name="explicitConfirmation"
          value="true"
          required
          className="mt-0.5 size-4 shrink-0 accent-clay"
        />
        {t("review.correctionConfirmation")}
      </label>

      {state.status === "error" ? <ErrorNotice code={state.code} /> : null}
      <div className="mt-3">
        <SubmitButton
          label={t("review.correctionPublish")}
          pendingLabel={t("review.publishing")}
          tone="danger"
        />
      </div>
    </form>
  );
}

function ReopenForm({ data }: { data: ReviewMatchDetail }) {
  const { t } = useI18n();
  const [state, action] = useActionState(reopenFootballResultAction, EMPTY);

  return (
    <form action={action} className="surface p-4 sm:p-5">
      <input type="hidden" name="eventId" value={data.event.id} />
      <input type="hidden" name="matchId" value={data.match.id} />
      <p className="eyebrow text-clay">{t("review.reopenEyebrow")}</p>
      <h2 className="display-title mt-1 text-2xl">
        {t("review.reopenTitle")}
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        {t("review.reopenBody")}
      </p>
      <div className="mt-4">
        <label
          htmlFor={`reopen-reason-${data.match.id}`}
          className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
        >
          {t("review.reopenReason")}
        </label>
        <textarea
          id={`reopen-reason-${data.match.id}`}
          name="reason"
          required
          minLength={3}
          rows={2}
          className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
        />
      </div>
      <p className="mt-3 rounded-xl bg-soft-orange p-3 text-[11px] font-semibold text-clay">
        {t("review.reopenGuardHint")}
      </p>
      {state.status === "error" ? <ErrorNotice code={state.code} /> : null}
      <div className="mt-3">
        <SubmitButton
          label={t("review.reopenAction")}
          pendingLabel={t("review.reopening")}
          tone="danger"
        />
      </div>
    </form>
  );
}

export function ReviewMatchView({
  data,
  user,
  notice,
}: {
  data: ReviewMatchDetail;
  user: { name: string | null; email: string | null };
  notice?: string;
}) {
  const { t, formatDateTime } = useI18n();
  const published = data.match.status === "published";
  const active =
    data.scoresheets.find((sheet) => sheet.isActive) ?? data.scoresheets[0];
  const currentResult = data.resultVersions.find((version) => version.isCurrent);
  const canReview =
    active != null &&
    ["uploaded", "processing", "needs_review", "extraction_failed", "rejected"].includes(
      active.status,
    ) &&
    !published;

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}/results`}
        secondaryHref={`/admin/events/${data.event.id}/review`}
        secondaryLabel={t("review.backToQueue")}
      />

      <main id="main-content" className="page-shell py-8">
        <Link
          href={`/admin/events/${data.event.id}/review`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("review.backToQueue")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("review.matchEyebrow")}</p>
            <h1 className="display-title mt-2 text-3xl sm:text-4xl">
              {data.match.homeTeamName ?? t("match.tbd")}{" "}
              <span className="text-muted">{t("match.vs")}</span>{" "}
              {data.match.awayTeamName ?? t("match.tbd")}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-muted">
              <SportTag sport={data.competition.sport} />
              <span>{data.competition.name}</span>
              <span>· #{data.match.matchNumber}</span>
              {data.match.startsAt ? (
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="size-3" />
                  {formatDateTime(data.match.startsAt, data.event.timezone)}
                </span>
              ) : null}
              {data.match.venueName ? (
                <span className="inline-flex items-center gap-1">
                  <MapPinIcon className="size-3" />
                  {data.match.venueName}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MatchStatusBadge status={data.match.status} />
            {active ? (
              <span className="rounded-full bg-soft-orange px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-clay">
                {t(`scoresheetStatus.${active.status}` as DictionaryKey)}
              </span>
            ) : null}
            <Link
              href={`/events/${data.event.slug}/results`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-extrabold text-muted transition-colors hover:border-green hover:text-green"
            >
              {t("review.publicResults")}
              <ArrowRightIcon className="size-3" />
            </Link>
          </div>
        </div>

        {notice ? (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl border border-green/20 bg-soft-green px-4 py-3 text-sm font-bold text-green"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0" />
            {t(`review.notice.${notice}` as DictionaryKey)}
          </div>
        ) : null}

        {published && currentResult ? (
          <section className="mt-5 rounded-2xl bg-ink p-5 text-white sm:p-6">
            <p className="eyebrow text-lime">{t("review.publishedResult")}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold">
                  {data.match.homeTeamName} × {data.match.awayTeamName}
                </p>
                <p className="mt-1 text-[11px] text-white/60">
                  {t("review.version")} {currentResult.version} ·{" "}
                  {t(`resultSource.${currentResult.source}` as DictionaryKey)} ·{" "}
                  {currentResult.reviewedBy ?? "—"}
                </p>
              </div>
              <p className="score-numeral text-4xl font-semibold">
                {currentResult.homeScore}–{currentResult.awayScore}
                {currentResult.penaltyHome != null &&
                currentResult.penaltyAway != null ? (
                  <span className="ml-2 text-sm text-white/60">
                    ({currentResult.penaltyHome}–{currentResult.penaltyAway})
                  </span>
                ) : null}
              </p>
            </div>
          </section>
        ) : null}

        {published && currentResult ? (
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <CorrectionForm data={data} current={currentResult} />
            <ReopenForm data={data} />
          </div>
        ) : null}

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="surface self-start p-4 sm:p-5 xl:sticky xl:top-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow text-green">{t("review.originalEyebrow")}</p>
                <h2 className="display-title mt-1 text-2xl">
                  {t("review.originalTitle")}
                </h2>
              </div>
              {active ? (
                <a
                  href={`/api/scoresheets/${active.id}/file?download=1`}
                  className="rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-extrabold text-muted transition-colors hover:border-green hover:text-green"
                >
                  {t("review.downloadOriginal")}
                </a>
              ) : null}
            </div>
            {active ? (
              <>
                <p className="mt-1 text-[10px] font-semibold text-muted">
                  {active.originalFilename} ·{" "}
                  {t("review.uploadedBy")} {active.uploadedBy ?? "—"}
                </p>
                <div className="mt-3 overflow-hidden rounded-xl border border-line bg-cream">
                  <iframe
                    title={t("review.originalTitle")}
                    src={`/api/scoresheets/${active.id}/file`}
                    className="h-[58vh] w-full bg-white"
                  />
                </div>
                {active.previewStorageKey ? (
                  <div className="mt-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                      {t("review.extractionOverlay")}
                    </p>
                    <img
                      src={`/api/scoresheets/${active.id}/preview`}
                      alt={t("review.extractionOverlay")}
                      className="mt-1 w-full rounded-xl border border-line bg-white"
                    />
                  </div>
                ) : null}
                <a
                  href={`/api/scoresheets/${active.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-green hover:underline"
                >
                  {t("review.openOriginalNewTab")}
                  <ArrowRightIcon className="size-3" />
                </a>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-line p-6 text-center">
                <p className="text-sm font-bold">{t("review.noScoresheetTitle")}</p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted">
                  {t("review.noScoresheetBody")}
                </p>
              </div>
            )}
          </section>

          <div className="space-y-5">
            {canReview && active ? (
              <ScoresheetReviewForms
                data={data}
                sheet={active}
                published={published}
              />
            ) : null}

            {!published ? (
              <ManualEntryForm data={data} published={published} />
            ) : null}

            {published && active ? (
              <section className="surface p-4 sm:p-5">
                <p className="eyebrow text-green">{t("review.historyEyebrow")}</p>
                <h2 className="display-title mt-1 text-2xl">
                  {t("review.historyTitle")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {t("review.historyBody")}
                </p>
              </section>
            ) : null}
          </div>
        </div>

        <section className="surface mt-5 p-4 sm:p-6">
          <p className="eyebrow text-green">{t("review.historyEyebrow")}</p>
          <h2 className="display-title mt-1 text-2xl">
            {t("review.historyTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("review.historyBody")}
          </p>

          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                {t("review.scoresheetHistory")}
              </h3>
              {data.scoresheets.length ? (
                <ol className="mt-2 space-y-2">
                  {data.scoresheets.map((sheet) => (
                    <li
                      key={sheet.id}
                      className="rounded-xl border border-line bg-paper/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold">
                          {t(`scoresheetStatus.${sheet.status}` as DictionaryKey)}
                          {sheet.isActive ? (
                            <span className="ml-1.5 rounded-full bg-green px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-white">
                              {t("review.active")}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-[10px] font-semibold text-muted">
                          {formatDateTime(sheet.uploadedAt, data.event.timezone)}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-muted">
                        {sheet.originalFilename} · {t("review.uploadedBy")}{" "}
                        {sheet.uploadedBy ?? "—"}
                        {sheet.extractionSource
                          ? ` · ${sheet.extractionSource}`
                          : ""}
                      </p>
                      {sheet.reviewedBy ? (
                        <p className="mt-1 text-[10px] font-medium text-muted">
                          {t("review.reviewedBy")} {sheet.reviewedBy}
                        </p>
                      ) : null}
                      {sheet.failureReason ? (
                        <p className="mt-1 text-[10px] font-bold text-red-700">
                          {sheet.failureReason}
                        </p>
                      ) : null}
                      {sheet.rejectionReason ? (
                        <p className="mt-1 text-[10px] font-bold text-red-700">
                          {sheet.rejectionReason}
                        </p>
                      ) : null}
                      {sheet.jobs.length ? (
                        <ul className="mt-1.5 space-y-0.5 text-[9px] font-medium text-muted">
                          {sheet.jobs.map((job) => (
                            <li key={job.id}>
                              job {job.status} · {t("review.attempts")}{" "}
                              {job.attempts}
                              {job.lastError ? ` · ${job.lastError}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs font-semibold text-muted">
                  {t("review.noHistory")}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
                {t("review.resultHistory")}
              </h3>
              {data.resultVersions.length ? (
                <ol className="mt-2 space-y-2">
                  {data.resultVersions.map((version) => (
                    <li
                      key={version.id}
                      className="rounded-xl border border-line bg-paper/60 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold">
                          {t("review.version")} {version.version} ·{" "}
                          {t(
                            `resultSource.${version.source}` as DictionaryKey,
                          )}
                          {version.isCurrent ? (
                            <span className="ml-1.5 rounded-full bg-green px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] text-white">
                              {t("review.current")}
                            </span>
                          ) : null}
                        </span>
                        <span className="score-numeral text-lg font-semibold">
                          {version.homeScore}–{version.awayScore}
                          {version.isWalkover ? " W.O." : ""}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-muted">
                        {formatDateTime(version.confirmedAt, data.event.timezone)}{" "}
                        · {t("review.reviewedBy")} {version.reviewedBy ?? "—"}
                      </p>
                      {version.reason ? (
                        <p className="mt-1 text-[10px] font-bold text-clay">
                          {version.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs font-semibold text-muted">
                  {t("review.noHistory")}
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
