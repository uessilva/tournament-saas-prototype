import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth.js tables
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    // Auth.js passes snake_case Account values straight to the adapter.
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({
      name: "accounts_provider_account_pk",
      columns: [table.provider, table.providerAccountId],
    }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({
      name: "verification_tokens_identifier_token_pk",
      columns: [table.identifier, table.token],
    }),
  ],
);

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
  },
  (table) => [
    primaryKey({
      name: "authenticators_user_credential_pk",
      columns: [table.userId, table.credentialID],
    }),
  ],
);

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const sportEnum = pgEnum("sport", ["football", "tennis"]);
export const competitionFormatEnum = pgEnum("competition_format", [
  "round_robin",
  "single_elimination",
  "groups_knockout",
]);
export const registrationStateEnum = pgEnum("registration_state", [
  "open",
  "closed",
]);
export const competitionStatusEnum = pgEnum("competition_status", [
  "setup",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
  "cancelled",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "awaiting_result",
  "in_review",
  "published",
  "cancelled",
]);
export const matchStageEnum = pgEnum("match_stage", ["group", "knockout"]);
export const matchSideEnum = pgEnum("match_side", ["home", "away"]);
export const matchSlotSourceEnum = pgEnum("match_slot_source", [
  "group_qualifier",
  "match_winner",
  "bye",
]);
export const resultSourceEnum = pgEnum("result_source", [
  "scoresheet",
  "manual",
  "walkover",
]);
export const scoresheetStatusEnum = pgEnum("scoresheet_status", [
  "uploaded",
  "processing",
  "needs_review",
  "confirmed",
  "extraction_failed",
  "rejected",
]);
export const scoresheetExtractionSourceEnum = pgEnum(
  "scoresheet_extraction_source",
  ["acroform", "qr_ocr", "seeded_fallback"],
);
export const invitationKindEnum = pgEnum("invitation_kind", ["email", "link"]);
export const accessEventTypeEnum = pgEnum("access_event_type", [
  "invitation_created",
  "invitation_email_sent",
  "invitation_accepted",
  "invitation_revoked",
  "invitation_expired",
  "link_created",
  "link_revoked",
  "link_accepted",
  "manager_removed",
]);
export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);
export const disputeStatusEnum = pgEnum("dispute_status", [
  "open",
  "resolved",
  "dismissed",
]);

// ---------------------------------------------------------------------------
// Events, venues, competitions
// ---------------------------------------------------------------------------

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    tagline: text("tagline"),
    description: text("description"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    locationLabel: text("location_label"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("events_owner_idx").on(table.ownerId)],
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("venues_event_slug_uq").on(table.eventId, table.slug),
    index("venues_event_idx").on(table.eventId),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    sport: sportEnum("sport").notNull(),
    format: competitionFormatEnum("format").notNull(),
    description: text("description"),
    eligibilityNotes: text("eligibility_notes"),
    birthDateFrom: date("birth_date_from", { mode: "string" }),
    birthDateTo: date("birth_date_to", { mode: "string" }),
    rosterMin: integer("roster_min"),
    rosterMax: integer("roster_max"),
    registrationState: registrationStateEnum("registration_state")
      .notNull()
      .default("open"),
    registrationDeadline: timestamp("registration_deadline", {
      withTimezone: true,
    }),
    groupCount: integer("group_count").notNull().default(2),
    qualifiersPerGroup: integer("qualifiers_per_group").notNull().default(2),
    defaultMatchDurationMinutes: integer("default_match_duration_minutes")
      .notNull()
      .default(50),
    drawSeed: text("draw_seed"),
    drawGeneratedAt: timestamp("draw_generated_at", { withTimezone: true }),
    status: competitionStatusEnum("status").notNull().default("setup"),
    publicNote: text("public_note"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("competitions_event_slug_uq").on(table.eventId, table.slug),
    index("competitions_event_idx").on(table.eventId),
  ],
);

// ---------------------------------------------------------------------------
// Entrants and access
// ---------------------------------------------------------------------------

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    shortName: text("short_name"),
    primaryColor: text("primary_color"),
    seedPosition: integer("seed_position"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("teams_competition_slug_uq").on(
      table.competitionId,
      table.slug,
    ),
    index("teams_competition_idx").on(table.competitionId),
  ],
);

