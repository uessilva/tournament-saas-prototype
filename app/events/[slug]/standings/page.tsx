import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StandingsPage } from "@/components/public/standings-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStandingsPage } from "@/features/public/standings";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStandingsPage(slug);
  return { title: data ? `${data.event.name} standings` : "Standings" };
}

export default async function EventStandingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competition?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getStandingsPage(slug, query.competition ?? null),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <StandingsPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}/standings`}
    />
  );
}
