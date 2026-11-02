import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventHubPage } from "@/components/public/event-hub-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { getEventHubBySlug } from "@/features/public/event-hub";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getEventHubBySlug(slug);
  return {
    title: data?.event.name ?? "Event",
    description: data?.event.tagline ?? undefined,
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, user] = await Promise.all([
    getEventHubBySlug(slug),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <EventHubPage
      data={data}
      signedIn={Boolean(user)}
      currentPath={`/events/${slug}`}
    />
  );
}
