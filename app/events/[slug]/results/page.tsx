import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResultsPage } from "@/components/public/results-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getResultsPage } from "@/features/public/results";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getResultsPage(slug);
  return { title: data ? `${data.event.name} results` : "Results" };
}

export default async function EventResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competition?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getResultsPage(slug, query.competition ?? null),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <ResultsPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}/results`}
    />
  );
}
