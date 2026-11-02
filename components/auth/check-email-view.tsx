"use client";

import Link from "next/link";

import { ArrowLeftIcon, ArrowUpRightIcon, MailIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";

export function CheckEmailView({ showMailpit }: { showMailpit: boolean }) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-paper">
      <div className="page-shell flex items-center justify-between py-5">
        <Link href="/" className="flex items-center gap-2 rounded-full focus-ring">
          <span className="grid size-9 place-items-center rounded-full bg-green text-lime">
            <MailIcon className="size-4" />
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
        className="page-shell grid min-h-[70vh] place-items-center pb-16"
      >
        <div className="surface w-full max-w-lg p-8 text-center sm:p-10">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-lime text-ink">
            <MailIcon className="size-7" />
          </span>
          <h1 className="display-title mt-6 text-4xl">
            {t("auth.checkEmailTitle")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            {t("auth.checkEmailBody")}
          </p>
          {showMailpit ? (
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-extrabold text-white hover:bg-green"
            >
              {t("auth.openMailpit")}
              <ArrowUpRightIcon className="size-3.5" />
            </a>
          ) : null}
          <div className="mt-6 border-t border-line pt-5">
            <Link
              href="/signin"
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-muted hover:text-green"
            >
              <ArrowLeftIcon className="size-3.5" />
              {t("auth.backToSignIn")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
