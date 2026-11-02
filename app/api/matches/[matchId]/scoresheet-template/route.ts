import { and, eq, inArray } from "drizzle-orm";

import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  matches,
  teamManagers,
} from "@/lib/db/schema";
import { buildFootballScoresheetPdf, FOOTBALL_TEMPLATE_VERSION } from "@/features/scoresheets/template";
import { bytesToArrayBuffer } from "@/lib/bytes";

export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await context.params;
  if (!UUID.test(matchId)) {
    return new Response("Not found", { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: {
      competition: { with: { event: true } },
      venue: true,
      entries: { with: { team: true } },
    },
  });

  if (!match || !match.competition) {
    return new Response("Not found", { status: 404 });
  }

  const event = match.competition.event;
  const isOwner = event.ownerId === user.id;
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
    return new Response("Forbidden", { status: 403 });
  }

  if (
    match.isBye ||
    match.status === "cancelled" ||
    match.status === "published" ||
    match.competition.sport !== "football"
  ) {
    return new Response("This match does not accept a scoresheet.", {
      status: 409,
    });
  }

  const home = match.entries.find((entry) => entry.side === "home")?.team;
  const away = match.entries.find((entry) => entry.side === "away")?.team;
  if (!home || !away) {
    return new Response("Match entrants are not ready.", { status: 409 });
  }

  const pdf = await buildFootballScoresheetPdf({
    matchId: match.id,
    matchNumber: match.matchNumber,
    eventName: event.name,
    competitionName: match.competition.name,
    homeTeamName: home.name,
    awayTeamName: away.name,
    venueName: match.venue?.name ?? null,
    startsAt: match.startsAt,
    timezone: event.timezone,
  });

  const filename = `scoresheet-match-${match.matchNumber}-${FOOTBALL_TEMPLATE_VERSION}.pdf`;
  return new Response(new Blob([bytesToArrayBuffer(pdf)], { type: "application/pdf" }), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
