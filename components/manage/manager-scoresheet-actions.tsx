"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { ArrowRightIcon, CheckIcon, RefreshIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { ManagerScoresheetSummary } from "@/features/matches/manager-queries";
import {
  uploadScoresheetAction,
  type ScoresheetActionState,
} from "@/features/scoresheets/actions";

const EMPTY: ScoresheetActionState = { status: "idle" };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-green px-3 py-1.5 text-[11px] font-extrabold text-white transition-colors hover:bg-green-deep disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
      {pending ? null : <ArrowRightIcon className="size-3" />}
    </button>
  );
}

function statusTone(status: string) {
  if (status === "confirmed") return "bg-soft-green text-green";
  if (status === "needs_review") return "bg-soft-orange text-clay";
  if (status === "extraction_failed" || status === "rejected")
    return "bg-red-50 text-red-700";
  return "bg-cream text-muted";
}

export function ManagerScoresheetActions({
  matchId,
  matchStatus,
  competitionCancelled,
  sheets,
  timezone,
}: {
  matchId: string;
  matchStatus: string;
  competitionCancelled: boolean;
  sheets: ManagerScoresheetSummary[];
  timezone: string;
}) {
  const { t, formatDateTime } = useI18n();
  const [state, action] = useActionState(uploadScoresheetAction, EMPTY);
  const active = sheets.find((sheet) => sheet.isActive) ?? sheets[0] ?? null;
  const blocked =
    competitionCancelled ||
    matchStatus === "published" ||
    matchStatus === "cancelled" ||
    (active != null &&
      ["uploaded", "processing", "needs_review", "confirmed"].includes(
        active.status,
      ));

  return (
    <div className="mt-3 rounded-xl border border-line bg-paper/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
            {t("manageScoresheet.title")}
          </span>
          {active ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${statusTone(active.status)}`}
            >
              {t(`scoresheetStatus.${active.status}` as DictionaryKey)}
            </span>
          ) : (
            <span className="rounded-full bg-cream px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
              {t("manageScoresheet.none")}
            </span>
          )}
          {active?.extractionSource === "seeded_fallback" ? (
            <span className="rounded-full bg-soft-orange px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-clay">
              {t("review.sourceFallback")}
            </span>
          ) : null}
        </div>
        <a
          href={`/api/matches/${matchId}/scoresheet-template`}
          className="rounded-full border border-line bg-white px-2.5 py-1 text-[10px] font-extrabold text-muted transition-colors hover:border-green hover:text-green"
        >
          {t("manageScoresheet.download")}
        </a>
      </div>

      {competitionCancelled ? (
        <p className="mt-2 text-[10px] font-bold text-clay">
          {t("manage.competitionCancelled")}
        </p>
      ) : null}
      {active?.failureReason ? (
        <p role="alert" className="mt-2 text-[10px] font-bold text-red-700">
          {active.failureReason}
        </p>
      ) : null}
      {active?.rejectionReason ? (
        <p className="mt-2 text-[10px] font-bold text-red-700">
          {active.rejectionReason}
        </p>
      ) : null}
      {active?.status === "needs_review" ? (
        <p className="mt-2 text-[10px] font-semibold text-clay">
          {t("manageScoresheet.needsReviewHint")}
        </p>
      ) : null}
      {active?.status === "processing" || active?.status === "uploaded" ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-muted">
          <RefreshIcon className="size-3" />
          {t("manageScoresheet.processingHint")}
        </p>
      ) : null}
      {active?.status === "confirmed" ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-green">
          <CheckIcon className="size-3" />
          {t("manageScoresheet.confirmedHint")}
        </p>
      ) : null}

      {!blocked ? (
        <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="intent" value="upload" />
          <label htmlFor={`sheet-file-${matchId}`} className="sr-only">
            {t("manageScoresheet.fileLabel")}
          </label>
          <input
            id={`sheet-file-${matchId}`}
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="max-w-[210px] text-[10px] font-semibold text-muted file:mr-2 file:rounded-full file:border-0 file:bg-cream file:px-3 file:py-1 file:text-[10px] file:font-extrabold file:text-ink"
          />
          <SubmitButton
            label={t("manageScoresheet.upload")}
            pendingLabel={t("manageScoresheet.uploading")}
          />
        </form>
      ) : null}

      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-[10px] font-bold text-red-700">
          {t(
            `manageScoresheet.error.${state.code ?? "action_failed"}` as DictionaryKey,
          )}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p role="status" className="mt-2 text-[10px] font-bold text-green">
          {t("manageScoresheet.uploaded")}
        </p>
      ) : null}

      {sheets.length > 1 ? (
        <details className="mt-2 border-t border-line pt-2">
          <summary className="cursor-pointer text-[10px] font-extrabold text-muted">
            {t("manageScoresheet.history").replace(
              "{count}",
              String(sheets.length),
            )}
          </summary>
          <ul className="mt-1.5 space-y-1">
            {sheets.map((sheet) => (
              <li
                key={sheet.id}
                className="flex flex-wrap items-center justify-between gap-1 text-[9px] font-medium text-muted"
              >
                <span>
                  {t(`scoresheetStatus.${sheet.status}` as DictionaryKey)}
                  {sheet.isActive ? ` · ${t("review.active")}` : ""}
                </span>
                <span>{formatDateTime(sheet.createdAt, timezone)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
