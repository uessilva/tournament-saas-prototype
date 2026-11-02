"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  TrophyIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import {
  generateDrawAction,
  regenerateDrawSeedAction,
  saveDrawConfigAction,
  swapDrawEntrantsAction,
  type DrawActionState,
} from "@/features/competitions/draw-actions";
import type {
  AdminCompetitionData,
  DrawFixtureView,
} from "@/features/competitions/types";
import { groupDisplayName, knockoutRoundLabel, matchSideName } from "@/features/public/labels";

const EMPTY_STATE: DrawActionState = { status: "idle" };

function Feedback({ state }: { state: DrawActionState }) {
  const { t } = useI18n();
  if (state.status === "idle") {
    return null;
  }

  if (state.status === "error") {
    const keys: Partial<Record<string, DictionaryKey>> = {
      registration_open: "draw.errorRegistrationOpen",
      ineligible_entrants: "draw.errorIneligible",
      not_enough_entrants: "draw.errorNotEnough",
      group_below_min: "draw.errorGroupMinimum",
      insufficient_qualifiers: "draw.errorQualifiers",
      invalid_group_count: "draw.errorGroupCount",
      invalid_qualifiers: "draw.errorQualifierCount",
      invalid_swap: "draw.errorSwap",
      draw_locked: "draw.errorLocked",
      cancelled_match_exists: "draw.errorCancelledMatch",
      competition_locked: "draw.errorCompetitionLocked",
      unsupported_format: "draw.errorFormat",
      invalid_format: "draw.errorFormat",
      format_locked: "draw.errorFormatLocked",
      action_failed: "draw.errorFailed",
    };
    return (
      <p role="alert" className="mt-2 text-xs font-bold text-red-700">
        {t(keys[state.code ?? ""] ?? "draw.errorFailed")}
      </p>
    );
  }

  const keys: Partial<Record<string, DictionaryKey>> = {
    draw_saved: "draw.saved",
    draw_generated: "draw.generated",
    seed_regenerated: "draw.seedRegenerated",
    entrant_swapped: "draw.entrantSwapped",
  };
  return (
    <p
      role="status"
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-soft-green px-2.5 py-1.5 text-[11px] font-extrabold text-green"
    >
      <CheckIcon className="size-3.5" />
      {t(keys[state.code ?? ""] ?? "draw.saved")}
    </p>
  );
}

function SubmitButton({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-green px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("common.loading") : label}
      {pending ? null : <ArrowRightIcon className="size-3.5" />}
    </button>
  );
}

function fixtureName(
  fixture: DrawFixtureView,
  side: "home" | "away",
  totalRounds: number,
  t: (key: DictionaryKey) => string,
) {
  const view = fixture[side];
  return matchSideName(view.teamName, view.source, totalRounds, t);
}

