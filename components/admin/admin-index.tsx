"use client";

import Link from "next/link";

import { AppTopBar } from "@/components/app-top-bar";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarIcon,
  MapPinIcon,
} from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";

export function AdminIndex({
  user,
  events,
}: {
  user: { name: string | null; email: string | null };
  events: Array<{
    id: string;
    name: string;
    slug: string;
    locationLabel: string | null;
    startsAt: string;
    endsAt: string;
    timezone: string;
  }>;
}) {
  const { t, formatDate } = useI18n();

  return (
    <div className="min-h-screen bg-[#f2f1ea]">
      <AppTopBar user={user} publicHref="/" />
      <main id="main-content" className="page-shell py-8">
        <p className="eyebrow text-green">{t("admin.eyebrow")}</p>
        <h1 className="display-title mt-2 text-4xl sm:text-5xl">
          {t("admin.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t("admin.body")}
        </p>

        {events.length ? (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {events.map((event) => (
              <article key={event.id} className="surface p-6">
                <h2 className="display-title text-3xl">{event.name}</h2>
                <p className="mt-3 flex items-center gap-2 text-xs font-bold text-muted">
                  <CalendarIcon className="size-3.5" />
                  {formatDate(event.startsAt, event.timezone, {
                    day: "numeric",
                    month: "short",
                    year: undefined,
                  })}{" "}
                  —{" "}
                  {formatDate(event.endsAt, event.timezone, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="mt-1.5 flex items-center gap-2 text-xs font-bold text-muted">
                  <MapPinIcon className="size-3.5" />
                  {event.locationLabel}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-extrabold text-white hover:bg-green"
                  >
                    {t("admin.openEvent")}
                    <ArrowRightIcon className="size-3.5" />
                  </Link>
                  <Link
                    href={`/events/${event.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-extrabold hover:border-green hover:text-green"
                  >
                    {t("admin.publicHub")}
                    <ArrowUpRightIcon className="size-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="surface mt-8 p-8">
            <p className="text-sm font-semibold text-muted">
              {t("admin.noEvents")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
