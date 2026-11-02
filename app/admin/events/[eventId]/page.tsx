import { notFound } from "next/navigation";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getDemoAccounts, requireEventOwner } from "@/lib/auth/guards";
import { isDemoMode } from "@/lib/demo-mode";
import { getAdminEventData } from "@/features/events/queries";
import { getOpenDisputeCount } from "@/features/disputes/queries";

export const dynamic = "force-dynamic";

export default async function AdminEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { eventId } = await params;
  const { user } = await requireEventOwner(eventId);
  const [data, query, openDisputes] = await Promise.all([
    getAdminEventData(eventId),
    searchParams,
    getOpenDisputeCount(eventId),
  ]);

  if (!data) {
    notFound();
  }

  const demoMode = isDemoMode();
  const demoAccounts = demoMode ? await getDemoAccounts() : [];

  return (
    <AdminDashboard
      data={data}
      user={{ name: user.name, email: user.email }}
      demoAccounts={demoAccounts}
      demoMode={demoMode}
      resetSuccess={query.reset === "1"}
      openDisputes={openDisputes}
    />
  );
}