function GroupCard({
  group,
  qualifiers,
}: {
  group: AdminCompetitionData["draw"]["groups"][number];
  qualifiers: number;
}) {
  const { t } = useI18n();
  return (
    <article className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-extrabold">
          {groupDisplayName(group.name, t)}
        </h4>
        <span className="rounded-full bg-soft-green px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-green">
          {t("draw.qualifiersBadge").replace("{count}", String(qualifiers))}
        </span>
      </div>
      <ol className="mt-3 space-y-1.5">
        {group.entrants.map((entrant, index) => (
          <li
            key={entrant.teamId}
            className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs ${
              index < qualifiers ? "bg-soft-green/70" : "bg-paper"
            }`}
          >
            <span className="font-bold">{entrant.name}</span>
            <span className="text-[9px] font-extrabold text-muted">
              {index + 1}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

export function DrawAdminPanel({ data }: { data: AdminCompetitionData }) {
  const { t } = useI18n();
  const draw = data.draw;
  const [configState, configAction] = useActionState(
    saveDrawConfigAction,
    EMPTY_STATE,
  );
  const [seedState, seedAction] = useActionState(
    regenerateDrawSeedAction,
    EMPTY_STATE,
  );
  const [swapState, swapAction] = useActionState(
    swapDrawEntrantsAction,
    EMPTY_STATE,
  );
  const [generateState, generateAction] = useActionState(
    generateDrawAction,
    EMPTY_STATE,
  );

  const maxGroups = Math.max(
    2,
    Math.min(8, Math.floor(data.entrants.length / 2)),
  );
  const groupOptions = Array.from(
    { length: Math.max(0, maxGroups - 1) },
    (_, index) => index + 2,
  );
  const cancelled = data.competition.status === "cancelled";
  const canEdit = draw.canEdit && !cancelled;
  const validationErrors = draw.validationErrors;
  const registrationOpen = data.competition.registrationOpen;
  const isGroups = draw.format === "groups_knockout";
  const formatLocked = draw.generated;
  const formatOptions = [
    "round_robin",
    "single_elimination",
    "groups_knockout",
  ] as const;

  return (
    <section id="draw" className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-green">{t("draw.eyebrow")}</p>
          <h2 className="display-title mt-2 text-3xl">
            {isGroups
              ? t("draw.title")
              : t(`format.${draw.format}` as DictionaryKey)}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {isGroups ? t("draw.body") : t("draw.formatHint")}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${
            draw.generated
              ? "bg-soft-green text-green"
              : "bg-cream text-muted"
          }`}
        >
          {draw.generated ? t("draw.generatedBadge") : t("draw.previewBadge")}
        </span>
      </div>

      {cancelled ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          {t("compLifecycle.mutationsBlocked")}
        </p>
      ) : draw.confirmedResultExists ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-soft-orange p-3 text-xs font-bold text-clay">
          <LockIcon className="mt-0.5 size-4 shrink-0" />
          {t("draw.lockedNotice")}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl bg-paper p-4 text-xs">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
              {t("competition.drawSeed")}
            </dt>
            <dd className="mt-0.5 break-all font-bold">{draw.seed}</dd>
          </div>
          <div>
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
              {t("competition.format")}
            </dt>
            <dd className="mt-0.5 font-bold">
              {t(`format.${draw.format}` as DictionaryKey)}
            </dd>
          </div>
          <div>
            <dt className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
              {isGroups ? t("draw.qualifierRule") : t("draw.bracketSize")}
            </dt>
            <dd className="mt-0.5 font-bold">
              {isGroups
                ? t("draw.qualifierRuleValue")
                    .replace("{groups}", String(draw.groupCount))
                    .replace(
                      "{qualifiers}",
                      String(draw.qualifiersPerGroup),
                    )
                : draw.format === "round_robin"
                  ? t("draw.roundRobinValue").replace(
                      "{count}",
                      String(data.entrants.length),
                    )
                  : t("draw.bracketSizeValue")
                      .replace("{size}", String(draw.bracketSize))
                      .replace(
                        "{rounds}",
                        String(draw.knockoutRoundCount),
                      )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form action={configAction} className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-extrabold">{t("draw.configTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("draw.configBody")}
          </p>
          <input type="hidden" name="eventId" value={data.event.id} />
          <input type="hidden" name="competitionId" value={data.competition.id} />
          <input type="hidden" name="seed" value={draw.seed} />
          <div className="mt-3">
            <label
              htmlFor="draw-format"
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              {t("draw.format")}
            </label>
            <select
              id="draw-format"
              name="format"
              defaultValue={draw.format}
              disabled={!canEdit || formatLocked}
              className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
            >
              {formatOptions.map((format) => (
                <option key={format} value={format}>
                  {t(`format.${format}` as DictionaryKey)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] font-medium text-muted">
              {formatLocked
                ? t("draw.formatLocked")
                : t("draw.formatHint")}
            </p>
          </div>
          {isGroups ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="draw-group-count"
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
                >
                  {t("draw.groupCount")}
                </label>
                <select
                  id="draw-group-count"
                  name="groupCount"
                  defaultValue={String(draw.groupCount)}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
                >
                  {groupOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="draw-qualifier-count"
                  className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
                >
                  {t("draw.qualifiersPerGroup")}
                </label>
                <select
                  id="draw-qualifier-count"
                  name="qualifiersPerGroup"
                  defaultValue={String(draw.qualifiersPerGroup)}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
                >
                  <option value="1">{t("draw.oneQualifier")}</option>
                  <option value="2">{t("draw.twoQualifiers")}</option>
                </select>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-[11px] leading-5 text-muted">
              {t("draw.directEntrantsHint")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <SubmitButton
              label={t("draw.saveConfig")}
              disabled={!canEdit}
            />
          </div>
          <Feedback state={configState} />
        </form>

        <div className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-extrabold">{t("draw.regenerateTitle")}</h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {t("draw.regenerateBody")}
          </p>
          <form action={seedAction} className="mt-3">
            <input type="hidden" name="eventId" value={data.event.id} />
            <input type="hidden" name="competitionId" value={data.competition.id} />
            <input type="hidden" name="format" value={draw.format} />
            <input type="hidden" name="groupCount" value={draw.groupCount} />
            <input
              type="hidden"
              name="qualifiersPerGroup"
              value={draw.qualifiersPerGroup}
            />
            <SubmitButton
              label={t("draw.regenerate")}
              disabled={!canEdit}
            />
          </form>
          <Feedback state={seedState} />

          <form action={swapAction} className="mt-4 space-y-2 border-t border-line pt-4">
            <input type="hidden" name="eventId" value={data.event.id} />
            <input type="hidden" name="competitionId" value={data.competition.id} />
            <input type="hidden" name="format" value={draw.format} />
            <label
              htmlFor="draw-swap-first"
              className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
            >
              {t("draw.swapTitle")}
            </label>
            <select
              id="draw-swap-first"
              name="firstTeamId"
              defaultValue={data.entrants[0]?.id ?? ""}
              disabled={!canEdit}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
            >
              {data.entrants.map((entrant) => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              ))}
            </select>
            <select
              name="secondTeamId"
              aria-label={t("draw.swapSecond")}
              defaultValue={data.entrants[1]?.id ?? ""}
              disabled={!canEdit}
              className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none disabled:opacity-60"
            >
              {data.entrants.map((entrant) => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              ))}
            </select>
            <SubmitButton
              label={t("draw.swapAction")}
              disabled={!canEdit || data.entrants.length < 2}
            />
            <Feedback state={swapState} />
          </form>
        </div>
      </div>

      {validationErrors.length ? (
        <ul className="mt-4 space-y-1 rounded-xl bg-soft-orange p-3 text-xs font-bold text-clay">
          {validationErrors.map((error) => (
            <li key={error}>
              {t(
                ({
                  not_enough_entrants: "draw.errorNotEnough",
                  ineligible_entrants: "draw.errorIneligible",
                  invalid_format: "draw.errorFormat",
                  invalid_group_count: "draw.errorGroupCount",
                  invalid_qualifiers: "draw.errorQualifierCount",
                  group_below_min: "draw.errorGroupMinimum",
                  insufficient_qualifiers: "draw.errorQualifiers",
                } as Partial<Record<string, DictionaryKey>>)[error] ??
                  "draw.errorFailed",
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form action={generateAction} className="mt-5 rounded-xl bg-ink p-4 text-white">
        <input type="hidden" name="eventId" value={data.event.id} />
        <input type="hidden" name="competitionId" value={data.competition.id} />
        <input type="hidden" name="format" value={draw.format} />
        <input type="hidden" name="seed" value={draw.seed} />
        <input type="hidden" name="groupCount" value={draw.groupCount} />
        <input
          type="hidden"
          name="qualifiersPerGroup"
          value={draw.qualifiersPerGroup}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold">{t("draw.generateTitle")}</p>
            <p className="mt-1 max-w-md text-[11px] leading-5 text-white/60">
              {t("draw.generateBody")}
            </p>
            {registrationOpen ? (
              <p className="mt-1 text-[11px] font-bold text-lime">
                {t("draw.registrationOpenHint")}
              </p>
            ) : null}
          </div>
          <SubmitButton
            label={
              draw.generated ? t("draw.regenerateDraw") : t("draw.generate")
            }
            disabled={
              !canEdit ||
              validationErrors.length > 0 ||
              data.entrants.length < 2 ||
              registrationOpen
            }
          />
        </div>
        <Feedback state={generateState} />
      </form>

      <div className="mt-6 space-y-4">
        <div className="flex items-center gap-2">
          <TrophyIcon className="size-4 text-green" />
          <h3 className="text-sm font-extrabold">{t("draw.previewTitle")}</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {draw.groups.map((group) => (
            <GroupCard
              key={group.id ?? group.name}
              group={group}
              qualifiers={draw.qualifiersPerGroup}
            />
          ))}
        </div>

        {draw.groupFixtures.length ? (
          <div className="rounded-xl border border-line p-4">
            <h4 className="text-sm font-extrabold">{t("draw.groupFixtures")}</h4>
            <ul className="mt-3 space-y-1.5 text-xs">
              {draw.groupFixtures.slice(0, 24).map((fixture, index) => (
                <li
                  key={fixture.id ?? `${fixture.groupName}-${index}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-paper px-2.5 py-1.5"
                >
                  <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-muted">
                    {draw.format === "round_robin"
                      ? t("fixtures.leagueRound").replace(
                          "{round}",
                          String(fixture.roundNumber),
                        )
                      : t("fixtures.groupRound")
                          .replace(
                            "{group}",
                            groupDisplayName(fixture.groupName, t),
                          )
                          .replace("{round}", String(fixture.roundNumber))}
                  </span>
                  <span className="font-bold">
                    {fixtureName(fixture, "home", draw.knockoutRoundCount, t)}
                  </span>
                  <span className="text-muted">{t("match.vs")}</span>
                  <span className="font-bold">
                    {fixtureName(fixture, "away", draw.knockoutRoundCount, t)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {draw.knockoutFixtures.length ? (
          <div className="rounded-xl border border-line p-4">
            <h4 className="text-sm font-extrabold">{t("competition.knockout")}</h4>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {Array.from(
                { length: draw.knockoutRoundCount },
                (_, index) => index + 1,
              ).map((roundNumber) => (
                <div key={roundNumber} className="rounded-xl bg-paper p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                    {knockoutRoundLabel(
                      roundNumber,
                      draw.knockoutRoundCount,
                      t,
                    )}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-xs">
                    {draw.knockoutFixtures
                      .filter(
                        (fixture) => fixture.roundNumber === roundNumber,
                      )
                      .map((fixture) => (
                        <li
                          key={fixture.id ?? `${roundNumber}-${fixture.bracketSlot}`}
                          className="rounded-lg bg-white px-2.5 py-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-bold">
                              {fixtureName(
                                fixture,
                                "home",
                                draw.knockoutRoundCount,
                                t,
                              )}
                            </span>
                            <span className="text-muted">{t("match.vs")}</span>
                            <span className="font-bold">
                              {fixtureName(
                                fixture,
                                "away",
                                draw.knockoutRoundCount,
                                t,
                              )}
                            </span>
                            {fixture.isBye ? (
                              <span className="rounded-full bg-cream px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.08em] text-muted">
                                {t("draw.byeBadge")}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {draw.generated ? (
        <div className="mt-5 rounded-xl bg-soft-green p-4 text-xs leading-5 text-green">
          <p className="font-extrabold">{t("draw.nextStepTitle")}</p>
          <p className="mt-1">{t("draw.nextStepBody")}</p>
          <Link
            href={`/admin/events/${data.event.id}/schedule`}
            className="mt-2 inline-flex items-center gap-1 font-extrabold text-green underline underline-offset-2 hover:text-green-deep"
          >
            {t("draw.openSchedule")}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
