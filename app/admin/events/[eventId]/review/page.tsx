import { notFound } from "next/navigation";

import { ReviewQueueView } from "@/components/admin/review-queue-view";
import { requireEventOwner } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/demo-mode";
import { getReviewQueue } from "@/features/scoresheets/queries";

export const dynamic = "force-dynamic";

export default async function EventReviewQueuePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const { user } = await requireEventOwner(eventId);
  const data = await getReviewQueue(eventId);

  if (!data) {
    notFound();
  }

  return (
    <ReviewQueueView
      data={data}
      user={{ name: user.name, email: user.email }}
      demoMode={isDemoMode()}
    />
  );
}
