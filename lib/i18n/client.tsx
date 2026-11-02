"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  formatMessage,
  getDictionary,
  isLocale,
  type DictionaryKey,
  type Locale,
} from "@/lib/i18n/dictionaries";
import { localizeSeedText } from "@/lib/i18n/seed-copy";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey) => string;
  seedText: (value: string | null | undefined) => string | null;
  message: (template: string, values: Record<string, string | number>) => string;
  formatDate: (
    value: string | Date,
    timeZone?: string,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatTime: (value: string | Date, timeZone?: string) => string;
  formatDateTime: (value: string | Date, timeZone?: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_COOKIE);
    if (isLocale(stored) && stored !== locale) {
      setLocaleState(stored);
      document.documentElement.lang = stored;
      return;
    }
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(LOCALE_COOKIE, nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = getDictionary(locale);
    return {
      locale,
      setLocale,
      t: (key) => dictionary[key] ?? getDictionary(DEFAULT_LOCALE)[key] ?? key,
      seedText: (value) => localizeSeedText(value, locale),
      message: formatMessage,
      formatDate: (input, timeZone, options) =>
        new Intl.DateTimeFormat(locale, {
          timeZone,
          day: "2-digit",
          month: "short",
          year: "numeric",
          ...options,
        }).format(new Date(input)),
      formatTime: (input, timeZone) =>
        new Intl.DateTimeFormat(locale, {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(input)),
      formatDateTime: (input, timeZone) =>
        new Intl.DateTimeFormat(locale, {
          timeZone,
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(input)),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside LanguageProvider");
  }
  return value;
}
