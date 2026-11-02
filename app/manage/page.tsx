import { ManageDashboard } from "@/components/manage/manage-dashboard";
import { getManagedTeams, requireUser } from "@/lib/auth/guards";
import type { ManagedTeam } from "@/features/teams/types";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const user = await requireUser("/manage");
  const teams = (await getManagedTeams(user.id)) as ManagedTeam[];

  return (
    <ManageDashboard
      user={{ name: user.name, email: user.email }}
      teams={teams}
    />
  );
}
