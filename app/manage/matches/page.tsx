import { ManagerFixturesView } from "@/components/manage/manager-fixtures-view";
import { requireUser } from "@/lib/auth/guards";
import { getManagerFixtures } from "@/features/matches/manager-queries";

export const dynamic = "force-dynamic";

export default async function ManagerMatchesPage() {
  const user = await requireUser("/manage/matches");
  const data = await getManagerFixtures(user.id);

  return (
    <ManagerFixturesView
      data={data}
      user={{ name: user.name, email: user.email }}
    />
  );
}
