import { notFound } from "next/navigation";

import { ScheduleView } from "@/components/admin/schedule-view";
import { requireEventOwner } from "@/lib/auth/guards";
import { getScheduleWorkspace } from "@/features/matches/schedule-queries";

export const dynamic = "force-dynamic";

export default async function EventSchedulePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user } = await requireEventOwner(eventId);
  const data = await getScheduleWorkspace(eventId);

  if (!data) {
    notFound();
  }

  return (
    <ScheduleView
      data={data}
      user={{ name: user.name, email: user.email }}
    />
  );
}
