import { notFound } from "next/navigation";

import { CompetitionAdminView } from "@/components/admin/competition-admin-view";
import { getDemoAccounts, requireEventOwner } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/demo-mode";
import { getAdminCompetitionData } from "@/features/competitions/admin-queries";

export const dynamic = "force-dynamic";

export default async function AdminCompetitionPage({
  params,
}: {
  params: Promise<{ eventId: string; competitionId: string }>;
}) {
  const { eventId, competitionId } = await params;
  const { user } = await requireEventOwner(eventId);
  const data = await getAdminCompetitionData(eventId, competitionId);

  if (!data) {
    notFound();
  }

  const demoMode = isDemoMode();
  const demoAccounts = demoMode ? await getDemoAccounts() : [];

  return (
    <CompetitionAdminView
      data={data}
      user={{ name: user.name, email: user.email }}
      demoAccounts={demoAccounts}
      demoMode={demoMode}
    />
  );
}
