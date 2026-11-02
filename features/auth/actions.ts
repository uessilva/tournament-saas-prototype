"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { signIn, signOut } from "@/lib/auth";
import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { events, users } from "@/lib/db/schema";
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

/**
 * The demo switcher lives on Owner and Manager screens. Keep the requested
 * destination when it matches the target account, but send a Manager away
 * from an Owner-only URL (and vice versa) so account switching never lands on
 * a 404 during the demo.
 */
async function resolveDemoCallback(email: string, callbackUrl: string) {
  if (
    !callbackUrl.startsWith("/admin") &&
    !callbackUrl.startsWith("/manage")
  ) {
    return callbackUrl;
  }

  const [account] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!account) {
    return callbackUrl;
  }

  const [ownedEvent] = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.ownerId, account.id))
    .limit(1);

  if (callbackUrl.startsWith("/admin") && !ownedEvent) {
    return "/manage";
  }
  if (callbackUrl.startsWith("/manage") && ownedEvent) {
    return "/admin";
  }
  return callbackUrl;
}

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
    redirectTo: await resolveDemoCallback(
      email.data.toLowerCase(),
      callbackUrl,
    ),
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
