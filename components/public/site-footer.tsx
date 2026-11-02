"use client";

import Link from "next/link";

import { BallIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import { formatTimeZoneLabel } from "@/lib/timezone";

export function SiteFooter({
  eventSlug,
  timezone,
}: {
  eventSlug: string;
  timezone?: string;
}) {
  const { t } = useI18n();

  return (
    <footer className="mt-20 border-t border-line bg-cream/60">
      <div className="page-shell grid gap-8 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-green text-lime">
              <BallIcon className="size-4" />
            </span>
            <span className="display-title text-lg">{t("footer.event")}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            {t("home.footerNote")}
          </p>
        </div>

        <div>
          <p className="eyebrow text-muted">{t("footer.public")}</p>
          <div className="mt-3 grid gap-2 text-sm font-bold">
            <Link className="hover:text-green" href={`/events/${eventSlug}`}>
              {t("nav.overview")}
            </Link>
            <Link className="hover:text-green" href={`/events/${eventSlug}/fixtures`}>
              {t("nav.fixtures")}
            </Link>
            <Link className="hover:text-green" href={`/events/${eventSlug}#about`}>
              {t("nav.about")}
            </Link>
          </div>
        </div>

        <div>
          <p className="eyebrow text-muted">{t("footer.management")}</p>
          <div className="mt-3 grid gap-2 text-sm font-bold">
            <Link className="hover:text-green" href="/signin">
              {t("home.adminAccess")}
            </Link>
            <span className="font-medium text-muted">
              {timezone
                ? `${t("home.timezone")}: ${formatTimeZoneLabel(timezone)}`
                : t("home.timezoneValue")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
