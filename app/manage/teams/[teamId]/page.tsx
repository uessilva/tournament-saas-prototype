import { notFound } from "next/navigation";

import { TeamRosterView } from "@/components/manage/team-roster-view";
import { requireTeamManager } from "@/lib/auth/guards";
import { getTeamRoster } from "@/features/teams/queries";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const { user } = await requireTeamManager(teamId);
  const data = await getTeamRoster(teamId);

  if (!data) {
    notFound();
  }

  return (
    <TeamRosterView
      data={data}
      user={{ name: user.name, email: user.email }}
    />
  );
}
