import { redirect } from "next/navigation";

import { AdminIndex } from "@/components/admin/admin-index";
import { getOwnedEvents, requireUser } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser("/admin");
  const events = await getOwnedEvents(user.id);

  if (events.length === 1) {
    redirect(`/admin/events/${events[0].id}`);
  }

  return (
    <AdminIndex
      user={{ name: user.name, email: user.email }}
      events={events.map((event) => ({
        id: event.id,
        name: event.name,
        slug: event.slug,
        locationLabel: event.locationLabel,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        timezone: event.timezone,
      }))}
    />
  );
}
