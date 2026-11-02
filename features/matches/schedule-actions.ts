"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  events,
  matchEntries,
  matches,
  teams,
  venues,
} from "@/lib/db/schema";
import {
  convertInstantToTimeZone,
  isValidTimeZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";
import {
  effectiveDurationMinutes,
  findScheduleConflicts,
  type ScheduleCandidate,
  type ScheduleConflict,
  type ScheduleExistingMatch,
  type ScheduleTeam,
} from "@/features/matches/scheduling";

export type ScheduleConflictView = {
  kind: "team" | "venue";
  otherMatchNumber: number;
  otherCompetitionName: string;
  teamNames: string[];
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  otherStartsAt: string;
  otherEndsAt: string;
};

export type ScheduleActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
  conflicts?: ScheduleConflictView[];
  /** Submitted schedule values kept for correction after an error. */
  draft?: {
    startsAt: string;
    venueId: string;
    durationMinutes: string;
  };
  matchId?: string;
  venueId?: string;
  venueName?: string;
  timezone?: string;
};

type ScheduleTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

class ScheduleActionError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(code: string, fieldErrors?: Record<string, string>) {
    super(code);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function actionError(error: unknown): ScheduleActionState {
  if (error instanceof ScheduleActionError) {
    return {
      status: "error",
      code: error.code,
      fieldErrors: error.fieldErrors,
    };
  }
  console.error("schedule action failed", error);
  return { status: "error", code: "action_failed" };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function revalidateSchedule(eventId: string, eventSlug: string) {
  revalidatePath(`/admin/events/${eventId}/schedule`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventSlug}`);
  revalidatePath(`/events/${eventSlug}/fixtures`);
  revalidatePath(`/events/${eventSlug}/competitions/[competitionSlug]`, "page");
  revalidatePath("/manage");
  revalidatePath("/manage/matches");
}

function toConflictView(conflict: ScheduleConflict): ScheduleConflictView {
  return {
    kind: conflict.kind,
    otherMatchNumber: conflict.otherMatchNumber,
    otherCompetitionName: conflict.otherCompetitionName,
    teamNames: conflict.teams.map((team) => team.name),
    venueName: conflict.venueName,
    startsAt: conflict.startsAt,
    endsAt: conflict.endsAt,
    otherStartsAt: conflict.otherStartsAt,
    otherEndsAt: conflict.otherEndsAt,
  };
}

type TeamRow = {
  matchId: string;
  id: string;
  name: string;
};

async function loadScheduledMatches(
  tx: ScheduleTransaction,
  eventId: string,
) {
  const rows = await tx
    .select({
      id: matches.id,
      matchNumber: matches.matchNumber,
      competitionName: competitions.name,
      competitionStatus: competitions.status,
      startsAt: matches.startsAt,
      durationMinutes: matches.durationMinutes,
      defaultDurationMinutes: competitions.defaultMatchDurationMinutes,
      venueId: matches.venueId,
      venueName: venues.name,
      status: matches.status,
      isBye: matches.isBye,
    })
    .from(matches)
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .leftJoin(venues, eq(matches.venueId, venues.id))
    .where(eq(competitions.eventId, eventId));

  const matchIds = rows.map((row) => row.id);
  const teamRows: TeamRow[] = matchIds.length
    ? await tx
        .select({
          matchId: matchEntries.matchId,
          id: teams.id,
          name: teams.name,
        })
        .from(matchEntries)
        .innerJoin(teams, eq(matchEntries.teamId, teams.id))
        .where(inArray(matchEntries.matchId, matchIds))
    : [];

  const teamsByMatch = new Map<string, ScheduleTeam[]>();
  for (const row of teamRows) {
    const list = teamsByMatch.get(row.matchId) ?? [];
    list.push({ id: row.id, name: row.name });
    teamsByMatch.set(row.matchId, list);
  }

  const scheduled: ScheduleExistingMatch[] = [];
  for (const row of rows) {
    if (
      row.isBye ||
      row.status === "cancelled" ||
      row.competitionStatus === "cancelled"
    ) {
      continue;
    }
    const duration = effectiveDurationMinutes(
      row.durationMinutes,
      row.defaultDurationMinutes,
    );
    if (!row.startsAt || duration == null) {
      continue;
    }
    scheduled.push({
      matchId: row.id,
      matchNumber: row.matchNumber,
      competitionName: row.competitionName,
      startsAt: row.startsAt,
      durationMinutes: duration,
      venueId: row.venueId,
      venueName: row.venueName,
      teams: teamsByMatch.get(row.id) ?? [],
    });
  }

  return { scheduled, teamsByMatch };
}

export async function createVenueAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const rawName = String(formData.get("name") ?? "").trim();

  if (!z.string().uuid().safeParse(eventId).success) {
    return { status: "error", code: "action_failed" };
  }

  if (rawName.length < 2 || rawName.length > 60) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { name: "venue_name_invalid" },
    };
  }

  const { user, event } = await requireEventOwner(eventId);
  const slug = slugify(rawName);

  try {
    if (!slug) {
      return {
        status: "error",
        code: "fix_errors",
        fieldErrors: { name: "venue_name_invalid" },
      };
    }

    const result = await db.transaction(async (tx) => {
      await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, event.id))
        .for("update");

      const [existing] = await tx
        .select({ id: venues.id, name: venues.name })
        .from(venues)
        .where(and(eq(venues.eventId, event.id), eq(venues.slug, slug)))
        .limit(1);

      if (existing) {
        throw new ScheduleActionError("venue_exists", {
          name: "venue_exists",
        });
      }

      const [nextOrder] = await tx
        .select({
          value: sql<number>`coalesce(max(${venues.sortOrder}), 0) + 1`,
        })
        .from(venues)
        .where(eq(venues.eventId, event.id));

      const [venue] = await tx
        .insert(venues)
        .values({
          eventId: event.id,
          name: rawName,
          slug,
          sortOrder: nextOrder?.value ?? 1,
        })
        .returning({ id: venues.id, name: venues.name });

      if (!venue) {
        throw new ScheduleActionError("action_failed");
      }

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: user.id,
        type: "venue.created",
        entityType: "venue",
        entityId: venue.id,
        summary: `Venue ${venue.name} added to ${event.name}.`,
        metadata: { venueId: venue.id, slug },
      });

      return venue;
    });

    revalidateSchedule(event.id, event.slug);
    return {
      status: "success",
      code: "venue_created",
      venueId: result.id,
      venueName: result.name,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMatchScheduleAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const matchId = String(formData.get("matchId") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  const rawStartsAt =
    intent === "clear"
      ? ""
      : String(formData.get("startsAt") ?? "").trim();
  const rawVenueId = String(formData.get("venueId") ?? "").trim();
  const rawDuration = String(formData.get("durationMinutes") ?? "").trim();
  const draft = {
    startsAt: String(formData.get("startsAt") ?? ""),
    venueId: rawVenueId,
    durationMinutes: rawDuration,
  };

  if (
    !z.string().uuid().safeParse(eventId).success ||
    !z.string().uuid().safeParse(matchId).success
  ) {
    return { status: "error", code: "action_failed" };
  }

  const { user, event } = await requireEventOwner(eventId);

  try {
    return await db.transaction(async (tx): Promise<ScheduleActionState> => {
      await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, event.id))
        .for("update");

      const [match] = await tx
        .select({
          id: matches.id,
          matchNumber: matches.matchNumber,
          competitionName: competitions.name,
          competitionStatus: competitions.status,
          status: matches.status,
          defaultDurationMinutes: competitions.defaultMatchDurationMinutes,
        })
        .from(matches)
        .innerJoin(competitions, eq(matches.competitionId, competitions.id))
        .where(
          and(eq(matches.id, matchId), eq(competitions.eventId, event.id)),
        )
        .limit(1);

      if (!match) {
        throw new ScheduleActionError("action_failed");
      }

      if (match.competitionStatus === "cancelled") {
        throw new ScheduleActionError("competition_cancelled");
      }

      if (match.status === "cancelled") {
        throw new ScheduleActionError("match_cancelled");
      }

      let startsAt: Date | null = null;
      if (rawStartsAt) {
        startsAt = zonedDateTimeToUtc(rawStartsAt, event.timezone);
        if (!startsAt) {
          return {
            status: "error",
            code: "fix_errors",
            fieldErrors: { startsAt: "invalid" },
            draft,
          } satisfies ScheduleActionState;
        }
      }

      let venueId: string | null = null;
      let venueName: string | null = null;
      if (rawVenueId) {
        if (!z.string().uuid().safeParse(rawVenueId).success) {
          return {
            status: "error",
            code: "fix_errors",
            fieldErrors: { venueId: "invalid" },
            draft,
          } satisfies ScheduleActionState;
        }

        const [venue] = await tx
          .select({ id: venues.id, name: venues.name })
          .from(venues)
          .where(
            and(eq(venues.id, rawVenueId), eq(venues.eventId, event.id)),
          )
          .limit(1);

        if (!venue) {
          return {
            status: "error",
            code: "fix_errors",
            fieldErrors: { venueId: "invalid" },
            draft,
          } satisfies ScheduleActionState;
        }
        venueId = venue.id;
        venueName = venue.name;
      }

      let durationOverride: number | null = null;
      if (rawDuration) {
        const parsedDuration = z.coerce
          .number()
          .int()
          .min(1)
          .max(600)
          .safeParse(rawDuration);
        if (!parsedDuration.success) {
          return {
            status: "error",
            code: "fix_errors",
            fieldErrors: { durationMinutes: "invalid" },
            draft,
          } satisfies ScheduleActionState;
        }
        durationOverride = parsedDuration.data;
      }

      const durationMinutes = effectiveDurationMinutes(
        durationOverride,
        match.defaultDurationMinutes,
      );

      if (startsAt && durationMinutes != null) {
        const { scheduled, teamsByMatch } = await loadScheduledMatches(
          tx,
          event.id,
        );
        const candidate: ScheduleCandidate = {
          matchId: match.id,
          matchNumber: match.matchNumber,
          competitionName: match.competitionName,
          startsAt,
          durationMinutes,
          venueId,
          venueName,
          teams: teamsByMatch.get(match.id) ?? [],
        };
        const conflicts = findScheduleConflicts(candidate, scheduled);
        if (conflicts.length) {
          const hasTeamConflict = conflicts.some(
            (conflict) => conflict.kind === "team",
          );
          const hasVenueConflict = conflicts.some(
            (conflict) => conflict.kind === "venue",
          );
          return {
            status: "error",
            code: "schedule_conflict",
            fieldErrors: {
              ...(hasTeamConflict ? { startsAt: "team_conflict" } : {}),
              ...(hasVenueConflict ? { venueId: "venue_conflict" } : {}),
            },
            conflicts: conflicts.map(toConflictView),
            matchId: match.id,
            draft,
          } satisfies ScheduleActionState;
        }
      }

      await tx
        .update(matches)
        .set({
          startsAt,
          venueId,
          durationMinutes: durationOverride,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, match.id));

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: user.id,
        type: startsAt ? "match.scheduled" : "match.unscheduled",
        entityType: "match",
        entityId: match.id,
        summary: startsAt
          ? `Match ${match.matchNumber} scheduled in ${event.timezone}.`
          : `Match ${match.matchNumber} schedule cleared.`,
        metadata: {
          matchId: match.id,
          startsAt: startsAt?.toISOString() ?? null,
          durationMinutes,
          durationOverrideMinutes: durationOverride,
          venueId,
          timezone: event.timezone,
        },
      });

      revalidateSchedule(event.id, event.slug);
      return {
        status: "success",
        code: startsAt ? "match_scheduled" : "match_unscheduled",
        matchId: match.id,
      } satisfies ScheduleActionState;
    });
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEventTimezoneAction(
  _previous: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!z.string().uuid().safeParse(eventId).success) {
    return { status: "error", code: "action_failed" };
  }

  if (!isValidTimeZone(timezone)) {
    return {
      status: "error",
      code: "fix_errors",
      fieldErrors: { timezone: "invalid_timezone" },
    };
  }

  const { user, event } = await requireEventOwner(eventId);
  const previousTimezone = event.timezone;

  try {
    if (previousTimezone === timezone) {
      return { status: "success", code: "timezone_unchanged", timezone };
    }

    await db.transaction(async (tx) => {
      await tx
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, event.id))
        .for("update");

      const matchRows = await tx
        .select({ id: matches.id, startsAt: matches.startsAt })
        .from(matches)
        .innerJoin(competitions, eq(matches.competitionId, competitions.id))
        .where(
          and(
            eq(competitions.eventId, event.id),
            isNotNull(matches.startsAt),
          ),
        );

      for (const match of matchRows) {
        if (!match.startsAt) {
          continue;
        }
        const converted = convertInstantToTimeZone(
          match.startsAt,
          previousTimezone,
          timezone,
        );
        if (!converted) {
          throw new ScheduleActionError("timezone_conversion_failed", {
            timezone: "invalid_timezone",
          });
        }
        await tx
          .update(matches)
          .set({ startsAt: converted, updatedAt: new Date() })
          .where(eq(matches.id, match.id));
      }

      await tx
        .update(events)
        .set({ timezone, updatedAt: new Date() })
        .where(eq(events.id, event.id));

      await tx.insert(auditEvents).values({
        eventId: event.id,
        actorUserId: user.id,
        type: "event.timezone_changed",
        entityType: "event",
        entityId: event.id,
        summary: `Event time zone changed from ${previousTimezone} to ${timezone}; Match wall-clock times preserved.`,
        metadata: {
          previousTimezone,
          timezone,
          convertedMatches: matchRows.length,
        },
      });
    });

    revalidateSchedule(event.id, event.slug);
    return { status: "success", code: "timezone_updated", timezone };
  } catch (error) {
    return actionError(error);
  }
}
