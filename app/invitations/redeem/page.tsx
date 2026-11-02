import { cookies } from "next/headers";

import { InvitationAcceptView } from "@/components/invitations/invitation-accept-view";
import { getCurrentUser } from "@/lib/auth/guards";
import { INVITATION_COOKIE } from "@/lib/invitations/tokens";
import { getInvitationViewByToken } from "@/features/teams/invitations";

export const dynamic = "force-dynamic";

export default async function InvitationRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(INVITATION_COOKIE)?.value ?? "";
  const [data, user, query] = await Promise.all([
    token ? getInvitationViewByToken(token) : Promise.resolve(null),
    getCurrentUser(),
    searchParams,
  ]);
  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <InvitationAcceptView
      data={data}
      token={token}
      user={user}
      errorCode={errorCode}
      returnPath="/invitations/redeem"
      emptyState={token ? undefined : "no_pending"}
    />
  );
}
