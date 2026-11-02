import { and, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { auditEvents, users } from "@/lib/db/schema";

export type CompetitionLifecycleEvent = {
  id: string;
  type: string;
  summary: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata: Record<string, unknown> | null;
};

export async function getCompetitionLifecycleEvents(
  eventId: string,
  competitionId: string,
  limit = 12,
): Promise<CompetitionLifecycleEvent[]> {
  const rows = await db
    .select({
      id: auditEvents.id,
      type: auditEvents.type,
      summary: auditEvents.summary,
      createdAt: auditEvents.createdAt,
      metadata: auditEvents.metadata,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .where(
      and(
        eq(auditEvents.eventId, eventId),
        inArray(auditEvents.type, [
          "competition.cancelled",
          "competition.restored",
          "match.cancelled",
          "match.restored",
        ]),
        or(
          and(
            eq(auditEvents.entityType, "competition"),
            eq(auditEvents.entityId, competitionId),
          ),
          sql`${auditEvents.metadata}->>'competitionId' = ${competitionId}`,
        ),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    actorName: row.actorName,
    actorEmail: row.actorEmail,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  }));
}
