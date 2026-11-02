import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FixturesPage } from "@/components/public/fixtures-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getFixturesPage } from "@/features/public/fixtures";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getFixturesPage(slug);
  return {
    title: data ? `${data.event.name} fixtures` : "Fixtures",
  };
}

export default async function EventFixturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competition?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getFixturesPage(slug, query.competition ?? null),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <FixturesPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}/fixtures`}
    />
  );
}
