import { notFound } from "next/navigation";

import { DisputeQueueView } from "@/components/admin/dispute-queue-view";
import { requireEventOwner } from "@/lib/auth/guards";
import { getEventDisputes } from "@/features/disputes/queries";

export const dynamic = "force-dynamic";

export default async function EventDisputesPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user } = await requireEventOwner(eventId);
  const data = await getEventDisputes(eventId);

  if (!data) {
    notFound();
  }

  return (
    <DisputeQueueView
      data={data}
      user={{ name: user.name, email: user.email }}
    />
  );
}
