import { redirect } from "next/navigation";

import { SignInView } from "@/components/auth/sign-in-view";
import { getCurrentUser, getDemoAccounts } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

function safeCallback(value: string | string[] | undefined) {
  const callback = Array.isArray(value) ? value[0] : value;
  if (!callback || !callback.startsWith("/") || callback.startsWith("//")) {
    return "/admin";
  }
  return callback.startsWith("/signin") ? "/admin" : callback;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallback(params.callbackUrl);
  const user = await getCurrentUser();

  if (user) {
    redirect(callbackUrl);
  }

  const demoMode = isDemoMode();
  const accounts = demoMode ? await getDemoAccounts() : [];
  const errorKey = Array.isArray(params.error)
    ? params.error[0]
    : params.error;

  return (
    <SignInView
      callbackUrl={callbackUrl}
      accounts={accounts}
      demoMode={demoMode}
      errorKey={errorKey}
    />
  );
}
