type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsInTimeZone(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function offsetMs(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - date.getTime()
  );
}

/**
 * Converts a `datetime-local` wall-clock value in an Event time zone to the
 * equivalent UTC instant. Running the offset twice handles DST boundaries.
 */
export function zonedDateTimeToUtc(localValue: string, timeZone: string) {
  const match = localValue.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  const wallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );

  let instant = wallClock;
  for (let pass = 0; pass < 2; pass += 1) {
    instant = wallClock - offsetMs(new Date(instant), timeZone);
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** Formats a UTC instant as a `datetime-local` value in the Event time zone. */
export function utcToZonedDateTimeInput(date: Date, timeZone: string) {
  const parts = partsInTimeZone(date, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

const FALLBACK_TIME_ZONES = [
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Santiago",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Paris",
  "Europe/Rome",
  "Pacific/Auckland",
  "UTC",
] as const;

export function isValidTimeZone(timeZone: string) {
  if (!timeZone.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every IANA time zone the runtime understands. Falls back to a short
 * practical list if the runtime does not expose `Intl.supportedValuesOf`.
 */
export function getSupportedTimeZones() {
  const supportedValuesOf = (
    Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    }
  ).supportedValuesOf;

  const values = supportedValuesOf?.("timeZone") ?? [...FALLBACK_TIME_ZONES];
  return [...new Set([...values, "UTC"])].sort((a, b) => a.localeCompare(b));
}

/**
 * Moves an instant from one Event time zone to another while keeping the same
 * local wall-clock date, hour and minute. Two offset passes handle DST edges.
 */
export function convertInstantToTimeZone(
  date: Date,
  fromTimeZone: string,
  toTimeZone: string,
) {
  const parts = partsInTimeZone(date, fromTimeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  const localValue = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  return zonedDateTimeToUtc(localValue, toTimeZone);
}

/** Human label such as `America/Sao_Paulo (GMT-3)`. */
export function formatTimeZoneLabel(timeZone: string, at: Date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const offset =
      parts.find((part) => part.type === "timeZoneName")?.value ?? "UTC";
    return `${timeZone} (${offset})`;
  } catch {
    return timeZone;
  }
}

export function formatDateInTimeZone(
  date: Date,
  timeZone: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
}
