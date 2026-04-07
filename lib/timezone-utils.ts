/**
 * Timezone utilities for Australian payroll system (Sydney/Melbourne/Brisbane)
 * 
 * IMPORTANT: The system stores all timestamps in UTC ISO format, but they represent
 * actual Australian local time including proper offset handling.
 * 
 * This ensures:
 * - Consistency across timezones
 * - Proper handling of daylight saving transitions
 * - Accurate date boundaries in Australian context
 */

/**
 * Convert Australian local date and time (user input) to UTC ISO timestamp
 * 
 * Given date/time as the user selected it in Australia, convert to proper UTC timestamp.
 * This handles the timezone offset (AEST UTC+10 or AEDT UTC+11) correctly.
 * 
 * @param dateStr - Date in YYYY-MM-DD format (Australian date)
 * @param timeStr - Time in HH:mm format (Australian time)
 * @returns ISO 8601 UTC timestamp with proper offset
 */
export function createAustralianTimestamp(dateStr: string, timeStr: string): string {
  // Create a local date/time string that JavaScript will interpret as local time
  const localDateTimeStr = `${dateStr}T${timeStr}:00`;
  
  // Create date object - JavaScript will parse this as local timezone
  const date = new Date(localDateTimeStr);
  
  // The key issue: date.toISOString() assumes the Date object is in some timezone,
  // but we need to convert from Australian timezone to UTC.
  // 
  // We'll use Intl to get the offset for Sydney timezone at this date
  const formatter = new Intl.DateTimeFormat('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney'
  });

  // Get what the formatter thinks this UTC time is in Sydney timezone
  const parts = formatter.formatToParts(date);
  const sydneyHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const sydneyMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const sydneySecond = parseInt(parts.find(p => p.type === 'second')?.value || '0');

  // Calculate offset: (Sydney time - UTC time) in minutes
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();
  
  const offset = (sydneyHour - utcHour) * 60 + (sydneyMinute - utcMinute);
  
  // Now adjust the date backwards by the offset to get the true UTC time
  const adjustedDate = new Date(date.getTime() - offset * 60 * 1000);
  
  return adjustedDate.toISOString();
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
