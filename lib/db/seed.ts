import { createHash, randomBytes, randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "./client";
import {
  DEMO_EVENT_ID,
  DEMO_EVENT_SLUG,
  DEMO_FOOTBALL_COMPETITION_ID,
  DEMO_MANAGER_ACCOUNTS,
  DEMO_OWNER_EMAIL,
  DEMO_OWNER_ID,
  DEMO_TENNIS_COMPETITION_ID,
  DEMO_TIMEZONE,
} from "./demo";
import * as t from "./schema";

const DAY_MS = 24 * 60 * 60 * 1000;

const TABLES = [
  "authenticators",
  "accounts",
  "sessions",
  "verification_tokens",
  "access_events",
  "audit_events",
  "disputes",
  "extracted_fields",
  "scoresheets",
  "participant_statistics",
  "tennis_results",
  "football_results",
  "result_versions",
  "match_entries",
  "matches",
  "group_entries",
  "groups",
  "invitation_teams",
  "manager_invitations",
  "team_managers",
  "participants",
  "teams",
  "competitions",
  "venues",
  "events",
  "jobs",
  "users",
] as const;

export type DemoResetSummary = {
  eventId: string;
  eventSlug: string;
  counts: {
    users: number;
    teams: number;
    participants: number;
    matches: number;
    publishedResults: number;
    pendingInvitations: number;
  };
};

export function assertDemoResetAllowed() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_RESET !== "true"
  ) {
    throw new Error("Demo reset is disabled in production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env and start Docker Compose.",
    );
  }

  let hostname = "";
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid PostgreSQL URL.");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
  if (
    !localHosts.has(hostname) &&
    process.env.ALLOW_REMOTE_DEMO_RESET !== "true"
  ) {
    throw new Error(
      `Refusing to reset a non-local database host (${hostname}). Set ALLOW_REMOTE_DEMO_RESET=true only for a disposable demo database.`,
    );
  }
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function atUtc(base: Date, dayOffset: number, hour: number, minute = 0) {
  const date = new Date(base);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

function newTokenHash() {
  // The raw token is intentionally discarded. Only a one-way hash is stored.
  return hashToken(randomBytes(32).toString("base64url"));
}

const FOOTBALL_TEAM_NAMES = [
  "Riverside Rovers",
  "Harbour Athletic",
  "Westfield Juniors",
  "Northgate United",
  "Meadow Park FC",
  "Stonebridge City",
  "Kingsway Colts",
  "Lakeside Rangers",
] as const;

const FOOTBALL_MANAGERS = [
  { name: "Maya Chen", email: "maya.chen@example.com" },
  { name: "Samuel Okoye", email: "samuel.okoye@example.com" },
  { name: "Beatriz Nunes", email: "beatriz.nunes@example.com" },
  { name: "Lucas Ferreira", email: "lucas.ferreira@example.com" },
  { name: "Priya Raman", email: "priya.raman@example.com" },
  { name: "Tomás Silva", email: "tomas.silva@example.com" },
  { name: "Nadia Haddad", email: "nadia.haddad@example.com" },
  { name: "João Pedro Alves", email: "joao.alves@example.com" },
] as const;

const PENDING_TEAM_INDICES = new Set([6, 7]);

const TENNIS_PLAYERS = [
  "Helena Costa",
  "Rafael Sato",
  "Amara Diallo",
  "Nicolas Weber",
  "Sofia Almeida",
  "Ethan Brooks",
  "Larissa Gomes",
  "Daniel Kim",
] as const;

const FIRST_NAMES = [
  "Gabriel",
  "Lorenzo",
  "Théo",
  "Arthur",
  "Noah",
  "Miguel",
  "Davi",
  "Oliver",
  "Ravi",
  "Bento",
  "Caio",
  "Elias",
  "Liam",
  "Mateus",
  "Joaquim",
  "Theo",
  "Samir",
  "Leo",
  "Rafael",
  "Isaac",
  "Daniel",
  "Vicente",
  "Hugo",
  "Tomás",
  "Anton",
  "Benício",
  "Pedro",
  "Enzo",
  "Luan",
  "Kai",
  "Ari",
  "Nicolas",
  "Murilo",
  "Ian",
  "Samuel",
  "Vitor",
  "Caleb",
  "Heitor",
  "Dante",
  "Yuri",
  "Otávio",
  "Jonas",
  "Máximo",
  "Érico",
  "Felipe",
  "Bruno",
  "Ayo",
  "Akira",
] as const;

const LAST_NAMES = [
  "Almeida",
  "Barbosa",
  "Cardoso",
  "Duarte",
  "Esteves",
  "Ferreira",
  "Gomes",
  "Henrique",
  "Iglesias",
  "Junqueira",
  "Kim",
  "Lima",
  "Martins",
  "Nakamura",
  "Oliveira",
  "Pereira",
  "Queiroz",
  "Ribeiro",
  "Santos",
  "Teixeira",
  "Ueda",
  "Vieira",
  "Weber",
  "Xavier",
] as const;

function footballPosition(playerIndex: number) {
  if (playerIndex === 0) {
    return "Goleiro";
  }
  if (playerIndex <= 4) {
    return "Defensor";
  }
  if (playerIndex <= 8) {
    return "Meio-campista";
  }
  return "Atacante";
}

type TennisMatchSpec = {
  groupIndex: number;
  roundIndex: number;
  homeIndex: number;
  awayIndex: number;
  published: boolean;
};

const TENNIS_PAIRINGS: Array<[number, number]> = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

function tennisSetsFor(matchIndex: number, homeWon: boolean) {
  // Every pattern favours the home side; flipping it produces an away win.
  const homeWinPatterns = [
    [
      { home: 6, away: 4 },
      { home: 6, away: 3 },
    ],
    [
      { home: 4, away: 6 },
      { home: 6, away: 3 },
      { home: 6, away: 2 },
    ],
    [
      { home: 7, away: 6, tiebreakHome: 5, tiebreakAway: 3 },
      { home: 6, away: 4 },
    ],
    [
      { home: 6, away: 2 },
      { home: 6, away: 2 },
    ],
    [
      { home: 6, away: 4 },
      { home: 3, away: 6 },
      { home: 7, away: 5 },
    ],
    [
      { home: 6, away: 3 },
      { home: 6, away: 4 },
    ],
  ][matchIndex % 6]!;

  if (homeWon) {
    return homeWinPatterns;
  }

  return homeWinPatterns.map((set) => ({
    home: set.away,
    away: set.home,
    tiebreakHome: set.tiebreakAway,
    tiebreakAway: set.tiebreakHome,
  }));
}

export async function resetDemoData(): Promise<DemoResetSummary> {
  assertDemoResetAllowed();

  const now = new Date();
  const eventStart = atUtc(now, -1, 12, 0);
  const eventEnd = atUtc(now, 6, 23, 0);
  const registrationDeadline = addDays(now, 4);

  return db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(
        `TRUNCATE TABLE ${TABLES.map((name) => `"${name}"`).join(", ")} RESTART IDENTITY CASCADE`,
      ),
    );

    // Users -----------------------------------------------------------------
    const managerUsers = DEMO_MANAGER_ACCOUNTS.map((manager) => ({
      id: manager.id,
      name: manager.name,
      email: manager.email,
      emailVerified: now,
    }));

    await tx.insert(t.users).values([
      {
        id: DEMO_OWNER_ID,
        name: "Alex Moreira",
        email: DEMO_OWNER_EMAIL,
        emailVerified: now,
      },
      ...managerUsers,
    ]);

    // Event and venues ------------------------------------------------------
    await tx.insert(t.events).values({
      id: DEMO_EVENT_ID,
      ownerId: DEMO_OWNER_ID,
      name: "Summer Cup 2026",
      slug: DEMO_EVENT_SLUG,
      tagline: "Dois esportes. Um verão inteiro de jogo.",
      description:
        "O Summer Cup reúne futebol de base e tênis em uma semana de competição no Parque Esportivo do Sol. Acompanhe cada rodada, resultado e classificação sem precisar criar uma conta.",
      timezone: DEMO_TIMEZONE,
      locationLabel: "Parque Esportivo do Sol · São Paulo",
      startsAt: eventStart,
      endsAt: eventEnd,
      isPublished: true,
    });

    const venueRows = await tx
      .insert(t.venues)
      .values([
        { eventId: DEMO_EVENT_ID, name: "Campo Principal", slug: "campo-principal", sortOrder: 1 },
        { eventId: DEMO_EVENT_ID, name: "Campo 2", slug: "campo-2", sortOrder: 2 },
        { eventId: DEMO_EVENT_ID, name: "Quadra Central", slug: "quadra-central", sortOrder: 3 },
        { eventId: DEMO_EVENT_ID, name: "Quadra 2", slug: "quadra-2", sortOrder: 4 },
      ])
      .returning({ id: t.venues.id, slug: t.venues.slug });

    const venueBySlug = new Map(venueRows.map((venue) => [venue.slug, venue.id]));

    // Competitions ----------------------------------------------------------
    await tx.insert(t.competitions).values([
      {
        id: DEMO_FOOTBALL_COMPETITION_ID,
        eventId: DEMO_EVENT_ID,
        name: "Under-12 Football",
        slug: "under-12-football",
        sport: "football",
        format: "groups_knockout",
        description:
          "Oito equipes, dois grupos e mata-mata. O futebol Sub-12 abre o Summer Cup com jogos curtos, intensos e muita torcida.",
        eligibilityNotes:
          "Atletas nascidos entre 1º de janeiro de 2014 e 31 de dezembro de 2015. Elencos de 9 a 14 jogadores.",
        birthDateFrom: "2014-01-01",
        birthDateTo: "2015-12-31",
        rosterMin: 9,
        rosterMax: 14,
        registrationState: "open",
        registrationDeadline,
        qualifiersPerGroup: 2,
        defaultMatchDurationMinutes: 50,
        status: "registration_open",
        sortOrder: 1,
      },
      {
        id: DEMO_TENNIS_COMPETITION_ID,
        eventId: DEMO_EVENT_ID,
        name: "Tennis Open",
        slug: "tennis-open",
        sport: "tennis",
        format: "groups_knockout",
        description:
          "Singles aberto em dois grupos, com os dois melhores de cada grupo avançando para as semifinais. Sets de melhor de três.",
        eligibilityNotes:
          "Entrada individual. Cada inscrito compete como uma equipe de um participante.",
        rosterMin: 1,
        rosterMax: 1,
        registrationState: "closed",
        qualifiersPerGroup: 2,
        defaultMatchDurationMinutes: 90,
        drawSeed: "summer-cup-tennis-2026",
        drawGeneratedAt: addDays(now, -3),
        status: "in_progress",
        sortOrder: 2,
      },
    ]);

    // Football teams, managers, invitations, and rosters --------------------
    const footballTeamRows = await tx
      .insert(t.teams)
      .values(
        FOOTBALL_TEAM_NAMES.map((name, index) => ({
          competitionId: DEMO_FOOTBALL_COMPETITION_ID,
          name,
          slug: slugify(name),
          shortName: name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 3),
          primaryColor: ["#176b46", "#0f4c81", "#a34b1f", "#5b3a8c", "#176b46", "#7a1f2b", "#1e6b73", "#8c6a1f"][
            index
          ],
          seedPosition: index + 1,
          isActive: true,
        })),
      )
      .returning({ id: t.teams.id, name: t.teams.name });

    const footballTeamByName = new Map(
      footballTeamRows.map((team) => [team.name, team.id]),
    );

    const managerByTeamIndex = new Map<number, (typeof DEMO_MANAGER_ACCOUNTS)[number]>();
    DEMO_MANAGER_ACCOUNTS.forEach((manager) => {
      const index = FOOTBALL_TEAM_NAMES.findIndex(
        (teamName) => teamName === manager.team,
      );
      if (index >= 0) {
        managerByTeamIndex.set(index, manager);
      }
    });

    const teamManagerValues: Array<typeof t.teamManagers.$inferInsert> = [];
    const invitationValues: Array<typeof t.managerInvitations.$inferInsert> = [];
    const invitationTeamValues: Array<typeof t.invitationTeams.$inferInsert> = [];
    const accessEventValues: Array<typeof t.accessEvents.$inferInsert> = [];
    const auditValues: Array<typeof t.auditEvents.$inferInsert> = [];

    FOOTBALL_TEAM_NAMES.forEach((teamName, index) => {
      const teamId = footballTeamByName.get(teamName)!;
      const manager = managerByTeamIndex.get(index);
      const invitationId = randomUUID();
      const isPending = PENDING_TEAM_INDICES.has(index);
      const managerInfo = FOOTBALL_MANAGERS[index]!;

      if (manager) {
        teamManagerValues.push({
          teamId,
          userId: manager.id,
          createdAt: addDays(now, -5),
        });
      }

      invitationValues.push({
        id: invitationId,
        eventId: DEMO_EVENT_ID,
        kind: "email",
        email: managerInfo.email,
        tokenHash: newTokenHash(),
        expiresAt: addDays(now, isPending ? 7 : -2),
        acceptedAt: isPending ? null : addDays(now, -5),
        acceptedByUserId: manager?.id ?? null,
        revokedAt: null,
        createdByUserId: DEMO_OWNER_ID,
        lastSentAt: addDays(now, -6),
        createdAt: addDays(now, -6),
      });

      invitationTeamValues.push({ invitationId, teamId });

      accessEventValues.push({
        eventId: DEMO_EVENT_ID,
        teamId,
        invitationId,
        actorUserId: DEMO_OWNER_ID,
        subjectUserId: manager?.id ?? null,
        type: "invitation_created",
        metadata: { email: managerInfo.email },
        createdAt: addDays(now, -6),
      });

      if (manager) {
        accessEventValues.push({
          eventId: DEMO_EVENT_ID,
          teamId,
          invitationId,
          actorUserId: manager.id,
          subjectUserId: manager.id,
          type: "invitation_accepted",
          metadata: { team: teamName },
          createdAt: addDays(now, -5),
        });

        auditValues.push({
          eventId: DEMO_EVENT_ID,
          actorUserId: manager.id,
          type: "invitation.accepted",
          entityType: "team",
          entityId: teamId,
          summary: `${manager.name} accepted the invitation for ${teamName}.`,
          metadata: { email: manager.email },
          createdAt: addDays(now, -5),
        });
      }
    });

    // One reusable, team-scoped share link for Riverside Rovers.
    const shareInvitationId = randomUUID();
    invitationValues.push({
      id: shareInvitationId,
      eventId: DEMO_EVENT_ID,
      kind: "link",
      email: null,
      tokenHash: newTokenHash(),
      expiresAt: addDays(now, 7),
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
      createdByUserId: DEMO_OWNER_ID,
      lastSentAt: null,
      createdAt: addDays(now, -1),
    });
    invitationTeamValues.push({
      invitationId: shareInvitationId,
      teamId: footballTeamByName.get("Riverside Rovers")!,
    });
    accessEventValues.push({
      eventId: DEMO_EVENT_ID,
      teamId: footballTeamByName.get("Riverside Rovers")!,
      invitationId: shareInvitationId,
      actorUserId: DEMO_OWNER_ID,
      subjectUserId: null,
      type: "link_created",
      metadata: { scope: "team" },
      createdAt: addDays(now, -1),
    });

    await tx.insert(t.managerInvitations).values(invitationValues);
    await tx.insert(t.invitationTeams).values(invitationTeamValues);
    if (teamManagerValues.length) {
      await tx.insert(t.teamManagers).values(teamManagerValues);
    }

    const participantValues: Array<typeof t.participants.$inferInsert> = [];

    footballTeamRows.forEach((team, teamIndex) => {
      for (let playerIndex = 0; playerIndex < 12; playerIndex += 1) {
        const first =
          FIRST_NAMES[
            (teamIndex * 12 + playerIndex) % FIRST_NAMES.length
          ]!;
        const last =
          LAST_NAMES[
            (teamIndex * 5 + playerIndex * 7) % LAST_NAMES.length
          ]!;
        const birthDate = new Date(
          Date.UTC(
            2014,
            0,
            1 + ((teamIndex * 12 + playerIndex) * 7) % 720,
          ),
        );

        participantValues.push({
          competitionId: DEMO_FOOTBALL_COMPETITION_ID,
          teamId: team.id,
          firstName: first,
          lastName: last,
          dateOfBirth: dateOnly(birthDate),
          shirtNumber: playerIndex + 1,
          position: footballPosition(playerIndex),
          isCaptain: playerIndex === 0,
        });
      }
    });

    // Tennis entrants: one Participant per Team.
    const tennisTeamRows = await tx
      .insert(t.teams)
      .values(
        TENNIS_PLAYERS.map((player, index) => {
          const [first, ...rest] = player.split(" ");
          return {
            competitionId: DEMO_TENNIS_COMPETITION_ID,
            name: player,
            slug: slugify(player),
            shortName: `${first} ${rest.join(" ").charAt(0)}`.trim(),
            primaryColor: ["#e7864a", "#176b46", "#8c3f5e", "#2b5d8a"][
              index % 4
            ],
            seedPosition: index + 1,
            isActive: true,
          };
        }),
      )
      .returning({ id: t.teams.id, name: t.teams.name });

    const tennisPlayerByName = new Map(
      tennisTeamRows.map((team) => [team.name, team.id]),
    );

    const tennisParticipantValues: Array<typeof t.participants.$inferInsert> =
      TENNIS_PLAYERS.map((player, index) => {
        const [firstName, ...rest] = player.split(" ");
        const birthDate = new Date(
          Date.UTC(2000 + (index % 8), (index * 3) % 12, 1 + ((index * 5) % 27)),
        );
        return {
          competitionId: DEMO_TENNIS_COMPETITION_ID,
          teamId: tennisPlayerByName.get(player)!,
          firstName,
          lastName: rest.join(" "),
          dateOfBirth: dateOnly(birthDate),
          shirtNumber: null,
          position: null,
          isCaptain: true,
        };
      });

    const allParticipantRows = await tx
      .insert(t.participants)
      .values([...participantValues, ...tennisParticipantValues])
      .returning({
        id: t.participants.id,
        teamId: t.participants.teamId,
      });

    // Tennis groups and fixtures -------------------------------------------
    const tennisGroupRows = await tx
      .insert(t.groups)
      .values([
        {
          competitionId: DEMO_TENNIS_COMPETITION_ID,
          name: "Grupo A",
          sortOrder: 1,
        },
        {
          competitionId: DEMO_TENNIS_COMPETITION_ID,
          name: "Grupo B",
          sortOrder: 2,
        },
      ])
      .returning({ id: t.groups.id, name: t.groups.name });

    const tennisTeamIds = TENNIS_PLAYERS.map(
      (player) => tennisPlayerByName.get(player)!,
    );

    const groupEntryValues: Array<typeof t.groupEntries.$inferInsert> = [];
    tennisGroupRows.forEach((group, groupIndex) => {
      tennisTeamIds
        .slice(groupIndex * 4, groupIndex * 4 + 4)
        .forEach((teamId, position) => {
          groupEntryValues.push({
            groupId: group.id,
            teamId,
            seedPosition: position + 1,
          });
        });
    });
    await tx.insert(t.groupEntries).values(groupEntryValues);

    const matchSpecs: TennisMatchSpec[] = [];
    TENNIS_PAIRINGS.forEach((pair, roundIndex) => {
      for (let groupIndex = 0; groupIndex < 2; groupIndex += 1) {
        matchSpecs.push({
          groupIndex,
          roundIndex,
          homeIndex: groupIndex * 4 + pair[0],
          awayIndex: groupIndex * 4 + pair[1],
          published: roundIndex < 4,
        });
      }
    });

    const matchRows = await tx
      .insert(t.matches)
      .values(
        matchSpecs.map((spec, index) => {
          const published = spec.published;
          const timeSlot = spec.roundIndex % 4;
          const hour = 12 + Math.floor(timeSlot * 1.5);
          const minute = timeSlot % 2 === 0 ? 0 : 30;
          return {
            competitionId: DEMO_TENNIS_COMPETITION_ID,
            groupId: tennisGroupRows[spec.groupIndex]!.id,
            venueId:
              spec.groupIndex === 0
                ? venueBySlug.get("quadra-central")
                : venueBySlug.get("quadra-2"),
            stage: "group" as const,
            roundLabel: `Rodada ${spec.roundIndex + 1}`,
            roundNumber: spec.roundIndex + 1,
            matchNumber: index + 1,
            startsAt: published
              ? atUtc(now, -1, hour, minute)
              : atUtc(now, 1, hour, minute),
            durationMinutes: 90,
            status: published ? ("published" as const) : ("scheduled" as const),
            isBye: false,
          };
        }),
      )
      .returning({ id: t.matches.id, matchNumber: t.matches.matchNumber });

    const matchByNumber = new Map(
      matchRows.map((match) => [match.matchNumber, match]),
    );

    const matchEntryValues: Array<typeof t.matchEntries.$inferInsert> = [];
    matchSpecs.forEach((spec, index) => {
      const match = matchByNumber.get(index + 1)!;
      matchEntryValues.push(
        {
          matchId: match.id,
          side: "home",
          teamId: tennisTeamIds[spec.homeIndex]!,
        },
        {
          matchId: match.id,
          side: "away",
          teamId: tennisTeamIds[spec.awayIndex]!,
        },
      );
    });
    await tx.insert(t.matchEntries).values(matchEntryValues);

    const tennisParticipantByTeam = new Map(
      allParticipantRows
        .filter((participant) => {
          return tennisTeamIds.includes(participant.teamId);
        })
        .map((participant) => [participant.teamId, participant.id]),
    );

    let publishedResults = 0;
    const statisticsValues: Array<typeof t.participantStatistics.$inferInsert> =
      [];

    for (let index = 0; index < matchSpecs.length; index += 1) {
      const spec = matchSpecs[index]!;
      const match = matchByNumber.get(index + 1)!;

      if (!spec.published) {
        continue;
      }

      const homeTeamId = tennisTeamIds[spec.homeIndex]!;
      const awayTeamId = tennisTeamIds[spec.awayIndex]!;
      const homeWon = (index + spec.groupIndex) % 3 !== 0;
      const winnerTeamId = homeWon ? homeTeamId : awayTeamId;
      const sets = tennisSetsFor(index, homeWon);
      const resultId = randomUUID();

      await tx.insert(t.resultVersions).values({
        id: resultId,
        matchId: match.id,
        version: 1,
        source: "manual",
        isCurrent: true,
        createdByUserId: DEMO_OWNER_ID,
        reviewedByUserId: DEMO_OWNER_ID,
        reviewedAt: addDays(now, -1),
        confirmedAt: atUtc(now, -1, 18, 0),
        metadata: { seeded: true, drawSeed: "summer-cup-tennis-2026" },
      });

      await tx.insert(t.tennisResults).values({
        resultVersionId: resultId,
        winnerTeamId,
        sets,
        isWalkover: false,
      });

      const homeParticipantId = tennisParticipantByTeam.get(homeTeamId)!;
      const awayParticipantId = tennisParticipantByTeam.get(awayTeamId)!;

      statisticsValues.push(
        {
          resultVersionId: resultId,
          matchId: match.id,
          teamId: homeTeamId,
          participantId: homeParticipantId,
          aces: 5 + ((index * 3 + 2) % 9),
          doubleFaults: 1 + (index % 5),
          goals: 0,
          assists: 0,
        },
        {
          resultVersionId: resultId,
          matchId: match.id,
          teamId: awayTeamId,
          participantId: awayParticipantId,
          aces: 4 + ((index * 2 + 1) % 8),
          doubleFaults: 2 + ((index + 1) % 4),
          goals: 0,
          assists: 0,
        },
      );

      publishedResults += 1;
    }

    if (statisticsValues.length) {
      await tx.insert(t.participantStatistics).values(statisticsValues);
    }

    // Access history and audit trail ---------------------------------------
    auditValues.push(
      {
        eventId: DEMO_EVENT_ID,
        actorUserId: DEMO_OWNER_ID,
        type: "event.created",
        entityType: "event",
        entityId: DEMO_EVENT_ID,
        summary: "Summer Cup 2026 was created.",
        metadata: { seeded: true },
        createdAt: addDays(now, -12),
      },
      {
        eventId: DEMO_EVENT_ID,
        actorUserId: DEMO_OWNER_ID,
        type: "competition.created",
        entityType: "competition",
        entityId: DEMO_FOOTBALL_COMPETITION_ID,
        summary: "Under-12 Football was added to the event.",
        metadata: { sport: "football" },
        createdAt: addDays(now, -11),
      },
      {
        eventId: DEMO_EVENT_ID,
        actorUserId: DEMO_OWNER_ID,
        type: "competition.created",
        entityType: "competition",
        entityId: DEMO_TENNIS_COMPETITION_ID,
        summary: "Tennis Open was added to the event.",
        metadata: { sport: "tennis" },
        createdAt: addDays(now, -11),
      },
      {
        eventId: DEMO_EVENT_ID,
        actorUserId: DEMO_OWNER_ID,
        type: "draw.generated",
        entityType: "competition",
        entityId: DEMO_TENNIS_COMPETITION_ID,
        summary: "Tennis Open group draw generated from seed summer-cup-tennis-2026.",
        metadata: { seed: "summer-cup-tennis-2026", groups: 2 },
        createdAt: addDays(now, -3),
      },
    );

    if (accessEventValues.length) {
      await tx.insert(t.accessEvents).values(accessEventValues);
    }
    if (auditValues.length) {
      await tx.insert(t.auditEvents).values(auditValues);
    }

    // A completed operations job shows the worker's database contract.
    await tx.insert(t.jobs).values({
      type: "email.send",
      payload: {
        to: "maya.chen@example.com",
        template: "invitation-accepted",
        team: "Riverside Rovers",
      },
      status: "completed",
      attempts: 1,
      maxAttempts: 3,
      completedAt: addDays(now, -5),
      createdAt: addDays(now, -5),
    });

    return {
      eventId: DEMO_EVENT_ID,
      eventSlug: DEMO_EVENT_SLUG,
      counts: {
        users: 1 + DEMO_MANAGER_ACCOUNTS.length,
        teams: FOOTBALL_TEAM_NAMES.length + TENNIS_PLAYERS.length,
        participants: participantValues.length + tennisParticipantValues.length,
        matches: matchSpecs.length,
        publishedResults,
        pendingInvitations: PENDING_TEAM_INDICES.size,
      },
    };
  });
}
