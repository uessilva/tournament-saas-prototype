import type { PublicMatch, Sport } from "@/features/public/types";

export type ScheduleMatch = PublicMatch & {
  /** Current start rendered as a `datetime-local` value in the Event zone. */
  startsAtInput: string | null;
};

export type ScheduleCompetition = {
  id: string;
  name: string;
  slug: string;
  sport: Sport;
  defaultMatchDurationMinutes: number;
  matchCount: number;
  scheduledCount: number;
};

export type ScheduleVenue = {
  id: string;
  name: string;
};

export type ScheduleWorkspaceData = {
  event: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    locationLabel: string | null;
  };
  competitions: ScheduleCompetition[];
  venues: ScheduleVenue[];
  matches: ScheduleMatch[];
  timezones: string[];
};
