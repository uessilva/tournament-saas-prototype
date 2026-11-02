import { CheckEmailView } from "@/components/auth/check-email-view";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  return <CheckEmailView showMailpit={isDemoMode()} />;
}
