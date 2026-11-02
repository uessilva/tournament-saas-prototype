import { ManageDashboard } from "@/components/manage/manage-dashboard";
import { getManagedTeams, requireUser } from "@/lib/auth/guards";
import type { ManagedTeam } from "@/features/teams/types";

export const dynamic = "force-dynamic";

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string; count?: string }>;
}) {
  const user = await requireUser("/manage");
  const [teams, query] = await Promise.all([
    getManagedTeams(user.id),
    searchParams,
  ]);
  const inviteCount = Number(query.count ?? "0");

  return (
    <ManageDashboard
      user={{ name: user.name, email: user.email }}
      teams={teams as ManagedTeam[]}
      inviteAccepted={query.invitation === "accepted"}
      inviteCount={Number.isFinite(inviteCount) ? inviteCount : 0}
    />
  );
}
