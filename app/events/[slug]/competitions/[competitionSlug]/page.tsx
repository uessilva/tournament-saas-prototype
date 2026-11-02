import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompetitionPage } from "@/components/public/competition-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCompetitionPage } from "@/features/competitions/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; competitionSlug: string }>;
}): Promise<Metadata> {
  const { slug, competitionSlug } = await params;
  const data = await getCompetitionPage(slug, competitionSlug);
  return {
    title: data?.competition.name ?? "Competition",
    description: data?.competition.description ?? undefined,
  };
}

export default async function CompetitionRoute({
  params,
}: {
  params: Promise<{ slug: string; competitionSlug: string }>;
}) {
  const { slug, competitionSlug } = await params;
  const [data, user] = await Promise.all([
    getCompetitionPage(slug, competitionSlug),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <CompetitionPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}/competitions/${competitionSlug}`}
    />
  );
}
