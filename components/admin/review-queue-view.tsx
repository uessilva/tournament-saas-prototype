"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  RefreshIcon,
} from "@/components/icons";
import { MatchStatusBadge, SportTag } from "@/components/public/badges";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type {
  ReviewQueueData,
  ReviewQueueItem,
} from "@/features/scoresheets/queries";
import {
  uploadScoresheetAction,
  type ScoresheetActionState,
} from "@/features/scoresheets/actions";

const EMPTY: ScoresheetActionState = { status: "idle" };

function StatusChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${tone}`}
    >
      {label}
    </span>
  );
}

function sheetTone(status: string | null | undefined) {
  if (status === "needs_review") return "bg-soft-orange text-clay";
  if (status === "confirmed") return "bg-soft-green text-green";
  if (status === "extraction_failed" || status === "rejected")
    return "bg-red-50 text-red-700";
  if (status === "processing" || status === "uploaded")
    return "bg-cream text-muted";
  return "bg-cream text-muted";
}

function DemoUploadForm({ item }: { item: ReviewQueueItem }) {
  const { t } = useI18n();
  const [state, action] = useActionState(uploadScoresheetAction, EMPTY);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="matchId" value={item.matchId} />
      <button
        type="submit"
        name="intent"
        value="demo_digital"
        className="inline-flex items-center gap-1.5 rounded-full border border-green/30 bg-soft-green px-3 py-1.5 text-[10px] font-extrabold text-green transition-colors hover:border-green"
      >
        {t("review.demoDigital")}
      </button>
      <button
        type="submit"
        name="intent"
        value="demo_scan"
        className="inline-flex items-center gap-1.5 rounded-full border border-clay/30 bg-soft-orange px-3 py-1.5 text-[10px] font-extrabold text-clay transition-colors hover:border-clay"
      >
        {t("review.demoScan")}
      </button>
      {state.status === "error" ? (
        <span role="alert" className="text-[10px] font-bold text-red-700">
          {t(`review.error.${state.code ?? "action_failed"}` as DictionaryKey)}
        </span>
      ) : null}
    </form>
  );
}

function QueueCard({
  item,
  event,
  demoMode,
}: {
  item: ReviewQueueItem;
  event: ReviewQueueData["event"];
  demoMode: boolean;
}) {
  const { t, formatDateTime } = useI18n();
  const active = item.activeScoresheet;
  const canEnterResult =
    item.matchStatus !== "published" &&
    item.matchStatus !== "cancelled" &&
    item.competitionStatus !== "cancelled";

  return (
    <article className="border-b border-line/80 py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
        <SportTag sport={item.sport} />
        <span>#{item.matchNumber}</span>
        <span>{item.competitionName}</span>
        {item.startsAt ? (
          <span className="inline-flex items-center gap-1 normal-case tracking-normal">
            <ClockIcon className="size-3" />
            {formatDateTime(item.startsAt, event.timezone)}
          </span>
        ) : null}
        {item.venueName ? <span>{item.venueName}</span> : null}
      </div>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold">
            {item.homeTeamName ?? t("match.tbd")}{" "}
            <span className="text-xs font-bold text-muted">{t("match.vs")}</span>{" "}
            {item.awayTeamName ?? t("match.tbd")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <MatchStatusBadge status={item.matchStatus} />
            {item.competitionStatus === "cancelled" ? (
              <StatusChip
                label={t("compLifecycle.cancelledTitle")}
                tone="bg-red-50 text-red-700"
              />
            ) : null}
            {active ? (
              <StatusChip
                label={t(`scoresheetStatus.${active.status}` as DictionaryKey)}
                tone={sheetTone(active.status)}
              />
            ) : (
              <StatusChip
                label={t("review.noScoresheet")}
                tone="bg-cream text-muted"
              />
            )}
            {active?.extractionSource ? (
              <StatusChip
                label={
                  active.extractionSource === "seeded_fallback"
                    ? t("review.sourceFallback")
                    : active.extractionSource === "acroform"
                      ? t("review.sourceAcroform")
                      : t("review.sourceQr")
                }
                tone={
                  active.extractionSource === "seeded_fallback"
                    ? "bg-soft-orange text-clay"
                    : "bg-soft-green text-green"
                }
              />
            ) : null}
            {active && active.flaggedFields > 0 ? (
              <StatusChip
                label={t("review.flaggedCount").replace(
                  "{count}",
                  String(active.flaggedFields),
                )}
                tone="bg-soft-orange text-clay"
              />
            ) : null}
            {item.historyCount > 1 ? (
              <StatusChip
                label={t("review.historyCount").replace(
                  "{count}",
                  String(item.historyCount),
                )}
                tone="bg-cream text-muted"
              />
            ) : null}
          </div>
          {active?.failureReason ? (
            <p role="alert" className="mt-2 text-xs font-bold text-red-700">
              {active.failureReason}
            </p>
          ) : null}
          {active?.rejectionReason ? (
            <p className="mt-2 text-xs font-bold text-red-700">
              {active.rejectionReason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Link
            href={`/admin/events/${event.id}/review/${item.matchId}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            {active?.status === "needs_review"
              ? t("review.openReview")
              : canEnterResult
                ? t("review.openMatch")
                : t("review.viewHistory")}
            <ArrowRightIcon className="size-3.5" />
          </Link>
          {canEnterResult && !active ? (
            <>
              <a
                href={`/api/matches/${item.matchId}/scoresheet-template`}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[10px] font-extrabold text-muted transition-colors hover:border-green hover:text-green"
              >
                {t("review.downloadTemplate")}
              </a>
              {demoMode ? <DemoUploadForm item={item} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ReviewQueueView({
  data,
  user,
  demoMode,
}: {
  data: ReviewQueueData;
  user: { name: string | null; email: string | null };
  demoMode: boolean;
}) {
  const { t } = useI18n();
  const actionable = data.items.filter(
    (item) =>
      item.matchStatus !== "cancelled" &&
      item.competitionStatus !== "cancelled",
  );
  const pending = actionable.filter(
    (item) =>
      item.activeScoresheet &&
      ["uploaded", "processing", "needs_review"].includes(
        item.activeScoresheet.status,
      ),
  );
  const awaiting = actionable.filter(
    (item) => !item.activeScoresheet && item.matchStatus !== "published",
  );
  const failed = actionable.filter(
    (item) =>
      item.activeScoresheet &&
      ["extraction_failed", "rejected"].includes(item.activeScoresheet.status),
  );
  const published = data.items.filter(
    (item) =>
      item.matchStatus === "published" &&
      item.competitionStatus !== "cancelled",
  );
  const cancelled = data.items.filter(
    (item) =>
      item.matchStatus === "cancelled" ||
      item.competitionStatus === "cancelled",
  );
  const hasCancelledCompetition = data.items.some(
    (item) => item.competitionStatus === "cancelled",
  );

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}/results`}
        secondaryHref={`/admin/events/${data.event.id}`}
        secondaryLabel={t("review.backToDashboard")}
      />

      <main id="main-content" className="page-shell py-8">
        <Link
          href={`/admin/events/${data.event.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("review.backToDashboard")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("review.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("review.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("review.body")}
            </p>
          </div>
          <Link
            href={`/events/${data.event.slug}/results`}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-green"
          >
            {t("review.publicResults")}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>

        {hasCancelledCompetition ? (
          <div
            role="status"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {t("compLifecycle.competitionCancelledReview")}
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            [t("review.statPending"), data.counts.pending],
            [t("review.statAwaiting"), data.counts.awaiting],
            [t("review.statFailed"), data.counts.failed],
            [t("review.statPublished"), data.counts.published],
            [t("review.statCancelled"), data.counts.cancelled],
          ].map(([label, value]) => (
            <div key={String(label)} className="surface p-4">
              <div className="display-title text-3xl">{value}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </section>

        <section className="surface mt-6 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <p className="eyebrow text-clay">{t("review.pendingEyebrow")}</p>
              <h2 className="display-title mt-1 text-2xl">
                {t("review.pendingTitle")}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
              <CalendarIcon className="size-3.5" />
              {pending.length}
            </span>
          </div>
          {pending.length ? (
            pending.map((item) => (
              <QueueCard
                key={item.matchId}
                item={item}
                event={data.event}
                demoMode={demoMode}
              />
            ))
          ) : (
            <p className="py-8 text-center text-sm font-semibold text-muted">
              {t("review.pendingEmpty")}
            </p>
          )}
        </section>

        {failed.length ? (
          <section className="surface mt-5 p-5 sm:p-7">
            <p className="eyebrow text-clay">{t("review.failedEyebrow")}</p>
            <h2 className="display-title mt-1 text-2xl">
              {t("review.failedTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              {t("review.failedBody")}
            </p>
            {failed.map((item) => (
              <QueueCard
                key={item.matchId}
                item={item}
                event={data.event}
                demoMode={demoMode}
              />
            ))}
          </section>
        ) : null}

        <section className="surface mt-5 p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <div>
              <p className="eyebrow text-green">{t("review.awaitingEyebrow")}</p>
              <h2 className="display-title mt-1 text-2xl">
                {t("review.awaitingTitle")}
              </h2>
            </div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
              {awaiting.length}
            </span>
          </div>
          {awaiting.length ? (
            awaiting.map((item) => (
              <QueueCard
                key={item.matchId}
                item={item}
                event={data.event}
                demoMode={demoMode}
              />
            ))
          ) : (
            <p className="py-8 text-center text-sm font-semibold text-muted">
              {t("review.awaitingEmpty")}
            </p>
          )}
        </section>

        {published.length ? (
          <section className="surface mt-5 p-5 sm:p-7">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <CheckIcon className="size-4 text-green" />
              <h2 className="display-title text-2xl">
                {t("review.publishedTitle")}
              </h2>
              <span className="ml-auto text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                {published.length}
              </span>
            </div>
            {published.map((item) => (
              <QueueCard
                key={item.matchId}
                item={item}
                event={data.event}
                demoMode={demoMode}
              />
            ))}
          </section>
        ) : null}

        {cancelled.length ? (
          <section className="surface mt-5 p-5 sm:p-7">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <h2 className="display-title text-2xl">
                {t("review.cancelledTitle")}
              </h2>
              <span className="ml-auto text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                {cancelled.length}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              {t("review.cancelledBody")}
            </p>
            {cancelled.map((item) => (
              <QueueCard
                key={item.matchId}
                item={item}
                event={data.event}
                demoMode={demoMode}
              />
            ))}
          </section>
        ) : null}

        {!data.items.length ? (
          <div className="surface mt-6 p-8 text-center">
            <RefreshIcon className="mx-auto size-6 text-muted" />
            <p className="mt-3 text-sm font-bold">{t("review.noMatchesTitle")}</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted">
              {t("review.noMatchesBody")}
            </p>
          </div>
        ) : null}
      </main>
    </div>
  );
}