export const participants = pgTable(
  "participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    dateOfBirth: date("date_of_birth", { mode: "string" }).notNull(),
    shirtNumber: integer("shirt_number"),
    position: text("position"),
    isCaptain: boolean("is_captain").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("participants_competition_person_uq").on(
      table.competitionId,
      table.firstName,
      table.lastName,
      table.dateOfBirth,
    ),
    index("participants_team_idx").on(table.teamId),
  ],
);

export const teamManagers = pgTable(
  "team_managers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("team_managers_team_user_uq").on(table.teamId, table.userId),
    index("team_managers_user_idx").on(table.userId),
  ],
);

export const managerInvitations = pgTable(
  "manager_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    kind: invitationKindEnum("kind").notNull(),
    email: text("email"),
    // Only the SHA-256 hash is persisted. Raw tokens never reach the database.
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("manager_invitations_event_idx").on(table.eventId),
    index("manager_invitations_email_idx").on(table.email),
  ],
);

export const invitationTeams = pgTable(
  "invitation_teams",
  {
    invitationId: uuid("invitation_id")
      .notNull()
      .references(() => managerInvitations.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      name: "invitation_teams_pk",
      columns: [table.invitationId, table.teamId],
    }),
  ],
);

export const accessEvents = pgTable(
  "access_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    invitationId: uuid("invitation_id").references(
      () => managerInvitations.id,
      { onDelete: "set null" },
    ),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: accessEventTypeEnum("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("access_events_event_created_idx").on(table.eventId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Tournament structure
// ---------------------------------------------------------------------------

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("groups_competition_name_uq").on(
      table.competitionId,
      table.name,
    ),
  ],
);

export const groupEntries = pgTable(
  "group_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seedPosition: integer("seed_position").notNull(),
  },
  (table) => [
    uniqueIndex("group_entries_group_team_uq").on(table.groupId, table.teamId),
    uniqueIndex("group_entries_group_position_uq").on(
      table.groupId,
      table.seedPosition,
    ),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    venueId: uuid("venue_id").references(() => venues.id, {
      onDelete: "set null",
    }),
    stage: matchStageEnum("stage").notNull().default("group"),
    roundLabel: text("round_label"),
    roundNumber: integer("round_number").notNull().default(1),
    bracketSlot: integer("bracket_slot"),
    matchNumber: integer("match_number").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    isBye: boolean("is_bye").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("matches_competition_number_uq").on(
      table.competitionId,
      table.matchNumber,
    ),
    uniqueIndex("matches_competition_round_slot_uq").on(
      table.competitionId,
      table.roundNumber,
      table.bracketSlot,
    ),
    index("matches_competition_starts_idx").on(
      table.competitionId,
      table.startsAt,
    ),
    index("matches_status_idx").on(table.status),
  ],
);

export const matchEntries = pgTable(
  "match_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    side: matchSideEnum("side").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("match_entries_match_side_uq").on(table.matchId, table.side),
    uniqueIndex("match_entries_match_team_uq").on(table.matchId, table.teamId),
  ],
);

/**
 * Explicit knockout slot provenance. A home/away side is either a known group
 * qualifier position, the winner of an earlier bracket match, or a Bye. Group
 * fixtures leave these rows empty and use match_entries instead. Bye nodes are
 * stored as non-playable matches so later rounds always have a stable winner
 * source, but they never appear as public fixtures.
 */
export const matchSlots = pgTable(
  "match_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    side: matchSideEnum("side").notNull(),
    sourceType: matchSlotSourceEnum("source_type").notNull(),
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "set null",
    }),
    groupPosition: integer("group_position"),
    sourceMatchId: uuid("source_match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("match_slots_match_side_uq").on(table.matchId, table.side),
    index("match_slots_source_match_idx").on(table.sourceMatchId),
  ],
);

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type TennisSetScore = {
  home: number;
  away: number;
  tiebreakHome?: number;
  tiebreakAway?: number;
};

export const resultVersions = pgTable(
  "result_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    source: resultSourceEnum("source").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    reason: text("reason"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("result_versions_match_version_uq").on(
      table.matchId,
      table.version,
    ),
    uniqueIndex("result_versions_match_current_uq")
      .on(table.matchId)
      .where(sql`${table.isCurrent} = true`),
  ],
);

