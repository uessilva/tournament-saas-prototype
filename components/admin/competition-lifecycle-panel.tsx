"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { CheckIcon, LockIcon, RefreshIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import {
  cancelCompetitionAction,
  restoreCompetitionAction,
  type CompetitionLifecycleActionState,
} from "@/features/competitions/lifecycle-actions";
import type { CompetitionLifecycleEvent } from "@/features/competitions/lifecycle-queries";

const EMPTY: CompetitionLifecycleActionState = { status: "idle" };

function SubmitButton({
  label,
  pendingLabel,
  tone = "danger",
}: {
  label: string;
  pendingLabel: string;
  tone?: "danger" | "quiet";
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "quiet"
      ? "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-not-allowed disabled:opacity-60"
      : "inline-flex items-center justify-center gap-2 rounded-xl bg-clay px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ state }: { state: CompetitionLifecycleActionState }) {
  const { t } = useI18n();
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    return (
      <p role="alert" className="mt-2 text-xs font-bold text-red-700">
        {t(
          `compLifecycle.error.${state.code ?? "action_failed"}` as DictionaryKey,
        )}
      </p>
    );
  }

  return (
    <p
      role="status"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-soft-green px-2.5 py-1.5 text-[11px] font-extrabold text-green"
    >
      <CheckIcon className="size-3.5" />
      {t(
        state.code === "competition_restored"
          ? "compLifecycle.restoredNotice"
          : "compLifecycle.cancelledNotice",
      )}
    </p>
  );
}

const eventLabelKeys: Partial<Record<string, DictionaryKey>> = {
  "competition.cancelled": "compLifecycle.eventCancelled",
  "competition.restored": "compLifecycle.eventRestored",
  "match.cancelled": "compLifecycle.matchCancelled",
  "match.restored": "compLifecycle.matchRestored",
};

export function CompetitionLifecyclePanel({
  eventId,
  competitionId,
  competitionName,
  status,
  publicNote,
  cancelledAt,
  timezone,
  history,
}: {
  eventId: string;
  competitionId: string;
  competitionName: string;
  status: string;
  publicNote: string | null;
  cancelledAt: string | null;
  timezone: string;
  history: CompetitionLifecycleEvent[];
}) {
  const { t, formatDateTime } = useI18n();
  const [cancelState, cancelAction] = useActionState(
    cancelCompetitionAction,
    EMPTY,
  );
  const [restoreState, restoreAction] = useActionState(
    restoreCompetitionAction,
    EMPTY,
  );
  const cancelled = status === "cancelled";
  const noteError = cancelState.fieldErrors?.publicNote;
  const confirmError = cancelState.fieldErrors?.confirmed;

  return (
    <section
      id="lifecycle"
      className={`surface scroll-mt-6 p-5 sm:p-6 ${
        cancelled ? "border-red-200 bg-red-50/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`eyebrow ${cancelled ? "text-clay" : "text-green"}`}>
            {t("compLifecycle.eyebrow")}
          </p>
          <h2 className="display-title mt-1 text-2xl">
            {cancelled
              ? t("compLifecycle.cancelledTitle")
              : t("compLifecycle.title")}
          </h2>
        </div>
        {cancelled ? <LockIcon className="size-4 text-clay" /> : null}
      </div>

      {cancelled ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm font-semibold text-red-800">
            {t("compLifecycle.cancelledBody")}
          </p>
          <div className="rounded-xl border border-red-200 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-clay">
              {t("competition.publicNote")}
            </p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {publicNote ?? t("compLifecycle.noPublicNote")}
            </p>
            {cancelledAt ? (
              <p className="mt-1 text-[11px] font-medium text-muted">
                {formatDateTime(cancelledAt, timezone)}
              </p>
            ) : null}
          </div>
          <p className="text-[11px] leading-5 text-muted">
            {t("compLifecycle.readOnlyBody")}
          </p>
          <form action={restoreAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="competitionId" value={competitionId} />
            <SubmitButton
              label={t("compLifecycle.restoreAction")}
              pendingLabel={t("compLifecycle.restoring")}
              tone="quiet"
            />
          </form>
          <Feedback state={restoreState} />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-6 text-muted">
            {t("compLifecycle.body")}
          </p>
          <details open={cancelState.status === "error" ? true : undefined}>
            <summary className="cursor-pointer text-xs font-extrabold text-clay">
              {t("compLifecycle.openForm")}
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted">
              {t("compLifecycle.formBody")}
            </p>
            <form action={cancelAction} className="mt-3 space-y-3">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="competitionId" value={competitionId} />
              <div>
                <label
                  htmlFor={`competition-cancel-note-${competitionId}`}
                  className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
                >
                  {t("compLifecycle.publicNoteLabel")}
                </label>
                <textarea
                  id={`competition-cancel-note-${competitionId}`}
                  name="publicNote"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={1000}
                  placeholder={t("compLifecycle.publicNotePlaceholder")}
                  aria-invalid={Boolean(noteError)}
                  aria-describedby={
                    noteError
                      ? `competition-cancel-note-error-${competitionId}`
                      : undefined
                  }
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
                />
                {noteError ? (
                  <p
                    id={`competition-cancel-note-error-${competitionId}`}
                    role="alert"
                    className="mt-1 text-[11px] font-bold text-red-700"
                  >
                    {t("compLifecycle.publicNoteRequired")}
                  </p>
                ) : null}
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-clay/30 bg-soft-orange p-3 text-[11px] font-bold text-clay">
                <input
                  type="checkbox"
                  name="confirmed"
                  value="true"
                  required
                  aria-invalid={Boolean(confirmError)}
                  className="mt-0.5 size-4 shrink-0 accent-clay"
                />
                {t("compLifecycle.confirmLabel").replace(
                  "{competition}",
                  competitionName,
                )}
              </label>
              {confirmError ? (
                <p role="alert" className="text-[11px] font-bold text-red-700">
                  {t("compLifecycle.confirmRequired")}
                </p>
              ) : null}
              <SubmitButton
                label={t("compLifecycle.cancelAction")}
                pendingLabel={t("compLifecycle.cancelling")}
              />
            </form>
            <Feedback state={cancelState} />
          </details>
        </div>
      )}

      <div className="mt-5 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("compLifecycle.historyTitle")}
          </h3>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted">
            <RefreshIcon className="size-3" />
            {t("compLifecycle.historyLive")}
          </span>
        </div>
        {history.length ? (
          <ol className="mt-2 space-y-2">
            {history.map((entry) => {
              const reason =
                entry.type === "match.cancelled" &&
                typeof entry.metadata?.reason === "string"
                  ? entry.metadata.reason
                  : null;
              return (
                <li
                  key={entry.id}
                  className="rounded-xl border border-line bg-paper/60 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">
                      {t(
                        eventLabelKeys[entry.type] ??
                          ("compLifecycle.eventOther" as DictionaryKey),
                      )}
                    </span>
                    <span className="text-[10px] font-semibold text-muted">
                      {formatDateTime(entry.createdAt, timezone)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {entry.summary}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted">
                    {entry.actorName ?? entry.actorEmail ?? "—"}
                  </p>
                  {reason ? (
                    <p className="mt-1 text-[10px] font-bold text-clay">
                      {t("matchCancel.internalReason")}: {reason}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-xs font-semibold text-muted">
            {t("compLifecycle.noHistory")}
          </p>
        )}
      </div>
    </section>
  );
}
