import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { competitions, events, matches } from "@/lib/db/schema";
import { mapPublicMatch, publicMatchQuery } from "./matches";
import type { ResultsPageData } from "./types";

export async function getResultsPage(
  eventSlug: string,
  competitionSlug?: string | null,
): Promise<ResultsPageData | null> {
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
      status: competitions.status,
      publicNote: competitions.publicNote,
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
        eq(matches.status, "published"),
        eq(matches.isBye, false),
        isNull(matches.cancelledAt),
      ),
    )
    .orderBy(sql`${matches.startsAt} desc nulls last`, asc(matches.matchNumber));

  const allResults = rows.map(mapPublicMatch);
  const results = active
    ? allResults.filter((match) => match.competitionId === active.id)
    : allResults;

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
      status: competition.status,
      publicNote: competition.publicNote,
      resultCount: allResults.filter(
        (match) => match.competitionId === competition.id,
      ).length,
    })),
    activeCompetitionSlug: active?.slug ?? null,
    results,
  };
}