export const footballResults = pgTable(
  "football_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultVersionId: uuid("result_version_id")
      .notNull()
      .unique()
      .references(() => resultVersions.id, { onDelete: "cascade" }),
    homeScore: integer("home_score").notNull(),
    awayScore: integer("away_score").notNull(),
    isWalkover: boolean("is_walkover").notNull().default(false),
    walkoverWinnerTeamId: uuid("walkover_winner_team_id").references(
      () => teams.id,
      { onDelete: "set null" },
    ),
    penaltyHome: integer("penalty_home"),
    penaltyAway: integer("penalty_away"),
    notes: text("notes"),
  },
);

export const tennisResults = pgTable("tennis_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  resultVersionId: uuid("result_version_id")
    .notNull()
    .unique()
    .references(() => resultVersions.id, { onDelete: "cascade" }),
  winnerTeamId: uuid("winner_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "restrict" }),
  sets: jsonb("sets").$type<TennisSetScore[]>().notNull(),
  isWalkover: boolean("is_walkover").notNull().default(false),
  notes: text("notes"),
});

export const participantStatistics = pgTable(
  "participant_statistics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resultVersionId: uuid("result_version_id")
      .notNull()
      .references(() => resultVersions.id, { onDelete: "cascade" }),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    goals: integer("goals").notNull().default(0),
    assists: integer("assists").notNull().default(0),
    aces: integer("aces").notNull().default(0),
    doubleFaults: integer("double_faults").notNull().default(0),
  },
  (table) => [
    uniqueIndex("participant_statistics_version_person_uq").on(
      table.resultVersionId,
      table.participantId,
    ),
    index("participant_statistics_match_idx").on(table.matchId),
  ],
);

// ---------------------------------------------------------------------------
// Scoresheets
// ---------------------------------------------------------------------------

export const scoresheets = pgTable(
  "scoresheets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    previewStorageKey: text("preview_storage_key"),
    templateVersion: text("template_version"),
    qrSheetId: text("qr_sheet_id"),
    pageCount: integer("page_count"),
    extractionSource: scoresheetExtractionSourceEnum("extraction_source"),
    extractionNote: text("extraction_note"),
    status: scoresheetStatusEnum("status").notNull().default("uploaded"),
    isActive: boolean("is_active").notNull().default(true),
    processingStartedAt: timestamp("processing_started_at", {
      withTimezone: true,
    }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    failureReason: text("failure_reason"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scoresheets_match_active_uq")
      .on(table.matchId)
      .where(sql`${table.isActive} = true`),
    index("scoresheets_match_idx").on(table.matchId),
    index("scoresheets_status_idx").on(table.status),
  ],
);

export const extractedFields = pgTable(
  "extracted_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scoresheetId: uuid("scoresheet_id")
      .notNull()
      .references(() => scoresheets.id, { onDelete: "cascade" }),
    fieldKey: text("field_key").notNull(),
    label: text("label"),
    page: integer("page").notNull().default(1),
    rawValue: text("raw_value"),
    normalizedValue: text("normalized_value"),
    reviewedValue: text("reviewed_value"),
    confidence: integer("confidence"),
    cropStorageKey: text("crop_storage_key"),
    cropBox: jsonb("crop_box").$type<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>(),
    validationFlags: jsonb("validation_flags")
      .$type<string[]>()
      .notNull()
      .default([]),
    source: text("source"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("extracted_fields_sheet_key_uq").on(
      table.scoresheetId,
      table.fieldKey,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("jobs_status_available_idx").on(table.status, table.availableAt),
    index("jobs_type_idx").on(table.type),
  ],
);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    status: disputeStatusEnum("status").notNull().default("open"),
    explanation: text("explanation").notNull(),
    response: text("response"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    correctionResultVersionId: uuid("correction_result_version_id").references(
      () => resultVersions.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("disputes_match_open_uq")
      .on(table.matchId)
      .where(sql`${table.status} = 'open'`),
    index("disputes_match_idx").on(table.matchId),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_event_created_idx").on(table.eventId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Relations used by Drizzle's relational query API
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  ownedEvents: many(events),
  teamManagements: many(teamManagers),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  owner: one(users, { fields: [events.ownerId], references: [users.id] }),
  venues: many(venues),
  competitions: many(competitions),
  auditEvents: many(auditEvents),
}));

export const venuesRelations = relations(venues, ({ one, many }) => ({
  event: one(events, { fields: [venues.eventId], references: [events.id] }),
  matches: many(matches),
}));

export const competitionsRelations = relations(
  competitions,
  ({ one, many }) => ({
    event: one(events, {
      fields: [competitions.eventId],
      references: [events.id],
    }),
    teams: many(teams),
    groups: many(groups),
    matches: many(matches),
  }),
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [teams.competitionId],
    references: [competitions.id],
  }),
  participants: many(participants),
  managers: many(teamManagers),
  matchEntries: many(matchEntries),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  team: one(teams, { fields: [participants.teamId], references: [teams.id] }),
  competition: one(competitions, {
    fields: [participants.competitionId],
    references: [competitions.id],
  }),
}));

