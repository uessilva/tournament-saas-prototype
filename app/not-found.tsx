"use client";

import Link from "next/link";

import { ArrowLeftIcon, BallIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";

export default function NotFoundPage() {
  const { t } = useI18n();

  return (
    <main
      id="main-content"
      className="grid min-h-screen place-items-center bg-paper px-6"
    >
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-green text-lime">
          <BallIcon className="size-8" />
        </span>
        <p className="eyebrow mt-6 text-green">404</p>
        <h1 className="display-title mt-2 text-5xl">{t("notFound.title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          {t("notFound.body")}
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-extrabold text-white hover:bg-green"
        >
          <ArrowLeftIcon className="size-4" />
          {t("notFound.back")}
        </Link>
      </div>
    </main>
  );
}
