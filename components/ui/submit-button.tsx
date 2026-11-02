"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { ArrowRightIcon } from "@/components/icons";

export type SubmitButtonTone =
  | "primary"
  | "dark"
  | "ink"
  | "danger"
  | "dangerOutline"
  | "quiet"
  | "quietInk"
  | "quietSmall"
  | "ghostDanger"
  | "auth"
  | "invitePrimary"
  | "inviteSecondary"
  | "pillDark"
  | "pillGreen";

const toneClasses: Record<SubmitButtonTone, string> = {
  primary:
    "gap-1.5 rounded-xl bg-green px-4 py-2.5 text-xs text-white hover:bg-green-deep",
  dark: "gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs text-white hover:bg-green",
  ink: "gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-xs text-white hover:bg-green",
  danger:
    "gap-1.5 rounded-xl bg-clay px-4 py-2.5 text-xs text-white hover:bg-red-700",
  dangerOutline:
    "gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs text-red-700 hover:bg-red-50",
  quiet:
    "gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11px] text-muted hover:border-green hover:text-green",
  quietInk:
    "gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-xs text-ink hover:border-green hover:text-green",
  quietSmall:
    "gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-[11px] text-muted hover:border-green hover:text-green",
  ghostDanger:
    "gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-muted hover:bg-red-50 hover:text-red-700",
  auth: "gap-2 rounded-xl bg-ink px-5 py-3 text-sm text-white hover:bg-green",
  invitePrimary:
    "w-full gap-2 rounded-xl bg-ink px-5 py-3 text-sm text-white hover:bg-green sm:w-auto",
  inviteSecondary:
    "w-full gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm text-ink hover:border-green hover:text-green sm:w-auto",
  pillDark:
    "gap-1.5 rounded-full bg-ink px-4 py-2 text-[11px] text-white hover:bg-green",
  pillGreen:
    "gap-1.5 rounded-full bg-green px-3 py-1.5 text-[11px] text-white hover:bg-green-deep",
};

export function SubmitButton({
  label,
  pendingLabel,
  tone = "primary",
  disabled = false,
  name,
  value,
  className,
  icon,
  arrowClassName = "size-3.5",
  ariaLabel,
}: {
  label: string;
  pendingLabel: string;
  tone?: SubmitButtonTone;
  disabled?: boolean;
  name?: string;
  value?: string;
  className?: string;
  /** Defaults to the standard right arrow. Pass `false` to hide it. */
  icon?: ReactNode | false;
  arrowClassName?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  const resolvedIcon =
    icon === false ? null : (icon ?? <ArrowRightIcon className={arrowClassName} />);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center font-extrabold transition-colors disabled:cursor-wait disabled:opacity-60 ${toneClasses[tone]} ${className ?? ""}`}
    >
      {pending ? pendingLabel : label}
      {pending ? null : resolvedIcon}
    </button>
  );
}
