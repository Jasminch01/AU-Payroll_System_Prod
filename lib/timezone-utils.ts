/**
 * Timezone utilities for Australian payroll system (Sydney/Melbourne/Brisbane)
 * 
 * The system stores all timestamps in UTC ISO format, but they represent
 * the actual time in Australia (AEST UTC+10 or AEDT UTC+11).
 * 
 * This is a design choice to avoid ambiguity:
 * - All times are interpreted as Australian local time
 * - Conversion happens only at boundaries (user input/display)
 */

/**
 * Convert Australian local date and time (user input) to ISO timestamp
 * 
 * Given date/time as the user selected it in Australia, create the UTC-formatted
 * timestamp that represents that Australian local time.
 * 
 * The key insight: We want to store the timestamp "as if" the user input is already UTC.
 * So "2026-04-06T17:30:00" becomes "2026-04-06T17:30:00Z" without any timezone conversion.
 * 
 * This maintains consistency across all timezones - the stored value always represents
 * Australian local time when interpreted as UTC.
 * 
 * @param dateStr - Date in YYYY-MM-DD format (Australian date)
 * @param timeStr - Time in HH:mm format (Australian time)
 * @returns ISO 8601 timestamp
 */
export function createAustralianTimestamp(dateStr: string, timeStr: string): string {
  // Combine into ISO datetime string with seconds
  const isoString = `${dateStr}T${timeStr}:00.000Z`;
  return isoString;
}

/**
 * Get Australian local date string from ISO timestamp
 * @param timestamp - ISO 8601 timestamp
 * @returns Date string YYYY-MM-DD in Australian local time
 */
export function getAustralianDateFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  
  // Format using Australian locale with explicit timezone
  const formatter = new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Australia/Sydney' // Use Sydney as the canonical Australian timezone
  });
  
  const parts = formatter.formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Get Australian local time string from ISO timestamp
 * @param timestamp - ISO 8601 timestamp  
 * @returns Time string HH:mm in Australian local time
 */
export function getAustralianTimeFromTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  
  const formatter = new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney'
  });
  
  return formatter.format(date);
}

/**
 * Format ISO timestamp for input elements (date picker + time picker)
 * @param timestamp - ISO 8601 timestamp
 * @returns Object with date (YYYY-MM-DD) and time (HH:mm) in Australian local time
 */
export function getAustralianDateTimeForInput(timestamp: string): { date: string; time: string } {
  return {
    date: getAustralianDateFromTimestamp(timestamp),
    time: getAustralianTimeFromTimestamp(timestamp)
  };
}
