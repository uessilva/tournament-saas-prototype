import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { competitions, events } from "@/lib/db/schema";
import { loadCompetitionStandings } from "@/features/competitions/standings-queries";
import type {
  PublicCompetitionStandings,
  StandingsPageData,
} from "@/features/public/types";

export async function getStandingsPage(
  eventSlug: string,
  competitionSlug?: string | null,
): Promise<StandingsPageData | null> {
  const [event] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, eventSlug), eq(events.isPublished, true)))
    .limit(1);

  if (!event) {
    return null;
  }

  const competitionRows = await db
    .select({
      id: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      sport: competitions.sport,
      format: competitions.format,
      status: competitions.status,
      qualifiersPerGroup: competitions.qualifiersPerGroup,
      drawSeed: competitions.drawSeed,
      drawGeneratedAt: competitions.drawGeneratedAt,
    })
    .from(competitions)
    .where(eq(competitions.eventId, event.id))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const active = competitionSlug
    ? (competitionRows.find(
        (competition) => competition.slug === competitionSlug,
      ) ?? null)
    : null;

  const selected = active ? [active] : competitionRows;
  const standings: PublicCompetitionStandings[] = await Promise.all(
    selected.map(async (competition) => ({
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      sport: competition.sport,
      format: competition.format,
      status: competition.status,
      qualifiersPerGroup: competition.qualifiersPerGroup,
      drawSeed: competition.drawSeed,
      drawGeneratedAt: competition.drawGeneratedAt?.toISOString() ?? null,
      groups: await loadCompetitionStandings(competition),
    })),
  );

  return {
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      timezone: event.timezone,
      locationLabel: event.locationLabel,
    },
    competitions: competitionRows.map((competition) => ({
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      sport: competition.sport,
    })),
    activeCompetitionSlug: active?.slug ?? null,
    standings,
  };
}
