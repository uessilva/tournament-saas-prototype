import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import {
  competitions,
  events,
  teamManagers,
  teams,
  users,
} from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const id = session?.user?.id;

  if (!id) {
    return null;
  }

  return {
    id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
});

export async function requireUser(callbackUrl: string): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return user;
}

export async function requireEventOwner(eventId: string) {
  if (!z.string().uuid().safeParse(eventId).success) {
    notFound();
  }

  const user = await requireUser(`/admin/events/${eventId}`);
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event || event.ownerId !== user.id) {
    notFound();
  }

  return { user, event };
}

export async function requireTeamManager(teamId: string) {
  if (!z.string().uuid().safeParse(teamId).success) {
    notFound();
  }

  const user = await requireUser(`/manage/teams/${teamId}`);

  const assignment = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      competitionId: competitions.id,
      competitionName: competitions.name,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
    })
    .from(teamManagers)
    .innerJoin(teams, eq(teamManagers.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .innerJoin(events, eq(competitions.eventId, events.id))
    .where(and(eq(teamManagers.userId, user.id), eq(teamManagers.teamId, teamId)))
    .limit(1);

  const team = assignment[0];

  if (!team) {
    notFound();
  }

  return { user, team };
}

export async function getManagedTeams(userId: string) {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamShortName: teams.shortName,
      competitionId: competitions.id,
      competitionName: competitions.name,
      competitionSlug: competitions.slug,
      sport: competitions.sport,
      competitionStatus: competitions.status,
      registrationState: competitions.registrationState,
      eventId: events.id,
      eventName: events.name,
      eventSlug: events.slug,
      eventTimezone: events.timezone,
    })
    .from(teamManagers)
    .innerJoin(teams, eq(teamManagers.teamId, teams.id))
    .innerJoin(competitions, eq(teams.competitionId, competitions.id))
    .innerJoin(events, eq(competitions.eventId, events.id))
    .where(eq(teamManagers.userId, userId))
    .orderBy(teams.name);
}

export async function getOwnedEvents(userId: string) {
  return db.query.events.findMany({
    where: eq(events.ownerId, userId),
    orderBy: (eventsTable, { desc }) => [desc(eventsTable.startsAt)],
  });
}

export type DemoAccount = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager";
  detail: string;
};

export async function getDemoAccounts(): Promise<DemoAccount[]> {
  try {
    const ownerRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        eventName: events.name,
      })
      .from(events)
      .innerJoin(users, eq(events.ownerId, users.id));

    const managerRows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        teamName: teams.name,
      })
      .from(teamManagers)
      .innerJoin(users, eq(teamManagers.userId, users.id))
      .innerJoin(teams, eq(teamManagers.teamId, teams.id));

    const accounts: DemoAccount[] = ownerRows.map((owner) => ({
      id: owner.id,
      name: owner.name ?? owner.email,
      email: owner.email,
      role: "owner",
      detail: owner.eventName,
    }));

    const seenManagers = new Set<string>();
    for (const manager of managerRows) {
      if (seenManagers.has(manager.id)) {
        continue;
      }
      seenManagers.add(manager.id);
      accounts.push({
        id: manager.id,
        name: manager.name ?? manager.email,
        email: manager.email,
        role: "manager",
        detail: manager.teamName,
      });
    }

    return accounts;
  } catch {
    return [];
  }
}
