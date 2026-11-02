"use client";

import { useActionState } from "react";

import { LockIcon } from "@/components/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { DisputeRecord } from "@/features/disputes/queries";
import type { ManagerFixtureTeam } from "@/features/matches/manager-queries";
import {
  openDisputeAction,
  type DisputeActionState,
} from "@/features/disputes/actions";

const EMPTY: DisputeActionState = { status: "idle" };

function statusTone(status: DisputeRecord["status"]) {
  if (status === "open") return "bg-soft-orange text-clay";
  if (status === "resolved") return "bg-soft-green text-green";
  return "bg-cream text-muted";
}

function DisputeHistoryItem({ dispute }: { dispute: DisputeRecord }) {
  const { t, formatDateTime } = useI18n();

  return (
    <li className="rounded-xl border border-line bg-paper/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${statusTone(
            dispute.status,
          )}`}
        >
          {t(`disputes.status.${dispute.status}` as DictionaryKey)}
        </span>
        <span className="text-[10px] font-bold text-muted">
          {dispute.openedByName ?? dispute.openedByEmail ?? t("disputes.unknownUser")}
          <span aria-hidden="true"> · </span>
          {formatDateTime(dispute.openedAt, dispute.eventTimezone)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-ink">
        {dispute.explanation}
      </p>
      {dispute.response ? (
        <div className="mt-2 rounded-lg bg-white px-3 py-2">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("disputes.responseLabel")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">
            {dispute.response}
          </p>
          <p className="mt-1 text-[10px] font-bold text-muted">
            {dispute.resolvedByName ??
              dispute.resolvedByEmail ??
              t("disputes.unknownUser")}
            {dispute.resolvedAt ? (
              <>
                <span aria-hidden="true"> · </span>
                {formatDateTime(dispute.resolvedAt, dispute.eventTimezone)}
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
    </li>
  );
}

export function ManagerDisputeActions({
  matchId,
  matchStatus,
  timezone,
  disputes,
  managedTeams,
}: {
  matchId: string;
  matchStatus: string;
  timezone: string;
  disputes: DisputeRecord[];
  managedTeams: ManagerFixtureTeam[];
}) {
  const { t, formatDateTime } = useI18n();
  const [state, action] = useActionState(openDisputeAction, EMPTY);
  const active = disputes.find((dispute) => dispute.status === "open") ?? null;
  const history = disputes.filter((dispute) => dispute.status !== "open");
  const published = matchStatus === "published";

  if (!published) {
    return null;
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-paper/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
            <LockIcon className="size-3" />
            {t("disputes.manager.title")}
          </span>
          {active ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${statusTone(
                active.status,
              )}`}
            >
              {t("disputes.status.open")}
            </span>
          ) : (
            <span className="rounded-full bg-cream px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
              {t("disputes.manager.none")}
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold text-muted">
          {t("disputes.manager.privateHint")}
        </span>
      </div>

      {active ? (
        <div className="mt-2 rounded-lg border border-orange/30 bg-soft-orange/60 px-3 py-2">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-clay">
            {t("disputes.manager.activeTitle")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-ink">
            {active.explanation}
          </p>
          <p className="mt-1 text-[10px] font-bold text-muted">
            {active.openedByName ?? active.openedByEmail ?? t("disputes.unknownUser")}
            <span aria-hidden="true"> · </span>
            {formatDateTime(active.openedAt, timezone)}
          </p>
          <p className="mt-2 text-[10px] font-semibold text-clay">
            {t("disputes.manager.duplicateBlocked")}
          </p>
        </div>
      ) : (
        <form action={action} className="mt-2 space-y-2">
          <input type="hidden" name="matchId" value={matchId} />
          {managedTeams.length > 1 ? (
            <div>
              <label
                htmlFor={`dispute-team-${matchId}`}
                className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
              >
                {t("disputes.manager.teamLabel")}
              </label>
              <select
                id={`dispute-team-${matchId}`}
                name="teamId"
                required
                defaultValue={managedTeams[0]?.id}
                className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-bold text-ink outline-none focus:border-green"
              >
                {managedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="teamId" value={managedTeams[0]?.id ?? ""} />
          )}

          <div>
            <label
              htmlFor={`dispute-explanation-${matchId}`}
              className="block text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted"
            >
              {t("disputes.manager.explanationLabel")}
            </label>
            <textarea
              id={`dispute-explanation-${matchId}`}
              name="explanation"
              required
              minLength={10}
              maxLength={4000}
              rows={3}
              aria-describedby={`dispute-explanation-hint-${matchId}${
                state.fieldErrors?.explanation
                  ? ` dispute-explanation-error-${matchId}`
                  : ""
              }`}
              aria-invalid={state.fieldErrors?.explanation ? true : undefined}
              className="mt-1 w-full rounded-lg border border-line bg-white px-2.5 py-2 text-xs leading-5 text-ink outline-none focus:border-green"
              placeholder={t("disputes.manager.explanationPlaceholder")}
            />
            <p
              id={`dispute-explanation-hint-${matchId}`}
              className="mt-1 text-[10px] font-medium text-muted"
            >
              {t("disputes.manager.explanationHint")}
            </p>
            {state.fieldErrors?.explanation ? (
              <p
                id={`dispute-explanation-error-${matchId}`}
                role="alert"
                className="mt-1 text-[10px] font-bold text-red-700"
              >
                {t(
                  `disputes.error.${state.fieldErrors.explanation}` as DictionaryKey,
                )}
              </p>
            ) : null}
          </div>

          {state.status === "error" && state.code !== "invalid_input" ? (
            <p role="alert" className="text-[10px] font-bold text-red-700">
              {t(`disputes.error.${state.code ?? "action_failed"}` as DictionaryKey)}
            </p>
          ) : null}
          {state.status === "success" ? (
            <p role="status" className="text-[10px] font-bold text-green">
              {t("disputes.manager.openedNotice")}
            </p>
          ) : null}

          <SubmitButton
            label={t("disputes.manager.openAction")}
            pendingLabel={t("disputes.manager.opening")}
            tone="pillDark"
            arrowClassName="size-3"
          />
        </form>
      )}

      <p className="mt-2 text-[10px] font-medium leading-4 text-muted">
        {t("disputes.manager.publicUnaffected")}
      </p>

      {history.length ? (
        <div className="mt-3 border-t border-line pt-2">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-muted">
            {t("disputes.manager.historyTitle")} ({history.length})
          </p>
          <ul className="mt-2 space-y-2">
            {history.map((dispute) => (
              <DisputeHistoryItem key={dispute.id} dispute={dispute} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
