"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import {
  ArrowRightIcon,
  CheckIcon,
  ClockIcon,
  LockIcon,
  MailIcon,
  UsersIcon,
} from "@/components/icons";
import { SportTag } from "@/components/public/badges";
import { SubmitButton } from "@/components/ui/submit-button";
import { useI18n } from "@/lib/i18n/client";
import {
  acceptInvitationAction,
  beginInvitationSignInAction,
  switchInvitationAccountAction,
} from "@/features/teams/access-actions";
import type { InvitationView } from "@/features/teams/types";

function ErrorCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="surface p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft-orange text-clay">
          <LockIcon className="size-5" />
        </span>
        <div>
          <h1 className="display-title text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function InvitationAcceptView({
  data,
  token,
  user,
  errorCode,
  returnPath,
  emptyState,
}: {
  data: InvitationView | null;
  token: string;
  user: { id: string; name: string | null; email: string | null } | null;
  errorCode?: string;
  returnPath: string;
  emptyState?: "no_pending";
}) {
  const { t, formatDateTime, seedText } = useI18n();
  const emailMismatch =
    Boolean(data?.email) &&
    Boolean(user?.email) &&
    data?.kind === "email" &&
    data.email?.toLowerCase() !== user?.email?.toLowerCase();

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="page-shell flex items-center justify-between gap-3 py-4">
          <Link href="/" className="flex items-center gap-2 rounded-full focus-ring">
            <span className="grid size-9 place-items-center rounded-full bg-green text-lime">
              <CheckIcon className="size-4" />
            </span>
            <span>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-green">
                {t("common.brand")}
              </span>
              <span className="display-title block text-lg leading-none">
                {t("common.eventName")}
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {user?.email ? (
              <span className="hidden max-w-48 truncate text-[11px] font-bold text-muted sm:block">
                {t("invite.signedInAs")} {user.email}
              </span>
            ) : null}
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main id="main-content" className="page-shell py-10 sm:py-14">
        <div className="mx-auto max-w-2xl">{content}</div>
      </main>
    </div>
  );

  if (!data) {
    return shell(
      <ErrorCard
        title={
          emptyState === "no_pending"
            ? t("invite.noPendingTitle")
            : t("invite.notFoundTitle")
        }
        body={
          emptyState === "no_pending"
            ? t("invite.noPendingBody")
            : t("invite.notFoundBody")
        }
      >
        <Link
          href={emptyState === "no_pending" ? "/signin" : "/"}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white hover:bg-green"
        >
          {emptyState === "no_pending" ? t("common.signIn") : t("invite.backHome")}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </ErrorCard>,
    );
  }

  const summary = (
    <section className="surface overflow-hidden">
      <div className="border-b border-line bg-green px-6 py-6 text-white">
        <p className="eyebrow text-lime">
          {data.kind === "email" ? t("invite.emailTitle") : t("invite.linkTitle")}
        </p>
        <h1 className="display-title mt-3 text-4xl">{data.event.name}</h1>
        <p className="mt-2 text-sm leading-6 text-white/80">
          {data.kind === "email" ? t("invite.body") : t("invite.linkNotice")}
        </p>
      </div>
      <div className="p-6 sm:p-8">
        <h2 className="display-title text-2xl">{t("invite.teamsTitle")}</h2>
        <div className="mt-4 grid gap-2">
          {data.teams.map((team) => (
            <div
              key={team.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper/60 px-4 py-3"
            >
              <span className="font-extrabold">{team.name}</span>
              <span className="flex items-center gap-2 text-[11px] font-bold text-muted">
                <SportTag sport={team.sport} />
                {seedText(team.competitionName)}
              </span>
            </div>
          ))}
        </div>

        <dl className="mt-6 grid gap-3 border-t border-line pt-5 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-extrabold uppercase tracking-[0.1em] text-muted">
              {t("invite.expires")}
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-bold">
              <ClockIcon className="size-3.5 text-green" />
              {formatDateTime(data.expiresAt, data.event.timezone)}
            </dd>
          </div>
          <div>
            <dt className="font-extrabold uppercase tracking-[0.1em] text-muted">
              {t("invite.invitedBy")}
            </dt>
            <dd className="mt-0.5 font-bold">
              {data.createdByName ?? data.event.name}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );

  if (data.status === "revoked") {
    return shell(
      <ErrorCard
        title={t("invite.revokedTitle")}
        body={t("invite.revokedBody")}
      >
        <p className="mt-5 text-sm font-semibold text-muted">
          {t("invite.contactOwner")}
        </p>
      </ErrorCard>,
    );
  }

  if (data.status === "expired") {
    return shell(
      <ErrorCard
        title={t("invite.expiredTitle")}
        body={t("invite.expiredBody")}
      >
        <p className="mt-5 text-sm font-semibold text-muted">
          {t("invite.contactOwner")}
        </p>
      </ErrorCard>,
    );
  }

  if (data.status === "accepted" || errorCode === "already-accepted") {
    return shell(
      <ErrorCard
        title={t("invite.alreadyAcceptedTitle")}
        body={t("invite.alreadyAcceptedBody")}
      >
        <Link
          href="/manage"
          className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white hover:bg-green"
        >
          {t("invite.goToTeams")}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      </ErrorCard>,
    );
  }

  if (emailMismatch) {
    return shell(
      <>
        {summary}
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-orange/40 bg-soft-orange p-5"
        >
          <div className="flex items-start gap-3">
            <MailIcon className="mt-0.5 size-5 shrink-0 text-clay" />
            <div>
              <h2 className="text-sm font-extrabold text-clay">
                {t("invite.emailMismatchTitle")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-clay/90">
                {t("invite.emailMismatchBody")
                  .replace("{invited}", data.email ?? "")
                  .replace("{current}", user?.email ?? "")}
              </p>
            </div>
          </div>
          <form action={switchInvitationAccountAction} className="mt-4">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-xs font-extrabold text-white hover:bg-green"
            >
              {t("invite.switchAccount")}
              <ArrowRightIcon className="size-3.5" />
            </button>
          </form>
        </div>
      </>,
    );
  }

  if (!user) {
    return shell(
      <>
        {summary}
        <div className="surface mt-5 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft-green text-green">
              <LockIcon className="size-5" />
            </span>
            <div>
              <h2 className="display-title text-2xl">
                {t("invite.signInToAccept")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                {t("invite.signInHint")}
              </p>
            </div>
          </div>
          <form action={beginInvitationSignInAction} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <SubmitButton
              tone="invitePrimary"
              arrowClassName="size-4"
              label={t("invite.signInToAccept")}
              pendingLabel={t("common.loading")}
            />
          </form>
        </div>
      </>,
    );
  }

  if (errorCode) {
    return shell(
      <>
        {summary}
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-800"
        >
          {errorCode === "email-mismatch"
            ? t("invite.emailMismatchBody")
                .replace("{invited}", data.email ?? "")
                .replace("{current}", user.email ?? "")
            : t("invite.safeError")}
        </div>
        <form action={acceptInvitationAction} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <SubmitButton
            tone="invitePrimary"
            arrowClassName="size-4"
            label={t("invite.accept")}
            pendingLabel={t("invite.accepting")}
          />
        </form>
      </>,
    );
  }

  return shell(
    <>
      {summary}
      <div className="surface mt-5 p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft-green text-green">
            <UsersIcon className="size-5" />
          </span>
          <div>
            <h2 className="display-title text-2xl">{t("invite.acceptTitle")}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted">
              {t("invite.acceptBody")}
            </p>
          </div>
        </div>
        <form action={acceptInvitationAction} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="returnPath" value={returnPath} />
          <SubmitButton
            tone="invitePrimary"
            arrowClassName="size-4"
            label={t("invite.accept")}
            pendingLabel={t("invite.accepting")}
          />
        </form>
      </div>
    </>,
  );
}
