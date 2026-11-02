"use client";

import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { BallIcon, LockIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";

export type HeaderCompetition = {
  name: string;
  slug: string;
  sport: "football" | "tennis";
};

export function SiteHeader({
  eventSlug,
  eventName,
  competitions,
  signedIn,
  activeCompetitionSlug,
  currentPath,
}: {
  eventSlug: string;
  eventName: string;
  competitions: HeaderCompetition[];
  signedIn: boolean;
  activeCompetitionSlug?: string;
  currentPath: string;
}) {
  const { t } = useI18n();
  const basePath = `/events/${eventSlug}`;

  return (
    <header className="border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="page-shell">
        <div className="flex items-center justify-between gap-2 py-4 sm:gap-4">
          <Link
            href={basePath}
            className="group flex min-w-0 items-center gap-2 rounded-full focus-ring sm:gap-3"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green text-lime shadow-[0_8px_24px_rgba(23,107,70,0.18)] sm:size-10">
              <BallIcon className="size-4 sm:size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[8px] font-extrabold uppercase tracking-[0.16em] text-green sm:text-[10px]">
                {t("common.brand")}
              </span>
              <span className="display-title block whitespace-nowrap text-[13px] leading-none sm:text-lg">
                {eventName}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            {signedIn ? (
              <Link
                href="/admin"
                className="hidden rounded-full border border-line bg-white px-4 py-2 text-xs font-extrabold text-ink transition-colors hover:border-green hover:text-green sm:inline-flex"
              >
                {t("common.admin")}
              </Link>
            ) : (
              <Link
                href={`/signin?callbackUrl=${encodeURIComponent(currentPath)}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-extrabold text-white transition-colors hover:bg-green"
              >
                <LockIcon className="size-3.5" />
                {t("common.signIn")}
              </Link>
            )}
          </div>
        </div>

        <nav
          aria-label={t("nav.competitions")}
          className="-mx-1 flex flex-wrap items-center gap-1 pb-3 text-sm"
        >
          <Link
            href={`${basePath}#overview`}
            className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
              !activeCompetitionSlug &&
              !currentPath.endsWith("/fixtures") &&
              !currentPath.endsWith("/results") &&
              !currentPath.endsWith("/standings") &&
              !currentPath.endsWith("/leaders")
                ? "bg-green/10 text-green"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {t("nav.overview")}
          </Link>
          {competitions.map((competition) => (
            <Link
              key={competition.slug}
              href={`${basePath}/competitions/${competition.slug}`}
              className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
                activeCompetitionSlug === competition.slug
                  ? "bg-green/10 text-green"
                  : "text-muted hover:bg-cream hover:text-ink"
              }`}
            >
              {competition.name}
            </Link>
          ))}
          <Link
            href={`${basePath}/fixtures`}
            className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
              currentPath.endsWith("/fixtures")
                ? "bg-green/10 text-green"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {t("nav.fixtures")}
          </Link>
          <Link
            href={`${basePath}/results`}
            className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
              currentPath.endsWith("/results")
                ? "bg-green/10 text-green"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {t("nav.results")}
          </Link>
          <Link
            href={`${basePath}/standings`}
            className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
              currentPath.endsWith("/standings")
                ? "bg-green/10 text-green"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {t("nav.standings")}
          </Link>
          <Link
            href={`${basePath}/leaders`}
            className={`shrink-0 rounded-full px-3 py-1.5 font-bold transition-colors ${
              currentPath.endsWith("/leaders")
                ? "bg-green/10 text-green"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {t("nav.leaders")}
          </Link>
          <Link
            href={`${basePath}#about`}
            className="shrink-0 rounded-full px-3 py-1.5 font-bold text-muted transition-colors hover:bg-cream hover:text-ink"
          >
            {t("nav.about")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
