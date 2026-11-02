import { and, eq, inArray } from "drizzle-orm";

import { getCurrentUser, type SessionUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { matches, scoresheets, teamManagers } from "@/lib/db/schema";

export type ScoresheetAccess = {
  user: SessionUser;
  sheet: typeof scoresheets.$inferSelect;
  match: NonNullable<
    Awaited<ReturnType<typeof loadSheetMatch>>
  >;
  isOwner: boolean;
  isManager: boolean;
};

async function loadSheetMatch(matchId: string) {
  return db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      competition: { with: { event: true } },
      entries: true,
    },
  });
}

/**
 * Owner or an assigned Team Manager may read the stored original and review
 * assets. Everyone else gets null, including unrelated Managers.
 */
export async function getScoresheetAccess(
  scoresheetId: string,
): Promise<ScoresheetAccess | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const [sheet] = await db
    .select()
    .from(scoresheets)
    .where(eq(scoresheets.id, scoresheetId))
    .limit(1);
  if (!sheet) {
    return null;
  }

  const match = await loadSheetMatch(sheet.matchId);
  if (!match || !match.competition) {
    return null;
  }

  const isOwner = match.competition.event.ownerId === user.id;
  let isManager = false;

  if (!isOwner) {
    const teamIds = match.entries.map((entry) => entry.teamId);
    const assignment = teamIds.length
      ? await db
          .select({ id: teamManagers.id })
          .from(teamManagers)
          .where(
            and(
              eq(teamManagers.userId, user.id),
              inArray(teamManagers.teamId, teamIds),
            ),
          )
          .limit(1)
      : [];
    isManager = assignment.length > 0;
  }

  if (!isOwner && !isManager) {
    return null;
  }

  return { user, sheet, match, isOwner, isManager };
}
