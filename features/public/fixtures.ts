import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { competitions, events, matches } from "@/lib/db/schema";
import {
  mapPublicMatch,
  publicMatchQuery,
} from "@/features/public/matches";
import type { FixturesPageData } from "@/features/public/types";

export async function getFixturesPage(
  eventSlug: string,
  competitionSlug?: string | null,
): Promise<FixturesPageData | null> {
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
      sortOrder: competitions.sortOrder,
    })
    .from(competitions)
    .where(eq(competitions.eventId, event.id))
    .orderBy(asc(competitions.sortOrder), asc(competitions.name));

  const active = competitionSlug
    ? (competitionRows.find(
        (competition) => competition.slug === competitionSlug,
      ) ?? null)
    : null;

  const rows = await publicMatchQuery()
    .where(
      and(
        eq(competitions.eventId, event.id),
        eq(matches.isBye, false),
      ),
    )
    .orderBy(
      sql`${matches.startsAt} asc nulls last`,
      asc(matches.matchNumber),
    );

  const allFixtures = rows.map(mapPublicMatch);
  const fixtures = active
    ? allFixtures.filter((match) => match.competitionId === active.id)
    : allFixtures;

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
      matchCount: allFixtures.filter(
        (match) => match.competitionId === competition.id,
      ).length,
    })),
    activeCompetitionSlug: active?.slug ?? null,
    fixtures,
  };
}
