"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useState } from "react";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  MailIcon,
  RefreshIcon,
} from "@/components/icons";
import { SportTag } from "@/components/public/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { DemoAccount } from "@/lib/auth/guards";
import { switchDemoAccount } from "@/features/auth/actions";
import {
  createEmailInvitationAction,
  createShareLinkAction,
  removeManagerAction,
  replaceInvitationAction,
  retryEmailJobAction,
  revokeInvitationAction,
  type AccessActionState,
} from "@/features/teams/access-actions";
import type {
  EventAccessData,
  EventInvitation,
  EventTeamAccess,
} from "@/features/teams/types";

const EMPTY_STATE: AccessActionState = { status: "idle" };

function TeamCheckboxes({
  teams,
  legend,
  idPrefix,
  error,
}: {
  teams: EventTeamAccess[];
  legend: string;
  idPrefix: string;
  error?: string;
}) {
  const { t, seedText } = useI18n();

  return (
    <fieldset aria-describedby={error ? `${idPrefix}-error` : undefined}>
      <legend className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">
        {legend}
      </legend>
      <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-paper/60 p-3">
        {teams.map((team) => (
          <label
            key={team.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-bold hover:bg-white"
          >
            <input
              id={`${idPrefix}-${team.id}`}
              type="checkbox"
              name="teamIds"
              value={team.id}
              className="size-4 rounded border-line text-green accent-green"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate">{team.name}</span>
              <span className="block text-[10px] font-semibold text-muted">
                {seedText(team.competitionName)}
              </span>
            </span>
            <SportTag sport={team.sport} />
          </label>
        ))}
      </div>
      {error ? (
        <p
          id={`${idPrefix}-error`}
          role="alert"
          className="mt-1.5 text-xs font-bold text-red-700"
        >
          {t("teamsAdmin.teamRequired")}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] font-medium text-muted">
          {t("teamsAdmin.selectTeamsHint")}
        </p>
      )}
    </fieldset>
  );
}

function RawLinkPanel({
  rawToken,
  kind,
  code,
}: {
  rawToken: string;
  kind?: "email" | "link";
  code?: string;
}) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const path = `/invitations/${rawToken}`;
  const url = origin ? `${origin}${path}` : path;
  const keyByCode: Record<string, DictionaryKey> = {
    invitation_created: "teamsAdmin.invitationCreated",
    invitation_created_email_failed: "teamsAdmin.invitationCreated_email_failed",
    link_created: "teamsAdmin.linkCreated",
    invitation_replaced: "teamsAdmin.invitationReplaced",
    invitation_replaced_email_failed: "teamsAdmin.invitationReplaced_email_failed",
    link_replaced: "teamsAdmin.linkReplaced",
  };

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-green/25 bg-soft-green p-4">
      <p className="flex items-center gap-1.5 text-xs font-extrabold text-green">
        <CheckIcon className="size-3.5" />
        {t(
          keyByCode[
            code ??
              (kind === "email" ? "invitation_created" : "link_created")
          ] ??
            (kind === "email"
              ? "teamsAdmin.invitationCreated"
              : "teamsAdmin.linkCreated"),
        )}
      </p>
      <p className="mt-1 text-[11px] font-medium text-green/80">
        {t("teamsAdmin.rawTokenBody")}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          aria-label={t("teamsAdmin.rawTokenTitle")}
          className="min-w-0 flex-1 rounded-lg border border-green/20 bg-white px-3 py-2 text-[11px] font-bold text-ink"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[11px] font-extrabold text-white hover:bg-green"
        >
          <CopyIcon className="size-3.5" />
          {copied ? t("teamsAdmin.copied") : t("teamsAdmin.copyLink")}
        </button>
      </div>
    </div>
  );
}

