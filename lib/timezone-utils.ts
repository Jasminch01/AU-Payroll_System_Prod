/**
 * Timezone utilities for Australian payroll system
 *
 * ARCHITECTURE:
 * - All timestamps are stored in UTC ISO format in the database.
 * - All user-facing time display and input uses the BUSINESS timezone,
 *   sourced from Business.timezone in the DB (e.g. "Australia/Brisbane").
 * - Never use browser/server local timezone for business logic.
 *
 * FALLBACK: If business timezone is null/missing, defaults to Australia/Sydney.
 */

export const FALLBACK_TIMEZONE = 'Australia/Sydney';

/**
 * Validate a timezone string is a known IANA timezone.
 * Returns the timezone if valid, falls back to FALLBACK_TIMEZONE.
 */
export function resolveTimezone(tz: string | null | undefined): string {
  if (!tz) return FALLBACK_TIMEZONE;
  try {
    // Test that the timezone is recognized by the runtime
    Intl.DateTimeFormat('en-AU', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    console.warn(`[timezone-utils] Unknown timezone "${tz}", falling back to ${FALLBACK_TIMEZONE}`);
    return FALLBACK_TIMEZONE;
  }
}

/**
 * Convert a business-local date + time string to a UTC ISO timestamp.
 *
 * Given date/time as the user entered it in the BUSINESS timezone,
 * converts to proper UTC for storage in the database.
 * Handles AEST/AEDT, AWST, ACST, etc. automatically via Intl.
 *
 * @param dateStr    - Date in YYYY-MM-DD format (business local date)
 * @param timeStr    - Time in HH:mm format (business local time)
 * @param timezone   - IANA timezone string (e.g. "Australia/Brisbane")
 * @returns ISO 8601 UTC timestamp string
 */
export function createBusinessTimestamp(
  dateStr: string,
  timeStr: string,
  timezone: string = FALLBACK_TIMEZONE
): string {
  const tz = resolveTimezone(timezone);

  // Construct a local datetime string (no timezone suffix — we treat it as tz-local)
  const localDateTimeStr = `${dateStr}T${timeStr}:00Z`;

  // Parse as if it were UTC first (a neutral starting point)
  const date = new Date(localDateTimeStr);

  // Use Intl to see what the formatter reads this UTC date as in the target timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: tz,
  });

  const parts = formatter.formatToParts(date);
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

  // Calculate offset: (business timezone time - UTC time) in minutes
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();

  let offset = (tzHour - utcHour) * 60 + (tzMinute - utcMinute);

  // Handle day-boundary crossings in offset calculation (e.g. +14 or -12)
  if (offset > 14 * 60) offset -= 24 * 60;
  if (offset < -12 * 60) offset += 24 * 60;

  // Subtract the offset to convert business local → UTC
  const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);

  return adjustedDate.toISOString();
}

/**
 * @deprecated Use createBusinessTimestamp with explicit timezone instead.
 * Kept for backward compatibility — callers that don't yet pass a timezone
 * will default to Australia/Sydney.
 */
export function createAustralianTimestamp(dateStr: string, timeStr: string): string {
  return createBusinessTimestamp(dateStr, timeStr, FALLBACK_TIMEZONE);
}

/**
 * Get local date string (YYYY-MM-DD) from a UTC ISO timestamp,
 * expressed in the given business timezone.
 *
 * @param timestamp  - ISO 8601 UTC timestamp
 * @param timezone   - IANA timezone string
 * @returns Date string YYYY-MM-DD in business local time
 */
export function getDateInTimezone(timestamp: string, timezone: string = FALLBACK_TIMEZONE): string {
  const tz = resolveTimezone(timezone);
  const date = new Date(timestamp);

  const formatter = new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

/**
 * Get local time string (HH:mm) from a UTC ISO timestamp,
 * expressed in the given business timezone.
 *
 * @param timestamp  - ISO 8601 UTC timestamp
 * @param timezone   - IANA timezone string
 * @returns Time string HH:mm in business local time
 */
export function getTimeInTimezone(timestamp: string, timezone: string = FALLBACK_TIMEZONE): string {
  const tz = resolveTimezone(timezone);
  const date = new Date(timestamp);

  const formatter = new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
  });

  return formatter.format(date);
}

