import { notFound } from "next/navigation";

import { EventTeamsView } from "@/components/admin/event-teams-view";
import { getDemoAccounts, requireEventOwner } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/demo-mode";
import { getEventAccessData } from "@/features/teams/access-queries";

export const dynamic = "force-dynamic";

export default async function EventTeamsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ eventId }, query] = await Promise.all([params, searchParams]);
  const { user } = await requireEventOwner(eventId);
  const data = await getEventAccessData(eventId);

  if (!data) {
    notFound();
  }

  const demoMode = isDemoMode();
  const demoAccounts = demoMode ? await getDemoAccounts() : [];

  return (
    <EventTeamsView
      data={data}
      user={{ name: user.name, email: user.email }}
      demoAccounts={demoAccounts}
      demoMode={demoMode}
      notice={query.notice}
      error={query.error}
    />
  );
}