function InvitationStatusPill({ invitation }: { invitation: EventInvitation }) {
  const { t } = useI18n();
  const keyByStatus: Record<string, DictionaryKey> = {
    pending: "teamsAdmin.statusPending",
    active: "teamsAdmin.statusActive",
    accepted: "teamsAdmin.statusAccepted",
    revoked: "teamsAdmin.statusRevoked",
    expired: "teamsAdmin.statusExpired",
  };
  const tone =
    invitation.status === "pending"
      ? "bg-soft-orange text-clay"
      : invitation.status === "active"
        ? "bg-soft-green text-green"
        : invitation.status === "accepted"
          ? "bg-lime text-ink"
          : "bg-cream text-muted";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${tone}`}
    >
      {t(keyByStatus[invitation.status] ?? "teamsAdmin.statusPending")}
    </span>
  );
}

function InvitationRow({
  invitation,
  eventId,
  timezone,
  onRawToken,
}: {
  invitation: EventInvitation;
  eventId: string;
  timezone: string;
  onRawToken?: (token: string, kind: "email" | "link", code: string) => void;
}) {
  const { t, formatDateTime } = useI18n();
  const [state, formAction] = useActionState(
    replaceInvitationAction,
    EMPTY_STATE,
  );

  useEffect(() => {
    if (state.status === "success" && state.rawToken && state.kind) {
      onRawToken?.(
        state.rawToken,
        state.kind,
        state.code ?? "teamsAdmin.invitationReplaced",
      );
    }
  }, [state, onRawToken]);

  return (
    <article className="rounded-xl border border-line bg-paper/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <InvitationStatusPill invitation={invitation} />
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
              {invitation.kind === "email"
                ? t("teamsAdmin.kindEmail")
                : t("teamsAdmin.kindLink")}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-extrabold">
            {invitation.kind === "email"
              ? (invitation.email ?? "—")
              : t("teamsAdmin.reusableLink")}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-muted">
            {invitation.teams.map((team) => team.name).join(" · ")}
          </p>
        </div>
        <div className="text-right text-[10px] font-bold text-muted">
          <p className="flex items-center justify-end gap-1">
            <ClockIcon className="size-3" />
            {t("teamsAdmin.expiresAt")}:{" "}
            {formatDateTime(invitation.expiresAt, timezone)}
          </p>
          {invitation.acceptedAt ? (
            <p className="mt-1 text-green">
              {t("teamsAdmin.acceptedBy")}:{" "}
              {invitation.acceptedByName ??
                invitation.acceptedByEmail ??
                "—"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        {invitation.status !== "revoked" ? (
          <form action={revokeInvitationAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="invitationId" value={invitation.id} />
            <SubmitButton
              label={t("teamsAdmin.revoke")}
              pendingLabel={t("common.loading")}
              tone="quiet"
            />
          </form>
        ) : null}
        <form action={formAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="invitationId" value={invitation.id} />
          <SubmitButton
            label={t("teamsAdmin.replace")}
            pendingLabel={t("common.loading")}
            tone="quiet"
          />
        </form>
        {invitation.status === "expired" ? (
          <span className="text-[10px] font-bold text-clay">
            {t("teamsAdmin.expiredHint")}
          </span>
        ) : null}
        {invitation.revokedAt ? (
          <span className="text-[10px] font-bold text-muted">
            {t("teamsAdmin.revokedAt")}:{" "}
            {formatDateTime(invitation.revokedAt, timezone)}
          </span>
        ) : null}
      </div>

      {state.status === "error" ? (
        <p role="alert" className="mt-2 text-xs font-bold text-red-700">
          {t(
            state.code === "competition_cancelled"
              ? "teamsAdmin.competitionCancelled"
              : "teamsAdmin.actionFailed",
          )}
        </p>
      ) : null}
    </article>
  );
}

function ManagerChip({
  manager,
  team,
  eventId,
}: {
  manager: EventTeamAccess["managers"][number];
  team: EventTeamAccess;
  eventId: string;
}) {
  const { t } = useI18n();

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-2.5 pr-1 text-[11px] font-bold">
      <span className="max-w-36 truncate" title={manager.email}>
        {manager.name}
      </span>
      <form
        action={removeManagerAction}
        onSubmit={(event) => {
          if (
            !window.confirm(
              t("teamsAdmin.removeManagerConfirm")
                .replace("{name}", manager.name)
                .replace("{team}", team.name),
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="teamId" value={team.id} />
        <input type="hidden" name="userId" value={manager.userId} />
        <button
          type="submit"
          aria-label={t("teamsAdmin.removeManagerAria")
            .replace("{name}", manager.name)
            .replace("{team}", team.name)}
          className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold text-muted hover:bg-red-50 hover:text-red-700"
        >
          ×
        </button>
      </form>
    </span>
  );
}

export function EventTeamsView({
  data,
  user,
  demoAccounts,
  demoMode,
  notice,
  error,
}: {
  data: EventAccessData;
  user: { name: string | null; email: string | null };
  demoAccounts: DemoAccount[];
  demoMode: boolean;
  notice?: string;
  error?: string;
}) {
  const { t, formatDateTime, seedText } = useI18n();
  const [emailState, emailAction] = useActionState(
    createEmailInvitationAction,
    EMPTY_STATE,
  );
  const [linkState, linkAction] = useActionState(
    createShareLinkAction,
    EMPTY_STATE,
  );
  const [latestRaw, setLatestRaw] = useState<{
    token: string;
    kind: "email" | "link";
    code: string;
  } | null>(null);

  const handleRawToken = useCallback(
    (token: string, kind: "email" | "link", code: string) => {
      setLatestRaw({ token, kind, code });
    },
    [],
  );

  const pendingByTeam = new Set<string>();
  for (const invitation of data.invitations) {
    if (invitation.status === "pending") {
      for (const team of invitation.teams) {
        pendingByTeam.add(team.id);
      }
    }
  }

  const noticeKey: DictionaryKey | null =
    notice === "revoked"
      ? "teamsAdmin.revokedNotice"
      : notice === "manager-removed"
        ? "teamsAdmin.managerRemovedNotice"
        : notice === "email-retried"
          ? "teamsAdmin.emailRetriedNotice"
          : null;
  const errorKey: DictionaryKey | null =
    error === "invitation-not-found"
      ? "teamsAdmin.invitationNotFound"
      : error === "team-not-found"
        ? "teamsAdmin.teamNotFound"
        : error === "competition-cancelled"
          ? "teamsAdmin.competitionCancelled"
          : error === "email-retry-failed"
            ? "teamsAdmin.emailRetryFailed"
            : error
              ? "teamsAdmin.actionFailed"
              : null;

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar
        user={user}
        publicHref={`/events/${data.event.slug}`}
        secondaryHref={`/admin/events/${data.event.id}`}
        secondaryLabel={t("teamsAdmin.backToEvent")}
      />

      <main id="main-content" className="page-shell py-6 sm:py-8">
        <Link
          href={`/admin/events/${data.event.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("teamsAdmin.backToEvent")}
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-green">{t("teamsAdmin.eyebrow")}</p>
            <h1 className="display-title mt-2 text-4xl sm:text-5xl">
              {t("teamsAdmin.title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {t("teamsAdmin.body")}
            </p>
            <p className="mt-1 text-xs font-bold text-muted">
              {data.event.name} · {t("teamsAdmin.timezone")}{" "}
              {data.event.timezone}
            </p>
          </div>
          <Link
            href={`/events/${data.event.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2.5 text-xs font-extrabold text-ink hover:border-green hover:text-green"
          >
            {t("admin.publicHub")}
            <ArrowUpRightIcon className="size-3.5" />
          </Link>
        </header>

        {noticeKey ? (
          <div
            role="status"
            className="mt-5 flex items-start gap-2 rounded-xl border border-green/20 bg-soft-green px-4 py-3 text-sm font-semibold text-green"
          >
            <CheckIcon className="mt-0.5 size-4 shrink-0" />
            {t(noticeKey)}
          </div>
        ) : null}
        {errorKey ? (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
          >
            {t(errorKey)}
          </div>
        ) : null}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [t("teamsAdmin.statTeams"), data.counts.teams],
            [t("teamsAdmin.statManagers"), data.counts.managers],
            [t("teamsAdmin.statPending"), data.counts.pendingEmailInvitations],
            [t("teamsAdmin.statLinks"), data.counts.activeLinks],
          ].map(([label, value]) => (
            <div key={String(label)} className="surface p-4">
              <div className="display-title text-3xl">{value}</div>
              <div className="mt-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
                {label}
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="surface p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="eyebrow text-green">{t("teamsAdmin.teamsTitle")}</p>
                <h2 className="display-title mt-2 text-3xl">
                  {t("teamsAdmin.teamsHeading")}
                </h2>
              </div>
              <span className="text-xs font-extrabold text-muted">
                {t("teamsAdmin.teamCount").replace(
                  "{count}",
                  String(data.teams.length),
                )}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("teamsAdmin.teamsBody")}
            </p>

            <div className="mt-5 space-y-2.5">
              {data.teams.map((team) => (
                <article
                  key={team.id}
                  className="rounded-xl border border-line bg-paper/50 p-4"
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor:
                      team.sport === "football"
                        ? "var(--color-green)"
                        : "var(--color-clay)",
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold">{team.name}</h3>
                      <p className="mt-0.5 text-[11px] font-semibold text-muted">
                        {seedText(team.competitionName)} ·{" "}
                        {t("teamsAdmin.rosterCount").replace(
                          "{count}",
                          String(team.participantCount),
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <SportTag sport={team.sport} />
                      {pendingByTeam.has(team.id) ? (
                        <span className="rounded-full bg-soft-orange px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] text-clay">
                          {t("teamsAdmin.invitePending")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {team.managers.length ? (
                      team.managers.map((manager) => (
                        <ManagerChip
                          key={manager.userId}
                          manager={manager}
                          team={team}
                          eventId={data.event.id}
                        />
                      ))
                    ) : (
                      <span className="text-[11px] font-bold text-muted">
                        {t("teamsAdmin.noManagers")}
                      </span>
                    )}
                  </div>
                </article>
              ))}
              {!data.teams.length ? (
                <p className="rounded-xl bg-cream p-4 text-sm font-semibold text-muted">
                  {t("teamsAdmin.noTeams")}
                </p>
              ) : null}
            </div>
          </section>

          <div className="space-y-5">
            <section className="surface p-5 sm:p-6">
              <p className="eyebrow text-green">{t("teamsAdmin.emailInviteEyebrow")}</p>
              <h2 className="display-title mt-2 text-2xl">
                {t("teamsAdmin.emailInviteTitle")}
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {t("teamsAdmin.emailInviteBody")}
              </p>

              <form key={emailState.rawToken ?? "email-form"} action={emailAction} className="mt-4 space-y-4">
                <input type="hidden" name="eventId" value={data.event.id} />
                <div>
                  <label
                    htmlFor="invitation-email"
                    className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted"
                  >
                    {t("teamsAdmin.emailLabel")}
                  </label>
                  <input
                    id="invitation-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="off"
                    placeholder={t("teamsAdmin.emailPlaceholder")}
                    aria-invalid={Boolean(emailState.fieldErrors?.email)}
                    aria-describedby={
                      emailState.fieldErrors?.email
                        ? "invitation-email-error"
                        : undefined
                    }
                    className="mt-1.5 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold focus:border-green focus:bg-white focus:outline-none"
                  />
                  {emailState.fieldErrors?.email ? (
                    <p
                      id="invitation-email-error"
                      role="alert"
                      className="mt-1 text-xs font-bold text-red-700"
                    >
                      {t("teamsAdmin.emailInvalid")}
                    </p>
                  ) : null}
                </div>
                <TeamCheckboxes
                  teams={data.teams}
                  legend={t("teamsAdmin.selectTeams")}
                  idPrefix="email-team"
                  error={emailState.fieldErrors?.teamIds}
                />
                {emailState.status === "error" ? (
                  <p role="alert" className="text-xs font-bold text-red-700">
                    {t(
                      (emailState.fieldErrors?.teamIds
                        ? "teamsAdmin.teamRequired"
                        : emailState.code === "teams_invalid"
                          ? "teamsAdmin.teamsInvalid"
                          : emailState.code === "competition_cancelled"
                            ? "teamsAdmin.competitionCancelled"
                            : "teamsAdmin.actionFailed") as DictionaryKey,
                    )}
                  </p>
                ) : null}
                <SubmitButton
                  label={t("teamsAdmin.createEmailInvitation")}
                  pendingLabel={t("common.loading")}
                  tone="dark"
                />
              </form>

              {emailState.status === "success" && emailState.rawToken ? (
                <RawLinkPanel
                  rawToken={emailState.rawToken}
                  kind="email"
                  code={emailState.code}
                />
              ) : null}
            </section>

            <section className="surface p-5 sm:p-6">
              <p className="eyebrow text-green">{t("teamsAdmin.linkEyebrow")}</p>
              <h2 className="display-title mt-2 text-2xl">
                {t("teamsAdmin.linkTitle")}
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {t("teamsAdmin.linkBody")}
              </p>

              <form key={linkState.rawToken ?? "link-form"} action={linkAction} className="mt-4 space-y-4">
                <input type="hidden" name="eventId" value={data.event.id} />
                <TeamCheckboxes
                  teams={data.teams}
                  legend={t("teamsAdmin.selectTeams")}
                  idPrefix="link-team"
                  error={linkState.fieldErrors?.teamIds}
                />
                {linkState.status === "error" ? (
                  <p role="alert" className="text-xs font-bold text-red-700">
                    {t(
                      linkState.code === "teams_invalid"
                        ? "teamsAdmin.teamsInvalid"
                        : linkState.code === "competition_cancelled"
                          ? "teamsAdmin.competitionCancelled"
                          : "teamsAdmin.teamRequired",
                    )}
                  </p>
                ) : null}
                <SubmitButton
                  label={t("teamsAdmin.createLink")}
                  pendingLabel={t("common.loading")}
                  tone="dark"
                />
              </form>

              {linkState.status === "success" && linkState.rawToken ? (
                <RawLinkPanel
                  rawToken={linkState.rawToken}
                  kind="link"
                  code={linkState.code}
                />
              ) : null}
            </section>

            {demoMode ? (
              <section className="rounded-[1.25rem] bg-ink p-5 text-white">
                <p className="eyebrow text-lime">{t("teamsAdmin.demoShortcuts")}</p>
                <h2 className="display-title mt-2 text-2xl">
                  {t("teamsAdmin.demoTitle")}
                </h2>
                <p className="mt-1.5 text-[11px] leading-5 text-white/60">
                  {t("teamsAdmin.demoBody")}
                </p>

                <a
                  href="#invitations"
                  className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-extrabold text-white hover:border-lime hover:text-lime"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon className="size-3.5" />
                    {t("teamsAdmin.pendingShortcut")}
                  </span>
                  <span className="rounded-full bg-lime px-2 py-0.5 text-[10px] text-ink">
                    {data.counts.pendingEmailInvitations}
                  </span>
                </a>
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-extrabold text-white hover:border-lime hover:text-lime"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MailIcon className="size-3.5" />
                    {t("teamsAdmin.mailpitShortcut")}
                  </span>
                  <ArrowUpRightIcon className="size-3.5" />
                </a>

                <form action={switchDemoAccount} className="mt-4 border-t border-white/10 pt-4">
                  <input
                    type="hidden"
                    name="callbackUrl"
                    value={`/admin/events/${data.event.id}/teams`}
                  />
                  <label
                    htmlFor="teams-demo-account"
                    className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50"
                  >
                    {t("admin.switchAccount")}
                  </label>
                  <select
                    id="teams-demo-account"
                    name="email"
                    defaultValue={
                      demoAccounts.find((account) => account.email === user.email)
                        ?.email ??
                      demoAccounts[0]?.email ??
                      ""
                    }
                    className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold text-white outline-none focus:border-lime"
                  >
                    {demoAccounts.map((account) => (
                      <option key={account.id} value={account.email} className="text-ink">
                        {account.name} ·{" "}
                        {account.role === "owner" ? t("auth.owner") : account.detail}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-xl bg-lime px-3 py-2 text-xs font-extrabold text-ink hover:bg-white"
                  >
                    {t("admin.switchAccountAction")}
                  </button>
                </form>
              </section>
            ) : null}
          </div>
        </div>

        <section id="invitations" className="surface mt-5 scroll-mt-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow text-green">{t("teamsAdmin.invitationsEyebrow")}</p>
              <h2 className="display-title mt-2 text-3xl">
                {t("teamsAdmin.invitationsTitle")}
              </h2>
            </div>
            <span className="text-xs font-extrabold text-muted">
              {t("teamsAdmin.invitationCount").replace(
                "{count}",
                String(data.invitations.length),
              )}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            {t("teamsAdmin.invitationsBody")}
          </p>

          {latestRaw ? (
            <RawLinkPanel
              rawToken={latestRaw.token}
              kind={latestRaw.kind}
              code={latestRaw.code}
            />
          ) : null}

          <div className="mt-4 space-y-2.5">
            {data.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                invitation={invitation}
                eventId={data.event.id}
                timezone={data.event.timezone}
                onRawToken={handleRawToken}
              />
            ))}
            {!data.invitations.length ? (
              <p className="rounded-xl bg-cream p-4 text-sm font-semibold text-muted">
                {t("teamsAdmin.noInvitations")}
              </p>
            ) : null}
          </div>
        </section>

        {data.failedEmailJobs.length ? (
          <section className="surface mt-5 border-clay/40 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="eyebrow text-clay">
                  {t("teamsAdmin.failedEmailsEyebrow")}
                </p>
                <h2 className="display-title mt-2 text-3xl">
                  {t("teamsAdmin.failedEmailsTitle")}
                </h2>
              </div>
              <span className="text-xs font-extrabold text-muted">
                {data.failedEmailJobs.length}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">
              {t("teamsAdmin.failedEmailsBody")}
            </p>
            <div className="mt-4 space-y-2.5">
              {data.failedEmailJobs.map((job) => (
                <article
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper/50 p-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">
                      {job.recipient ?? "—"}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-muted">
                      {formatDateTime(job.createdAt, data.event.timezone)} ·{" "}
                      {t("review.attempts")} {job.attempts}
                    </p>
                    {job.lastError ? (
                      <p role="alert" className="mt-1 text-xs font-bold text-red-700">
                        {job.lastError}
                      </p>
                    ) : null}
                  </div>
                  <form action={retryEmailJobAction}>
                    <input type="hidden" name="eventId" value={data.event.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <SubmitButton
                      label={t("teamsAdmin.retryEmail")}
                      pendingLabel={t("common.loading")}
                      tone="quiet"
                    />
                  </form>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="surface mt-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="eyebrow text-green">{t("teamsAdmin.historyEyebrow")}</p>
              <h2 className="display-title mt-2 text-3xl">
                {t("teamsAdmin.historyTitle")}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted">
              <RefreshIcon className="size-3.5" />
              {t("teamsAdmin.historyLive")}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted">
            {t("teamsAdmin.historyBody")}
          </p>

          <div
            className="mt-4 overflow-x-auto"
            role="region"
            aria-label={t("teamsAdmin.historyTitle")}
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] text-left text-xs">
              <caption className="sr-only">{t("teamsAdmin.historyTitle")}</caption>
              <thead>
                <tr className="border-b border-line bg-paper/60 text-[9px] uppercase tracking-[0.1em] text-muted">
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.when")}</th>
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.event")}</th>
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.actor")}</th>
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.subject")}</th>
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.teams")}</th>
                  <th scope="col" className="px-3 py-2.5 font-extrabold">{t("teamsAdmin.invitation")}</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((entry) => (
                  <tr key={entry.id} className="border-b border-line/70 last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                      {formatDateTime(entry.createdAt, data.event.timezone)}
                    </td>
                    <td className="px-3 py-2.5 font-bold">
                      {t(`access.${entry.type}` as DictionaryKey)}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {entry.actorName ?? entry.actorEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {entry.subjectName ?? entry.subjectEmail ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {entry.teams.join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {entry.invitationKind
                        ? `${entry.invitationKind === "email" ? t("teamsAdmin.kindEmail") : t("teamsAdmin.kindLink")}${entry.invitationEmail ? ` · ${entry.invitationEmail}` : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.history.length ? (
            <p className="mt-4 rounded-xl bg-cream p-4 text-sm font-semibold text-muted">
              {t("teamsAdmin.noHistory")}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
