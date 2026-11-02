"use client";

import { BallIcon, TennisIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/client";
import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { Sport } from "@/features/public/types";

export function SportTag({ sport }: { sport: Sport }) {
  const { t } = useI18n();
  const Icon = sport === "football" ? BallIcon : TennisIcon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
        sport === "football"
          ? "bg-soft-green text-green"
          : "bg-soft-orange text-clay"
      }`}
    >
      <Icon className="size-3" />
      {sport === "football"
        ? t("competition.football")
        : t("competition.tennis")}
    </span>
  );
}

export function CompetitionStatusBadge({
  status,
  registrationState,
}: {
  status: string;
  registrationState?: string;
}) {
  const { t } = useI18n();
  const key =
    status === "registration_open" && registrationState === "open"
      ? "status.registration_open"
      : (`status.${status}` as DictionaryKey);
  const label = t(key);
  const tone =
    status === "cancelled"
      ? "bg-red-50 text-red-700"
      : status === "in_progress"
        ? "bg-soft-green text-green"
        : status === "registration_open"
          ? "bg-lime text-ink"
          : "bg-cream text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${tone}`}
    >
      {label}
    </span>
  );
}

export function RegistrationBadge({ state }: { state: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
        state === "open" ? "bg-lime text-ink" : "bg-cream text-muted"
      }`}
    >
      {state === "open"
        ? t("registration.open")
        : t("registration.closed")}
    </span>
  );
}

export function MatchStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
        status === "published"
          ? "bg-soft-green text-green"
          : status === "cancelled"
            ? "bg-red-50 text-red-700"
            : "bg-cream text-muted"
      }`}
    >
      {t(`matchStatus.${status}` as DictionaryKey)}
    </span>
  );
}
