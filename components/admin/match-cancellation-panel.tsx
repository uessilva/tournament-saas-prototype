"use client";

import { useActionState } from "react";

import { LockIcon, RefreshIcon } from "@/components/icons";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import {
  cancelMatchAction,
  restoreMatchAction,
  type MatchCancellationActionState,
} from "@/features/matches/cancellation-actions";

const EMPTY: MatchCancellationActionState = { status: "idle" };

function Feedback({ state }: { state: MatchCancellationActionState }) {
  const { t } = useI18n();
  const message =
    state.status === "error"
      ? t(
          `matchCancel.error.${state.code ?? "action_failed"}` as DictionaryKey,
        )
      : t(
          state.code === "match_restored"
            ? "matchCancel.restoredNotice"
            : "matchCancel.cancelledNotice",
        );

  return <ActionFeedback status={state.status} message={message} />;
}

export function MatchCancellationPanel({
  eventId,
  matchId,
  matchStatus,
  cancellationReason,
  competitionCancelled,
  compact = false,
}: {
  eventId: string;
  matchId: string;
  matchStatus: string;
  cancellationReason?: string | null;
  competitionCancelled: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [cancelState, cancelAction] = useActionState(cancelMatchAction, EMPTY);
  const [restoreState, restoreAction] = useActionState(
    restoreMatchAction,
    EMPTY,
  );
  const cancelled = matchStatus === "cancelled";
  const published = matchStatus === "published";
  const reasonError = cancelState.fieldErrors?.reason;
  const confirmError = cancelState.fieldErrors?.confirmed;

  return (
    <section
      className={
        compact
          ? "mt-4 rounded-xl border border-line bg-paper/60 p-4"
          : "surface mt-5 p-4 sm:p-5"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`eyebrow ${cancelled ? "text-clay" : "text-muted"}`}>
            {t("matchCancel.eyebrow")}
          </p>
          <h2 className="display-title mt-1 text-xl">
            {cancelled
              ? t("matchCancel.cancelledTitle")
              : t("matchCancel.cancelTitle")}
          </h2>
        </div>
        {cancelled ? <LockIcon className="size-4 text-clay" /> : null}
      </div>

      {cancelled ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-5 text-muted">
            {t("matchCancel.cancelledBody")}
          </p>
          <p className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-ink">
            <span className="font-extrabold">
              {t("matchCancel.internalReason")}:
            </span>{" "}
            {cancellationReason ?? t("matchCancel.noReason")}
          </p>
          {competitionCancelled ? (
            <p className="rounded-lg bg-soft-orange px-3 py-2 text-[11px] font-bold text-clay">
              {t("matchCancel.restoreBlocked")}
            </p>
          ) : (
            <p className="text-[11px] leading-5 text-muted">
              {t("matchCancel.restoreBody")}
            </p>
          )}
          <form action={restoreAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="matchId" value={matchId} />
            <SubmitButton
              label={t("matchCancel.restoreAction")}
              pendingLabel={t("matchCancel.restoring")}
              tone="quietInk"
              icon={false}
              disabled={competitionCancelled}
            />
          </form>
          <Feedback state={restoreState} />
        </div>
      ) : published ? (
        <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-[11px] font-semibold text-muted">
          {t("matchCancel.publishedHint")}
        </p>
      ) : competitionCancelled ? (
        <p className="mt-2 rounded-lg bg-soft-orange px-3 py-2 text-[11px] font-bold text-clay">
          {t("matchCancel.competitionCancelled")}
        </p>
      ) : (
        <details
          className="mt-2"
          open={cancelState.status === "error" ? true : undefined}
        >
          <summary className="cursor-pointer text-xs font-extrabold text-clay">
            {t("matchCancel.openForm")}
          </summary>
          <p className="mt-2 text-xs leading-5 text-muted">
            {t("matchCancel.cancelBody")}
          </p>
          <form action={cancelAction} className="mt-3 space-y-2">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="matchId" value={matchId} />
            <div>
              <label
                htmlFor={`cancel-reason-${matchId}`}
                className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
              >
                {t("matchCancel.reasonLabel")}
              </label>
              <textarea
                id={`cancel-reason-${matchId}`}
                name="reason"
                rows={2}
                required
                minLength={3}
                maxLength={1000}
                placeholder={t("matchCancel.reasonPlaceholder")}
                aria-invalid={Boolean(reasonError)}
                aria-describedby={
                  reasonError ? `cancel-reason-error-${matchId}` : undefined
                }
                className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-green"
              />
              {reasonError ? (
                <p
                  id={`cancel-reason-error-${matchId}`}
                  role="alert"
                  className="mt-1 text-[11px] font-bold text-red-700"
                >
                  {t("matchCancel.reasonRequired")}
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
              {t("matchCancel.confirmLabel")}
            </label>
            {confirmError ? (
              <p role="alert" className="text-[11px] font-bold text-red-700">
                {t("matchCancel.confirmRequired")}
              </p>
            ) : null}
            <SubmitButton
              label={t("matchCancel.cancelAction")}
              pendingLabel={t("matchCancel.cancelling")}
              tone="danger"
              icon={false}
            />
          </form>
          <Feedback state={cancelState} />
        </details>
      )}
    </section>
  );
}
