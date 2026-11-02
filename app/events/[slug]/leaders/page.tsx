import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeadersPage } from "@/components/public/leaders-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getLeadersPage } from "@/features/public/leaders";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getLeadersPage(slug);
  return { title: data ? `${data.event.name} leaders` : "Leaders" };
}

export default async function EventLeadersPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ competition?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getLeadersPage(slug, query.competition ?? null),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <LeadersPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}/leaders`}
    />
  );
}
