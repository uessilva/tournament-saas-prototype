"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth";
import { requireEventOwner } from "@/lib/auth/guards";
import { resetDemoData } from "@/lib/db/seed";
import { assertDemoMode } from "@/lib/demo-mode";

function safeCallbackUrl(value: FormDataEntryValue | null) {
  const callbackUrl = typeof value === "string" ? value : "/";
  if (!callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/";
  }
  return callbackUrl;
}

const emailSchema = z.string().trim().email();

export async function requestMagicLink(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const parsed = emailSchema.safeParse(formData.get("email"));

  if (!parsed.success) {
    redirect(
      `/signin?error=invalid-email&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }

  await signIn("nodemailer", {
    email: parsed.data.toLowerCase(),
    redirectTo: callbackUrl,
  });
}

export async function switchDemoAccount(formData: FormData) {
  assertDemoMode();

  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const email = emailSchema.safeParse(formData.get("email"));

  if (!email.success) {
    redirect("/signin?error=invalid-demo-account");
  }

  await signIn("demo", {
    email: email.data.toLowerCase(),
    redirectTo: callbackUrl,
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function resetDemoAction(formData: FormData) {
  assertDemoMode();

  const eventId = String(formData.get("eventId") ?? "");
  await requireEventOwner(eventId);

  await resetDemoData();

  revalidatePath("/", "layout");
  redirect(`/admin/events/${eventId}?reset=1`);
}