export const teamManagersRelations = relations(teamManagers, ({ one }) => ({
  team: one(teams, { fields: [teamManagers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamManagers.userId], references: [users.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [matches.competitionId],
    references: [competitions.id],
  }),
  group: one(groups, { fields: [matches.groupId], references: [groups.id] }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  entries: many(matchEntries),
  slots: many(matchSlots),
  resultVersions: many(resultVersions),
  scoresheets: many(scoresheets),
  disputes: many(disputes),
}));

export const matchEntriesRelations = relations(matchEntries, ({ one }) => ({
  match: one(matches, {
    fields: [matchEntries.matchId],
    references: [matches.id],
  }),
  team: one(teams, { fields: [matchEntries.teamId], references: [teams.id] }),
}));

export const matchSlotsRelations = relations(matchSlots, ({ one }) => ({
  match: one(matches, {
    fields: [matchSlots.matchId],
    references: [matches.id],
  }),
  group: one(groups, {
    fields: [matchSlots.groupId],
    references: [groups.id],
  }),
  sourceMatch: one(matches, {
    fields: [matchSlots.sourceMatchId],
    references: [matches.id],
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [groups.competitionId],
    references: [competitions.id],
  }),
  entries: many(groupEntries),
  matches: many(matches),
}));

export const groupEntriesRelations = relations(groupEntries, ({ one }) => ({
  group: one(groups, { fields: [groupEntries.groupId], references: [groups.id] }),
  team: one(teams, { fields: [groupEntries.teamId], references: [teams.id] }),
}));

export const resultVersionsRelations = relations(
  resultVersions,
  ({ one, many }) => ({
    match: one(matches, {
      fields: [resultVersions.matchId],
      references: [matches.id],
    }),
    footballResult: one(footballResults),
    tennisResult: one(tennisResults),
    statistics: many(participantStatistics),
  }),
);

export const footballResultsRelations = relations(
  footballResults,
  ({ one }) => ({
    resultVersion: one(resultVersions, {
      fields: [footballResults.resultVersionId],
      references: [resultVersions.id],
    }),
  }),
);

export const participantStatisticsRelations = relations(
  participantStatistics,
  ({ one }) => ({
    resultVersion: one(resultVersions, {
      fields: [participantStatistics.resultVersionId],
      references: [resultVersions.id],
    }),
    match: one(matches, {
      fields: [participantStatistics.matchId],
      references: [matches.id],
    }),
    team: one(teams, {
      fields: [participantStatistics.teamId],
      references: [teams.id],
    }),
    participant: one(participants, {
      fields: [participantStatistics.participantId],
      references: [participants.id],
    }),
  }),
);

export const tennisResultsRelations = relations(tennisResults, ({ one }) => ({
  resultVersion: one(resultVersions, {
    fields: [tennisResults.resultVersionId],
    references: [resultVersions.id],
  }),
}));

export const scoresheetsRelations = relations(scoresheets, ({ one, many }) => ({
  match: one(matches, {
    fields: [scoresheets.matchId],
    references: [matches.id],
  }),
  extractedFields: many(extractedFields),
}));

export const extractedFieldsRelations = relations(
  extractedFields,
  ({ one }) => ({
    scoresheet: one(scoresheets, {
      fields: [extractedFields.scoresheetId],
      references: [scoresheets.id],
    }),
  }),
);

export const disputesRelations = relations(disputes, ({ one }) => ({
  match: one(matches, { fields: [disputes.matchId], references: [matches.id] }),
  team: one(teams, { fields: [disputes.teamId], references: [teams.id] }),
  openedBy: one(users, {
    fields: [disputes.openedByUserId],
    references: [users.id],
  }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  event: one(events, { fields: [auditEvents.eventId], references: [events.id] }),
  actor: one(users, {
    fields: [auditEvents.actorUserId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type Participant = typeof participants.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchSlot = typeof matchSlots.$inferSelect;
export type ResultVersion = typeof resultVersions.$inferSelect;
export type Scoresheet = typeof scoresheets.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
