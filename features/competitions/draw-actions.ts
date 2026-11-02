"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";

import { requireEventOwner } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import {
  auditEvents,
  competitions,
  groupEntries,
  groups,
  matches,
  matchEntries,
  matchSlots,
  participants,
  resultVersions,
  teams,
} from "@/lib/db/schema";
import { getRegistrationStatus } from "@/features/competitions/registration";
import { getEntrantRosterStatus } from "@/features/competitions/eligibility";
import {
  buildDrawPlan,
  isCompetitionFormat,
  randomizeDrawOrder,
  validateDrawConfig,
  type CompetitionFormat,
  type DrawConfig,
  type DrawEntrant,
  type DrawPlan,
} from "@/features/competitions/draw";
import { defaultDrawSeed } from "@/features/competitions/draw-queries";

export type DrawActionState = {
  status: "idle" | "success" | "error";
  code?: string;
  fieldErrors?: Record<string, string>;
};

type DrawTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

type DrawEntrantRow = {
  id: string;
  name: string;
  seedPosition: number | null;
};

class DrawActionError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;

  constructor(code: string, fieldErrors?: Record<string, string>) {
    super(code);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function revalidateDraw(eventId: string, competitionId: string, eventSlug: string, competitionSlug: string) {
  revalidatePath(`/admin/events/${eventId}/competitions/${competitionId}`);
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventSlug}`);
  revalidatePath(`/events/${eventSlug}/competitions/${competitionSlug}`);
  revalidatePath(`/events/${eventSlug}/fixtures`);
  revalidatePath("/manage");
  revalidatePath("/manage/matches");
}

function actionError(error: unknown): DrawActionState {
  if (error instanceof DrawActionError) {
    return {
      status: "error",
      code: error.code,
      fieldErrors: error.fieldErrors,
    };
  }
  console.error("draw action failed", error);
  return { status: "error", code: "action_failed" };
}

function parseConfig(formData: FormData): DrawConfig {
  const rawFormat = formData.get("format");
  if (!isCompetitionFormat(rawFormat)) {
    throw new DrawActionError("invalid_format", { format: "invalid" });
  }

  const groupCount = z.coerce.number().int().safeParse(
    formData.get("groupCount") ?? 2,
  );
  const qualifiersPerGroup = z.coerce.number().int().safeParse(
    formData.get("qualifiersPerGroup") ?? 2,
  );

  if (!groupCount.success) {
    throw new DrawActionError("invalid_group_count", {
      groupCount: "invalid",
    });
  }
  if (!qualifiersPerGroup.success) {
    throw new DrawActionError("invalid_qualifiers", {
      qualifiersPerGroup: "invalid",
    });
  }

  const seed = String(formData.get("seed") ?? "").trim();

  return {
    format: rawFormat,
    groupCount: groupCount.data,
    qualifiersPerGroup: qualifiersPerGroup.data,
    seed,
  };
}

function lockedConfigFormat(
  competition: { format: CompetitionFormat; drawGeneratedAt: Date | null },
  requested: CompetitionFormat,
) {
  if (competition.drawGeneratedAt && requested !== competition.format) {
    throw new DrawActionError("format_locked");
  }
  return requested;
}

function formatForCompetition(
  competition: typeof competitions.$inferSelect,
): CompetitionFormat {
  return competition.format;
}

async function withDrawMutation(
  eventId: string,
  competitionId: string,
  callback: (context: {
    tx: DrawTransaction;
    userId: string;
    eventId: string;
    eventSlug: string;
    competition: typeof competitions.$inferSelect;
    entrants: DrawEntrantRow[];
    eligibleEntrantCount: number;
    orderedEntrants: DrawEntrant[];
  }) => Promise<DrawActionState>,
): Promise<DrawActionState> {
  try {
    if (
      !z.string().uuid().safeParse(eventId).success ||
      !z.string().uuid().safeParse(competitionId).success
    ) {
      throw new DrawActionError("action_failed");
    }

    const { user, event } = await requireEventOwner(eventId);

    const result = await db.transaction(async (tx) => {
      const [competition] = await tx
        .select()
        .from(competitions)
        .where(
          and(
            eq(competitions.id, competitionId),
            eq(competitions.eventId, event.id),
          ),
        )
        .for("update")
        .limit(1);

      if (!competition) {
        throw new DrawActionError("action_failed");
      }

      const entrantRows = await tx
        .select({
          id: teams.id,
          name: teams.name,
          seedPosition: teams.seedPosition,
        })
        .from(teams)
        .where(eq(teams.competitionId, competition.id))
        .orderBy(teams.seedPosition, teams.name);

      const participantRows = await tx
        .select({
          teamId: participants.teamId,
          dateOfBirth: participants.dateOfBirth,
        })
        .from(participants)
        .where(eq(participants.competitionId, competition.id));

      const participantsByTeam = new Map<string, string[]>();
      for (const participant of participantRows) {
        const list = participantsByTeam.get(participant.teamId) ?? [];
        list.push(participant.dateOfBirth);
        participantsByTeam.set(participant.teamId, list);
      }

      const eligibleEntrantCount = entrantRows.filter((entrant) => {
        const dates = participantsByTeam.get(entrant.id) ?? [];
        return (
          getEntrantRosterStatus({
            participantCount: dates.length,
            dateOfBirths: dates,
            birthDateFrom: competition.birthDateFrom,
            birthDateTo: competition.birthDateTo,
            rosterMin: competition.rosterMin,
            rosterMax: competition.rosterMax,
          }) === "ok"
        );
      }).length;

      const orderedRows = [...entrantRows].sort(
        (a, b) =>
          (a.seedPosition ?? Number.MAX_SAFE_INTEGER) -
            (b.seedPosition ?? Number.MAX_SAFE_INTEGER) ||
          a.name.localeCompare(b.name),
      );
      const orderedEntrants: DrawEntrant[] = orderedRows.map(
        (entrant, index) => ({
          id: entrant.id,
          name: entrant.name,
          seedPosition: index + 1,
        }),
      );

      return callback({
        tx,
        userId: user.id,
        eventId: event.id,
        eventSlug: event.slug,
        competition,
        entrants: entrantRows,
        eligibleEntrantCount,
        orderedEntrants,
      });
    });

    return result;
  } catch (error) {
    return actionError(error);
  }
}

async function assertDrawEditable(
  tx: DrawTransaction,
  competitionId: string,
) {
  const [confirmed] = await tx
    .select({ id: resultVersions.id })
    .from(resultVersions)
    .innerJoin(matches, eq(resultVersions.matchId, matches.id))
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(resultVersions.isCurrent, true),
        ne(matches.status, "cancelled"),
        isNull(matches.cancelledAt),
      ),
    )
    .limit(1);

  if (confirmed) {
    throw new DrawActionError("draw_locked");
  }

  const [cancelledMatch] = await tx
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.competitionId, competitionId),
        eq(matches.status, "cancelled"),
      ),
    )
    .limit(1);

  if (cancelledMatch) {
    throw new DrawActionError("cancelled_match_exists");
  }
}

function assertNotCancelled(competition: typeof competitions.$inferSelect) {
  if (
    competition.status === "cancelled" ||
    competition.status === "completed"
  ) {
    throw new DrawActionError("competition_locked");
  }
}

function assertGenerationReady(
  competition: typeof competitions.$inferSelect,
  entrantCount: number,
  eligibleEntrantCount: number,
  config: DrawConfig,
) {
  assertNotCancelled(competition);
  lockedConfigFormat(competition, config.format);

  const registration = getRegistrationStatus(competition);
  if (registration.open) {
    throw new DrawActionError("registration_open");
  }

  const errors = validateDrawConfig({
    format: config.format,
    entrantCount,
    eligibleEntrantCount,
    groupCount: config.groupCount,
    qualifiersPerGroup: config.qualifiersPerGroup,
  });
  if (errors.length) {
    const first = errors[0]!;
    throw new DrawActionError(first, {
      [first === "invalid_qualifiers"
        ? "qualifiersPerGroup"
        : first === "invalid_group_count"
          ? "groupCount"
          : first === "invalid_format"
            ? "format"
            : "draw"]: first,
    });
  }
}

async function ensureDrawOrder(
  tx: DrawTransaction,
  competitionId: string,
  entrants: DrawEntrantRow[],
) {
  const ordered = [...entrants].sort(
    (a, b) =>
      (a.seedPosition ?? Number.MAX_SAFE_INTEGER) -
        (b.seedPosition ?? Number.MAX_SAFE_INTEGER) ||
      a.name.localeCompare(b.name),
  );
  const needsUpdate = ordered.some(
    (entrant, index) => entrant.seedPosition !== index + 1,
  );

  if (!needsUpdate) {
    return;
  }

  for (let index = 0; index < ordered.length; index += 1) {
    await tx
      .update(teams)
      .set({ seedPosition: index + 1 })
      .where(eq(teams.id, ordered[index]!.id));
  }
  void competitionId;
}

async function persistDraw({
  tx,
  competition,
  plan,
  now,
  actorUserId,
}: {
  tx: DrawTransaction;
  competition: typeof competitions.$inferSelect;
  plan: DrawPlan;
  now: Date;
  actorUserId: string;
}) {
  await tx
    .delete(matches)
    .where(eq(matches.competitionId, competition.id));
  await tx
    .delete(groups)
    .where(eq(groups.competitionId, competition.id));

  const groupRows = plan.groups.length
    ? await tx
        .insert(groups)
        .values(
          plan.groups.map((group) => ({
            competitionId: competition.id,
            name: group.name,
            sortOrder: group.index + 1,
          })),
        )
        .returning({ id: groups.id, name: groups.name })
    : [];

  const groupIdByName = new Map(
    groupRows.map((group) => [group.name, group.id]),
  );

  const entryValues = plan.groups.flatMap((group) =>
    group.entrants.map((entrant, index) => ({
      groupId: groupIdByName.get(group.name)!,
      teamId: entrant.id,
      seedPosition: index + 1,
    })),
  );
  if (entryValues.length) {
    await tx.insert(groupEntries).values(entryValues);
  }

  const groupFixtures = [...plan.groupFixtures].sort(
    (a, b) =>
      a.groupIndex - b.groupIndex ||
      a.roundNumber - b.roundNumber ||
      a.pairingIndex - b.pairingIndex,
  );
  const knockoutFixtures = [...plan.knockoutFixtures].sort(
    (a, b) =>
      a.roundNumber - b.roundNumber || a.bracketSlot - b.bracketSlot,
  );

  let matchNumber = 1;
  const groupFixtureByNumber = new Map<
    number,
    (typeof groupFixtures)[number]
  >();
  const knockoutFixtureByNumber = new Map<
    number,
    (typeof knockoutFixtures)[number]
  >();
  const knockoutNumberByKey = new Map<string, number>();

  const values: Array<typeof matches.$inferInsert> = [];

  for (const fixture of groupFixtures) {
    values.push({
      competitionId: competition.id,
      groupId:
        plan.groups.length > 0
          ? groupIdByName.get(plan.groups[fixture.groupIndex]!.name)!
          : null,
      stage: "group",
      roundNumber: fixture.roundNumber,
      bracketSlot: null,
      matchNumber,
      durationMinutes: competition.defaultMatchDurationMinutes,
      status: "scheduled",
      isBye: false,
    });
    groupFixtureByNumber.set(matchNumber, fixture);
    matchNumber += 1;
  }

  for (const fixture of knockoutFixtures) {
    values.push({
      competitionId: competition.id,
      groupId: null,
      stage: "knockout",
      roundNumber: fixture.roundNumber,
      bracketSlot: fixture.bracketSlot,
      matchNumber,
      durationMinutes: competition.defaultMatchDurationMinutes,
      status: "scheduled",
      isBye: fixture.isBye,
    });
    knockoutFixtureByNumber.set(matchNumber, fixture);
    knockoutNumberByKey.set(
      `${fixture.roundNumber}:${fixture.bracketSlot}`,
      matchNumber,
    );
    matchNumber += 1;
  }

  const insertedMatches = await tx
    .insert(matches)
    .values(values)
    .returning({ id: matches.id, matchNumber: matches.matchNumber });
  const matchIdByNumber = new Map(
    insertedMatches.map((match) => [match.matchNumber, match.id]),
  );

  const matchEntryValues: Array<typeof matchEntries.$inferInsert> = [];
  for (const [number, fixture] of groupFixtureByNumber) {
    const matchId = matchIdByNumber.get(number)!;
    matchEntryValues.push(
      {
        matchId,
        side: "home",
        teamId: fixture.homeEntrantId,
      },
      {
        matchId,
        side: "away",
        teamId: fixture.awayEntrantId,
      },
    );
  }

  const slotValues: Array<typeof matchSlots.$inferInsert> = [];
  for (const [number, fixture] of knockoutFixtureByNumber) {
    const matchId = matchIdByNumber.get(number)!;
    fixture.sources.forEach((source, index) => {
      const side = index === 0 ? "home" : "away";

      if (source.type === "entrant") {
        matchEntryValues.push({
          matchId,
          side,
          teamId: source.entrantId,
        });
        return;
      }

      if (source.type === "group_qualifier") {
        slotValues.push({
          matchId,
          side,
          sourceType: "group_qualifier",
          groupId: groupIdByName.get(source.groupName)!,
          groupPosition: source.position,
        });
        return;
      }

      if (source.type === "match_winner") {
        const sourceNumber = knockoutNumberByKey.get(
          `${source.roundNumber}:${source.bracketSlot}`,
        );
        if (!sourceNumber) {
          throw new DrawActionError("action_failed");
        }
        slotValues.push({
          matchId,
          side,
          sourceType: "match_winner",
          sourceMatchId: matchIdByNumber.get(sourceNumber)!,
        });
        return;
      }

      slotValues.push({
        matchId,
        side,
        sourceType: "bye",
      });
    });
  }
  if (matchEntryValues.length) {
    await tx.insert(matchEntries).values(matchEntryValues);
  }
  if (slotValues.length) {
    await tx.insert(matchSlots).values(slotValues);
  }

  await tx
    .update(competitions)
    .set({
      format: plan.config.format,
      drawSeed: plan.config.seed,
      drawGeneratedAt: now,
      groupCount: plan.config.groupCount,
      qualifiersPerGroup: plan.config.qualifiersPerGroup,
      bracketSize: plan.bracketSize || null,
      registrationState: "closed",
      status: "in_progress",
      updatedAt: now,
    })
    .where(eq(competitions.id, competition.id));

  await tx.insert(auditEvents).values({
    eventId: competition.eventId,
    actorUserId,
    type: "draw.generated",
    entityType: "competition",
    entityId: competition.id,
    summary: `${competition.name} ${plan.config.format} draw generated from seed ${plan.config.seed}.`,
    metadata: {
      format: plan.config.format,
      seed: plan.config.seed,
      groups: plan.groups.length,
      qualifiersPerGroup: plan.config.qualifiersPerGroup,
      entrantCount: plan.entrantCount,
      groupFixtures: groupFixtureByNumber.size,
      knockoutMatches: knockoutFixtureByNumber.size,
      byes: knockoutFixtures.filter((fixture) => fixture.isBye).length,
      bracketSize: plan.bracketSize,
    },
  });
}

export async function generateDrawAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");

  return withDrawMutation(eventId, competitionId, async (context) => {
    const rawConfig = parseConfig(formData);
    await assertDrawEditable(context.tx, context.competition.id);
    const seed =
      rawConfig.seed ||
      context.competition.drawSeed ||
      defaultDrawSeed(context.competition.id);
    const config = {
      ...rawConfig,
      format: lockedConfigFormat(context.competition, rawConfig.format),
      seed,
    };

    assertGenerationReady(
      context.competition,
      context.orderedEntrants.length,
      context.eligibleEntrantCount,
      config,
    );
    await ensureDrawOrder(
      context.tx,
      context.competition.id,
      context.entrants,
    );

    const plan = buildDrawPlan(context.orderedEntrants, config);
    await persistDraw({
      tx: context.tx,
      competition: context.competition,
      plan,
      now: new Date(),
      actorUserId: context.userId,
    });

    revalidateDraw(
      context.eventId,
      context.competition.id,
      context.eventSlug,
      context.competition.slug,
    );
    return { status: "success", code: "draw_generated" };
  });
}

export async function saveDrawConfigAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");

  return withDrawMutation(eventId, competitionId, async (context) => {
    const rawConfig = parseConfig(formData);
    await assertDrawEditable(context.tx, context.competition.id);
    assertNotCancelled(context.competition);

    const seed =
      rawConfig.seed ||
      context.competition.drawSeed ||
      defaultDrawSeed(context.competition.id);
    const config = {
      ...rawConfig,
      format: lockedConfigFormat(context.competition, rawConfig.format),
      seed,
    };

    const errors = validateDrawConfig({
      format: config.format,
      entrantCount: context.orderedEntrants.length,
      eligibleEntrantCount: context.eligibleEntrantCount,
      groupCount: config.groupCount,
      qualifiersPerGroup: config.qualifiersPerGroup,
    });
    if (errors.length) {
      throw new DrawActionError(errors[0]!, {
        [errors[0] === "invalid_qualifiers"
          ? "qualifiersPerGroup"
          : errors[0] === "invalid_group_count"
            ? "groupCount"
            : errors[0] === "invalid_format"
              ? "format"
              : "draw"]: errors[0]!,
      });
    }

    if (context.competition.drawGeneratedAt) {
      assertGenerationReady(
        context.competition,
        context.orderedEntrants.length,
        context.eligibleEntrantCount,
        config,
      );
      await ensureDrawOrder(
        context.tx,
        context.competition.id,
        context.entrants,
      );
      const plan = buildDrawPlan(context.orderedEntrants, config);
      await persistDraw({
        tx: context.tx,
        competition: context.competition,
        plan,
        now: new Date(),
        actorUserId: context.userId,
      });
    } else {
      await context.tx
        .update(competitions)
        .set({
          format: config.format,
          groupCount: config.groupCount,
          qualifiersPerGroup: config.qualifiersPerGroup,
          drawSeed: seed,
          updatedAt: new Date(),
        })
        .where(eq(competitions.id, context.competition.id));
    }

    await context.tx.insert(auditEvents).values({
      eventId: context.eventId,
      actorUserId: context.userId,
      type: "draw.configured",
      entityType: "competition",
      entityId: context.competition.id,
      summary: `${context.competition.name} draw configuration saved.`,
      metadata: {
        format: config.format,
        seed,
        groups: config.groupCount,
        qualifiersPerGroup: config.qualifiersPerGroup,
      },
    });

    revalidateDraw(
      context.eventId,
      context.competition.id,
      context.eventSlug,
      context.competition.slug,
    );
    return { status: "success", code: "draw_saved" };
  });
}

export async function regenerateDrawSeedAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");

  return withDrawMutation(eventId, competitionId, async (context) => {
    const rawConfig = parseConfig(formData);
    await assertDrawEditable(context.tx, context.competition.id);
    assertNotCancelled(context.competition);

    const seed = `summer-cup-${randomBytes(4).toString("hex")}`;
    const config = {
      ...rawConfig,
      format: lockedConfigFormat(context.competition, rawConfig.format),
      seed,
    };
    const errors = validateDrawConfig({
      format: config.format,
      entrantCount: context.orderedEntrants.length,
      eligibleEntrantCount: context.eligibleEntrantCount,
      groupCount: config.groupCount,
      qualifiersPerGroup: config.qualifiersPerGroup,
    });
    if (errors.length) {
      throw new DrawActionError(errors[0]!);
    }

    const randomized = randomizeDrawOrder(
      context.orderedEntrants,
      config.seed,
    );
    for (const entrant of randomized) {
      await context.tx
        .update(teams)
        .set({ seedPosition: entrant.seedPosition })
        .where(eq(teams.id, entrant.id));
    }

    if (context.competition.drawGeneratedAt) {
      assertGenerationReady(
        context.competition,
        context.orderedEntrants.length,
        context.eligibleEntrantCount,
        config,
      );
      const plan = buildDrawPlan(randomized, config);
      await persistDraw({
        tx: context.tx,
        competition: context.competition,
        plan,
        now: new Date(),
        actorUserId: context.userId,
      });
    } else {
      await context.tx
        .update(competitions)
        .set({
          format: config.format,
          groupCount: config.groupCount,
          qualifiersPerGroup: config.qualifiersPerGroup,
          drawSeed: seed,
          updatedAt: new Date(),
        })
        .where(eq(competitions.id, context.competition.id));
    }

    await context.tx.insert(auditEvents).values({
      eventId: context.eventId,
      actorUserId: context.userId,
      type: "draw.seed_regenerated",
      entityType: "competition",
      entityId: context.competition.id,
      summary: `${context.competition.name} draw seed regenerated.`,
      metadata: { format: config.format, seed },
    });

    revalidateDraw(
      context.eventId,
      context.competition.id,
      context.eventSlug,
      context.competition.slug,
    );
    return { status: "success", code: "seed_regenerated" };
  });
}

export async function swapDrawEntrantsAction(
  _previous: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const eventId = String(formData.get("eventId") ?? "");
  const competitionId = String(formData.get("competitionId") ?? "");
  const firstTeamId = String(formData.get("firstTeamId") ?? "");
  const secondTeamId = String(formData.get("secondTeamId") ?? "");

  if (
    !z.string().uuid().safeParse(firstTeamId).success ||
    !z.string().uuid().safeParse(secondTeamId).success ||
    firstTeamId === secondTeamId
  ) {
    return { status: "error", code: "invalid_swap" };
  }

  return withDrawMutation(eventId, competitionId, async (context) => {
    await assertDrawEditable(context.tx, context.competition.id);
    assertNotCancelled(context.competition);
    await ensureDrawOrder(
      context.tx,
      context.competition.id,
      context.entrants,
    );

    const first = context.orderedEntrants.find(
      (entrant) => entrant.id === firstTeamId,
    );
    const second = context.orderedEntrants.find(
      (entrant) => entrant.id === secondTeamId,
    );
    if (!first || !second) {
      throw new DrawActionError("invalid_swap");
    }

    const firstPosition = first.seedPosition;
    const secondPosition = second.seedPosition;
    if (firstPosition == null || secondPosition == null) {
      throw new DrawActionError("invalid_swap");
    }

    await context.tx
      .update(teams)
      .set({ seedPosition: secondPosition })
      .where(eq(teams.id, first.id));
    await context.tx
      .update(teams)
      .set({ seedPosition: firstPosition })
      .where(eq(teams.id, second.id));

    const swappedOrder = [...context.orderedEntrants]
      .map((entrant) => {
        if (entrant.id === first.id) {
          return { ...entrant, seedPosition: secondPosition };
        }
        if (entrant.id === second.id) {
          return { ...entrant, seedPosition: firstPosition };
        }
        return entrant;
      })
      .sort((a, b) => a.seedPosition - b.seedPosition);

    if (context.competition.drawGeneratedAt) {
      const swapConfig: DrawConfig = {
        format: formatForCompetition(context.competition),
        groupCount: context.competition.groupCount,
        qualifiersPerGroup: context.competition.qualifiersPerGroup,
        seed:
          context.competition.drawSeed ??
          defaultDrawSeed(context.competition.id),
      };
      assertGenerationReady(
        context.competition,
        swappedOrder.length,
        context.eligibleEntrantCount,
        swapConfig,
      );
      const plan = buildDrawPlan(swappedOrder, swapConfig);
      await persistDraw({
        tx: context.tx,
        competition: context.competition,
        plan,
        now: new Date(),
        actorUserId: context.userId,
      });
    }

    await context.tx.insert(auditEvents).values({
      eventId: context.eventId,
      actorUserId: context.userId,
      type: "draw.entrants_swapped",
      entityType: "competition",
      entityId: context.competition.id,
      summary: `${context.competition.name} draw entrants swapped.`,
      metadata: {
        firstTeamId,
        secondTeamId,
        firstPosition,
        secondPosition,
      },
    });

    revalidateDraw(
      context.eventId,
      context.competition.id,
      context.eventSlug,
      context.competition.slug,
    );
    return { status: "success", code: "entrant_swapped" };
  });
}
