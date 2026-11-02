"use client";

import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/dictionaries";

const options: Array<{ locale: Locale; label: string; short: string }> = [
  { locale: "pt-BR", label: "Português", short: "PT" },
  { locale: "en", label: "English", short: "EN" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className="flex items-center rounded-full border border-line bg-white/80 p-1"
      role="group"
      aria-label={t("common.language")}
    >
      {options.map((option) => {
        const active = locale === option.locale;
        return (
          <button
            key={option.locale}
            type="button"
            onClick={() => setLocale(option.locale)}
            aria-pressed={active}
            aria-label={option.label}
            className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.08em] transition-colors ${
              active
                ? "bg-ink text-white"
                : "text-muted hover:bg-cream hover:text-ink"
            }`}
          >
            {option.short}
          </button>
        );
      })}
    </div>
  );
}
