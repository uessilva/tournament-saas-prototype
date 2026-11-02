import { InvitationAcceptView } from "@/components/invitations/invitation-accept-view";
import { getCurrentUser } from "@/lib/auth/guards";
import { getInvitationViewByToken } from "@/features/teams/invitations";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const [data, user] = await Promise.all([
    getInvitationViewByToken(token),
    getCurrentUser(),
  ]);

  const errorCode = Array.isArray(query.error) ? query.error[0] : query.error;

  return (
    <InvitationAcceptView
      data={data}
      token={token}
      user={user}
      errorCode={errorCode}
      returnPath={`/invitations/${token}`}
    />
  );
}
