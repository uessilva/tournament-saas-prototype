"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import {
  ArrowRightIcon,
  CheckIcon,
  LockIcon,
  MailIcon,
} from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";
import {
  requestMagicLink,
  switchDemoAccount,
} from "@/features/auth/actions";
import type { DemoAccount } from "@/lib/auth/guards";

function SubmitButton({
  label,
  pendingLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-green disabled:cursor-wait disabled:opacity-70"
      }
    >
      {pending ? pendingLabel : label}
      {pending ? null : <ArrowRightIcon className="size-4" />}
    </button>
  );
}

function DemoSubmit({ account }: { account: DemoAccount }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={t("auth.signInAs").replace("{name}", account.name)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] font-extrabold text-ink transition-colors hover:border-green hover:text-green disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? t("auth.sending") : t("common.signIn")}
      {pending ? null : <ArrowRightIcon className="size-3" />}
    </button>
  );
}

export function SignInView({
  callbackUrl,
  accounts,
  demoMode,
  errorKey,
}: {
  callbackUrl: string;
  accounts: DemoAccount[];
  demoMode: boolean;
  errorKey?: string;
}) {
  const { t } = useI18n();
  const errorMessage =
    errorKey === "invalid-email"
      ? t("auth.invalidEmail")
      : errorKey === "invalid-demo-account"
        ? t("auth.invalidDemoAccount")
        : errorKey
          ? t("auth.errorBody")
          : null;

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-shell flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2 rounded-full focus-ring">
          <span className="grid size-9 place-items-center rounded-full bg-green text-lime">
            <LockIcon className="size-4" />
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
        <LanguageSwitcher />
      </div>

      <main
        id="main-content"
        className="page-shell grid gap-6 pb-16 pt-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch"
      >
        <section className="relative overflow-hidden rounded-[1.75rem] bg-green p-8 text-white sm:p-10 lg:p-12">
          <div className="hero-orbit opacity-70" aria-hidden="true" />
          <div className="relative">
            <p className="eyebrow text-lime">{t("auth.signInEyebrow")}</p>
            <h1 className="display-title mt-5 max-w-lg text-5xl sm:text-6xl">
              {t("auth.signInTitle")}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/85">
              {t("auth.signInBody")}
            </p>

            <div className="mt-9 grid gap-3">
              {[
                [t("auth.featureMagic"), t("auth.featureMagicBody")],
                [t("auth.featureMailpit"), t("auth.featureMailpitBody")],
                [t("auth.featureAccounts"), t("auth.featureAccountsBody")],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/10 p-4"
                >
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-lime text-ink">
                    <CheckIcon className="size-3.5" />
                  </span>
                  <span>
                    <span className="block text-sm font-extrabold">{title}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-white/70">
                      {body}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-1.5 text-xs font-extrabold text-lime underline decoration-2 underline-offset-4"
            >
              {t("auth.publicHub")}
              <ArrowRightIcon className="size-3.5" />
            </Link>
          </div>
        </section>

        <section className="surface flex flex-col p-6 sm:p-9">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            >
              <p className="font-extrabold">{t("auth.errorTitle")}</p>
              <p className="mt-1 font-medium">{errorMessage}</p>
            </div>
          ) : null}

          <form action={requestMagicLink} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div>
              <label
                htmlFor="email"
                className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted"
              >
                {t("auth.emailLabel")}
              </label>
              <div className="relative mt-2">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  placeholder={t("auth.emailPlaceholder")}
                  className="w-full rounded-xl border border-line bg-paper px-10 py-3 text-sm font-semibold text-ink placeholder:text-muted focus:border-green focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <SubmitButton
              label={t("auth.sendMagicLink")}
              pendingLabel={t("auth.sending")}
            />
            <p className="text-xs leading-5 text-muted">
              {t("auth.magicLinkNote")}
            </p>
          </form>

          {demoMode ? (
            <div className="mt-7 border-t border-line pt-6">
              <p className="eyebrow text-green">
                {t("auth.demoAccountsEyebrow")}
              </p>
              <h2 className="display-title mt-2 text-2xl">
                {t("auth.demoAccountsTitle")}
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-muted">
                {t("auth.demoAccountsBody")}
              </p>

              <div className="mt-4 grid gap-2">
                {accounts.length ? (
                  accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-paper/70 p-3"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold">
                          <span className="truncate">{account.name}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.08em] ${
                              account.role === "owner"
                                ? "bg-soft-green text-green"
                                : "bg-soft-orange text-clay"
                            }`}
                          >
                            {account.role === "owner"
                              ? t("auth.owner")
                              : t("auth.manager")}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-muted">
                          {account.detail} · {account.email}
                        </p>
                      </div>
                      <form action={switchDemoAccount}>
                        <input
                          type="hidden"
                          name="email"
                          value={account.email}
                        />
                        <input
                          type="hidden"
                          name="callbackUrl"
                          value={callbackUrl}
                        />
                        <DemoSubmit account={account} />
                      </form>
                    </div>
                  ))
                ) : (
                  <p className="rounded-xl bg-cream p-4 text-sm leading-6 text-muted">
                    {t("auth.demoUnavailable")}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-7 text-xs">
            {demoMode ? (
              <a
                href="http://localhost:8025"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-extrabold text-green hover:underline"
              >
                <MailIcon className="size-3.5" />
                {t("auth.openMailpit")}
              </a>
            ) : (
              <span />
            )}
            <Link href="/" className="font-bold text-muted hover:text-ink">
              {t("auth.publicHub")}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
