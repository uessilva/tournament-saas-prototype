"use client";

import Link from "next/link";

import { ArrowUpRightIcon, BallIcon, SignOutIcon } from "@/components/icons";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";
import { signOutAction } from "@/features/auth/actions";

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "SC";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppTopBar({
  user,
  publicHref,
  secondaryHref,
  secondaryLabel,
}: {
  user: { name: string | null; email: string | null };
  publicHref: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const { t } = useI18n();

  return (
    <header className="border-b border-line bg-white">
      <div className="page-shell flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 rounded-full focus-ring">
            <span className="grid size-8 place-items-center rounded-full bg-green text-lime">
              <BallIcon className="size-4" />
            </span>
            <span className="display-title text-base">{t("footer.event")}</span>
          </Link>
          <span className="hidden h-5 w-px bg-line sm:block" />
          <Link
            href={publicHref}
            className="hidden items-center gap-1 text-xs font-extrabold text-muted hover:text-green sm:inline-flex"
          >
            {t("admin.publicHub")}
            <ArrowUpRightIcon className="size-3" />
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="hidden text-xs font-extrabold text-muted hover:text-green md:block"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <div className="hidden items-center gap-2 rounded-full border border-line bg-paper px-2 py-1 sm:flex">
            <span className="grid size-6 place-items-center rounded-full bg-green text-[10px] font-extrabold text-white">
              {initials(user.name, user.email)}
            </span>
            <span className="max-w-32 truncate text-[11px] font-bold">
              {user.name ?? user.email}
            </span>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label={t("common.signOut")}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] font-extrabold text-muted transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            >
              <SignOutIcon className="size-3.5" />
              <span className="hidden sm:inline">{t("common.signOut")}</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
