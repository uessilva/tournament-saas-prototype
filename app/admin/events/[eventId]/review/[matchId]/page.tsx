import { notFound } from "next/navigation";

import { ReviewMatchView } from "@/components/admin/review-match-view";
import { requireEventOwner } from "@/lib/auth/guards";
import { getReviewMatchDetail } from "@/features/scoresheets/queries";

export const dynamic = "force-dynamic";

export default async function EventReviewMatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string; matchId: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ eventId, matchId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const { user } = await requireEventOwner(eventId);
  const data = await getReviewMatchDetail(eventId, matchId);

  if (!data) {
    notFound();
  }

  return (
    <ReviewMatchView
      data={data}
      user={{ name: user.name, email: user.email }}
      notice={query.notice}
    />
  );
}
