"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  CheckIcon,
  LockIcon,
  PlusIcon,
  ShirtIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import {
  addParticipantAction,
  removeParticipantAction,
  updateParticipantAction,
  type RosterActionState,
} from "@/features/teams/roster-actions";
import type { RosterParticipant } from "@/features/teams/types";

const EMPTY_STATE: RosterActionState = { status: "idle" };

function errorKey(state: RosterActionState): DictionaryKey | null {
  switch (state.code) {
    case "registration_closed":
      return "manage.registrationClosedEdit";
    case "competition_cancelled":
      return "manage.competitionCancelled";
    case "tennis_single_participant":
      return "manage.tennisSingleBlocked";
    case "roster_maximum":
      return "manage.rosterMaximumBlocked";
    case "roster_minimum":
      return "manage.rosterMinimumBlocked";
    case "birth_range":
      return "manage.birthRangeBlocked";
    case "duplicate_participant":
      return "manage.duplicateParticipant";
    case "participant_not_found":
      return "manage.participantNotFound";
    case "team_not_found":
      return "manage.teamNotFound";
    case "fix_errors":
      return "manage.fixErrors";
    case "action_failed":
      return "manage.actionFailed";
    default:
      return null;
  }
}

function FormFeedback({
  state,
  id,
}: {
  state: RosterActionState;
  id?: string;
}) {
  const { t } = useI18n();
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "success") {
    const key =
      state.code === "participant_added"
        ? "manage.participantAdded"
        : state.code === "participant_updated"
          ? "manage.participantUpdated"
          : "manage.participantRemoved";
    return (
      <p
        id={id}
        role="status"
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-soft-green px-2.5 py-1.5 text-[11px] font-extrabold text-green"
      >
        <CheckIcon className="size-3.5" />
        {t(key)}
      </p>
    );
  }

  const key = errorKey(state);
  return (
    <p id={id} role="alert" className="mt-2 text-xs font-bold text-red-700">
      {key ? t(key) : t("manage.actionFailed")}
    </p>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
}: {
  label: string;
  pendingLabel: string;
  tone?: "primary" | "quiet" | "danger";
}) {
  const { pending } = useFormStatus();
  const className =
    tone === "primary"
      ? "inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green disabled:cursor-wait disabled:opacity-70"
      : tone === "danger"
        ? "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-muted transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
        : "inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] font-extrabold text-muted transition-colors hover:border-green hover:text-green disabled:cursor-wait disabled:opacity-60";

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function ParticipantFields({
  participant,
  idPrefix,
  compact = false,
  invalid = false,
  describedBy,
}: {
  participant?: RosterParticipant;
  idPrefix: string;
  compact?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const inputClass =
    "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-green focus:outline-none";

  return (
    <>
      <div className={compact ? "grid gap-1" : "grid gap-1"}>
        <label
          htmlFor={`${idPrefix}-first`}
          className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t("manage.firstName")}
        </label>
        <input
          id={`${idPrefix}-first`}
          name="firstName"
          required
          maxLength={80}
          defaultValue={participant?.firstName ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label
          htmlFor={`${idPrefix}-last`}
          className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t("manage.lastName")}
        </label>
        <input
          id={`${idPrefix}-last`}
          name="lastName"
          required
          maxLength={80}
          defaultValue={participant?.lastName ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label
          htmlFor={`${idPrefix}-dob`}
          className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t("manage.dateOfBirth")}
        </label>
        <input
          id={`${idPrefix}-dob`}
          name="dateOfBirth"
          type="date"
          required
          defaultValue={participant?.dateOfBirth ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label
          htmlFor={`${idPrefix}-shirt`}
          className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t("manage.shirtNumber")}
        </label>
        <input
          id={`${idPrefix}-shirt`}
          name="shirtNumber"
          type="number"
          min={1}
          max={99}
          defaultValue={participant?.shirtNumber ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
      </div>
      <div className="grid gap-1">
        <label
          htmlFor={`${idPrefix}-position`}
          className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted"
        >
          {t("manage.positionLabel")}
        </label>
        <input
          id={`${idPrefix}-position`}
          name="position"
          maxLength={40}
          defaultValue={participant?.position ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClass}
        />
      </div>
      <label className="flex items-end gap-2 pb-1.5 text-[11px] font-bold">
        <input
          type="checkbox"
          name="isCaptain"
          defaultChecked={participant?.isCaptain ?? false}
          className="size-4 rounded border-line accent-green"
        />
        {t("manage.isCaptain")}
      </label>
    </>
  );
}

function ParticipantRow({
  participant,
  teamId,
  canEdit,
}: {
  participant: RosterParticipant;
  teamId: string;
  canEdit: boolean;
}) {
  const { t, formatDate } = useI18n();
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction] = useActionState(
    updateParticipantAction,
    EMPTY_STATE,
  );
  const [removeState, removeAction] = useActionState(
    removeParticipantAction,
    EMPTY_STATE,
  );

  useEffect(() => {
    if (updateState.status === "success") {
      setEditing(false);
    }
  }, [updateState.status]);

  if (editing) {
    return (
      <tr className="border-b border-line/70 bg-paper/60 last:border-b-0">
        <td colSpan={5} className="px-4 py-4">
          <form action={updateAction} className="space-y-3">
            <input type="hidden" name="teamId" value={teamId} />
            <input type="hidden" name="participantId" value={participant.id} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <ParticipantFields
                participant={participant}
                idPrefix={`edit-${participant.id}`}
                compact
                invalid={updateState.status === "error"}
                describedBy={
                  updateState.status === "error"
                    ? `edit-${participant.id}-error`
                    : undefined
                }
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton
                label={t("manage.saveParticipant")}
                pendingLabel={t("manage.saving")}
              />
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold text-muted hover:text-ink"
              >
                {t("manage.cancel")}
              </button>
            </div>
            <FormFeedback
              state={updateState}
              id={`edit-${participant.id}-error`}
            />
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-line/70 last:border-b-0">
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 font-extrabold text-muted">
          <ShirtIcon className="size-3.5" />
          {participant.shirtNumber ?? "—"}
        </span>
      </td>
      <td className="px-4 py-3 font-bold">
        {participant.firstName} {participant.lastName}
      </td>
      <td className="px-4 py-3 text-muted">{participant.position ?? "—"}</td>
      <td className="px-4 py-3 text-muted">
        {formatDate(participant.dateOfBirth, "UTC", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {participant.isCaptain ? (
            <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] font-extrabold text-ink">
              {t("manage.captain")}
            </span>
          ) : null}
          {canEdit ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg px-2 py-1 text-[11px] font-extrabold text-green hover:bg-soft-green"
              >
                {t("manage.edit")}
              </button>
              <form
                action={removeAction}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      t("manage.removeConfirm")
                        .replace(
                          "{name}",
                          `${participant.firstName} ${participant.lastName}`,
                        )
                        .replace("{team}", t("manage.rosterTitle")),
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="teamId" value={teamId} />
                <input
                  type="hidden"
                  name="participantId"
                  value={participant.id}
                />
                <SubmitButton
                  label={t("manage.remove")}
                  pendingLabel={t("manage.removing")}
                  tone="danger"
                />
              </form>
            </>
          ) : null}
        </div>
        <FormFeedback state={removeState} />
      </td>
    </tr>
  );
}

export function RosterEditor({
  teamId,
  participants,
  canEdit,
  sport,
  rosterMin,
  rosterMax,
}: {
  teamId: string;
  participants: RosterParticipant[];
  canEdit: boolean;
  sport: "football" | "tennis";
  rosterMin: number | null;
  rosterMax: number | null;
}) {
  const { t } = useI18n();
  const [addState, addAction] = useActionState(
    addParticipantAction,
    EMPTY_STATE,
  );

  const limitLabel =
    sport === "tennis"
      ? t("competition.singleEntry")
      : rosterMin != null && rosterMax != null
        ? t("competition.rosterLimitValue")
            .replace("{min}", String(rosterMin))
            .replace("{max}", String(rosterMax))
        : null;

  return (
    <section className="surface mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow text-green">{t("manage.rosterTitle")}</p>
          <h2 className="display-title mt-1 text-2xl">
            {t("manage.playerCount").replace(
              "{count}",
              String(participants.length),
            )}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {limitLabel ? (
            <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold text-muted">
              {limitLabel}
            </span>
          ) : null}
          {canEdit ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-soft-green px-2.5 py-1 text-[10px] font-extrabold text-green">
              <CheckIcon className="size-3" />
              {t("manage.rosterEditingOpen")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-cream px-2.5 py-1 text-[10px] font-extrabold text-muted">
              <LockIcon className="size-3" />
              {t("manage.registrationClosed")}
            </span>
          )}
        </div>
      </div>

      <div
        className="overflow-x-auto"
        role="region"
        aria-label={t("manage.rosterTitle")}
        tabIndex={0}
      >
        <table className="w-full min-w-[660px] text-left text-sm">
          <caption className="sr-only">{t("manage.rosterTitle")}</caption>
          <thead>
            <tr className="border-b border-line bg-paper/60 text-[10px] uppercase tracking-[0.1em] text-muted">
              <th scope="col" className="px-4 py-3 font-extrabold">{t("manage.shirt")}</th>
              <th scope="col" className="px-4 py-3 font-extrabold">
                {t("competition.players")}
              </th>
              <th scope="col" className="px-4 py-3 font-extrabold">{t("manage.position")}</th>
              <th scope="col" className="px-4 py-3 font-extrabold">{t("manage.birthDate")}</th>
              <th scope="col" className="px-4 py-3 font-extrabold">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                teamId={teamId}
                canEdit={canEdit}
              />
            ))}
            {!participants.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  {t("manage.emptyRoster")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="border-t border-line bg-paper/40 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-soft-green text-green">
              <PlusIcon className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-extrabold">
                {t("manage.addParticipantTitle")}
              </h3>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {t("manage.addParticipantBody")}
              </p>
            </div>
          </div>

          <form
            key={addState.participantId ?? "add-form"}
            action={addAction}
            className="mt-4 space-y-3"
          >
            <input type="hidden" name="teamId" value={teamId} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <ParticipantFields
                idPrefix="add-participant"
                invalid={addState.status === "error"}
                describedBy={
                  addState.status === "error"
                    ? "roster-add-error"
                    : undefined
                }
              />
            </div>
            {sport === "tennis" && participants.length >= 1 ? (
              <p className="rounded-lg bg-soft-orange px-3 py-2 text-[11px] font-bold text-clay">
                {t("manage.tennisSingleBlocked")}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton
                label={t("manage.addParticipant")}
                pendingLabel={t("manage.adding")}
              />
              {rosterMax != null ? (
                <span className="text-[11px] font-semibold text-muted">
                  {t("manage.rosterMaxHint")
                    .replace("{count}", String(participants.length))
                    .replace("{max}", String(rosterMax))}
                </span>
              ) : null}
            </div>
            <FormFeedback state={addState} id="roster-add-error" />
          </form>
        </div>
      ) : (
        <div className="border-t border-line bg-cream/70 p-5">
          <div className="flex items-start gap-3">
            <LockIcon className="mt-0.5 size-4 text-muted" />
            <div>
              <p className="text-sm font-extrabold">
                {t("manage.registrationClosedTitle")}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted">
                {t("manage.registrationClosedEdit")}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
