import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EventHubPage } from "@/components/public/event-hub-page";
import { getCurrentUser } from "@/lib/auth/guards";
import { DEMO_EVENT_SLUG } from "@/lib/db/demo";
import { getEventHubBySlug } from "@/features/public/event-hub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Summer Cup 2026",
};

export default async function HomePage() {
  const [data, user] = await Promise.all([
    getEventHubBySlug(DEMO_EVENT_SLUG),
    getCurrentUser(),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <EventHubPage
      data={data}
      signedIn={Boolean(user)}
      currentPath="/"
    />
  );
}