/**
 * Format a UTC ISO timestamp for display (human-readable time string).
 *
 * @param timestamp  - ISO 8601 UTC timestamp
 * @param options    - Intl.DateTimeFormatOptions
 * @param timezone   - IANA timezone string
 * @returns Formatted string
 */
export function formatInTimezone(
  timestamp: string,
  options: Intl.DateTimeFormatOptions,
  timezone: string = FALLBACK_TIMEZONE
): string {
  const tz = resolveTimezone(timezone);
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '--:--';

  return new Intl.DateTimeFormat('en-AU', { ...options, timeZone: tz }).format(date);
}

/**
 * Get date and time components from a UTC ISO timestamp, in business timezone.
 * Useful for pre-filling form inputs.
 *
 * @param timestamp  - ISO 8601 UTC timestamp
 * @param timezone   - IANA timezone string
 * @returns { date: "YYYY-MM-DD", time: "HH:mm" } in business local time
 */
export function getDateTimeForInput(
  timestamp: string,
  timezone: string = FALLBACK_TIMEZONE
): { date: string; time: string } {
  return {
    date: getDateInTimezone(timestamp, timezone),
    time: getTimeInTimezone(timestamp, timezone),
  };
}

/**
 * @deprecated Use getDateTimeForInput with explicit timezone instead.
 */
export function getAustralianDateTimeForInput(timestamp: string): { date: string; time: string } {
  return getDateTimeForInput(timestamp, FALLBACK_TIMEZONE);
}

/**
 * @deprecated Use getDateInTimezone with explicit timezone instead.
 */
export function getAustralianDateFromTimestamp(timestamp: string): string {
  return getDateInTimezone(timestamp, FALLBACK_TIMEZONE);
}

/**
 * @deprecated Use getTimeInTimezone with explicit timezone instead.
 */
export function getAustralianTimeFromTimestamp(timestamp: string): string {
  return getTimeInTimezone(timestamp, FALLBACK_TIMEZONE);
}

/**
 * Get the "today" date range (start/end ISO strings) for querying the DB,
 * anchored in the business timezone.
 *
 * E.g., "today in Brisbane" → { start: "2024-04-22T14:00:00Z", end: "2024-04-23T13:59:59Z" }
 *
 * @param timezone - IANA timezone string
 * @returns { start, end } as UTC ISO strings bounding today in the business timezone
 */
export function getTodayRangeInTimezone(timezone: string = FALLBACK_TIMEZONE): {
  start: string;
  end: string;
} {
  const tz = resolveTimezone(timezone);
  const now = new Date();

  // Get today's date components in the target timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz,
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  const dateStr = `${year}-${month}-${day}`;

  // Convert midnight and end-of-day in the business timezone back to UTC
  const start = createBusinessTimestamp(dateStr, '00:00', tz);
  const end = createBusinessTimestamp(dateStr, '23:59', tz).replace(':00.000Z', ':59.999Z');

  return { start, end };
}

/**
 * Get the current timestamp as UTC ISO, correctly representing "now"
 * in the given business timezone context.
 *
 * Note: The UTC timestamp is the same regardless of timezone — time is universal.
 * This function is kept for API compatibility but simply returns new Date().toISOString().
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * @deprecated Use getCurrentTimestamp() instead — UTC is universal.
 */
export function getCurrentAustralianTimestamp(): string {
  return getCurrentTimestamp();
}

/**
 * Get the day of week (0=Sun, 1=Mon, ..., 6=Sat) for a Date object
 * expressed in the given business timezone.
 * Fixes the bug where getUTCDay() returns the UTC day, not the local day.
 *
 * @param date      - JavaScript Date object (UTC internally)
 * @param timezone  - IANA timezone string
 * @returns 0 (Sunday) through 6 (Saturday) in business local time
 */
export function getDayOfWeekInTimezone(date: Date, timezone: string = FALLBACK_TIMEZONE): number {
  const tz = resolveTimezone(timezone);

  const formatter = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    timeZone: tz,
  });

  const dayStr = formatter.format(date); // "Mon", "Tue", ...
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return dayMap[dayStr] ?? date.getUTCDay();
}