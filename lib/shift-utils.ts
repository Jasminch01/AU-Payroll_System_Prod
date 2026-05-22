/**
 * Automatically detects the shift type based on the start time.
 * Logic:
 * - Night: 00:00 - 04:59, 21:00 - 23:59
 * - Morning: 05:00 - 07:59 (early start)
 * - Day: 08:00 - 11:59 (standard day/office hours)
 * - Afternoon: 12:00 - 16:59
 * - Evening: 17:00 - 20:59
 */
export function getShiftTypeFromTime(timeStr: string): string {
    if (!timeStr) return 'morning';

    // Parse HH:mm
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + (isNaN(minutes) ? 0 : minutes);

    if (totalMinutes < 5 * 60) {
        return 'night'; // 00:00 - 04:59
    } else if (totalMinutes < 8 * 60) {
        return 'morning'; // 05:00 - 07:59
    } else if (totalMinutes < 12 * 60) {
        return 'day'; // 08:00 - 11:59
    } else if (totalMinutes < 17 * 60) {
        return 'afternoon'; // 12:00 - 16:59
    } else if (totalMinutes < 21 * 60) {
        return 'evening'; // 17:00 - 20:59
    } else {
        return 'night'; // 21:00 - 23:59
    }
}

/**
 * Calculates the duration in decimal hours between two 24h time strings (HH:mm).
 * Handles cross-midnight shifts.
 */
export function calculateShiftDuration(start: string, end: string): number {
    if (!start || !end) return 0;

    let [startH, startM] = start.split(':').map(Number);
    let [endH, endM] = end.split(':').map(Number);

    if (isNaN(startH) || isNaN(endH)) return 0;

    // Normalize 24:00 to 24 for math, but handle overflow if needed
    // In our system 24:00 is used as end of day.

    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);

    if (endMinutes <= startMinutes) {
        // Crosses midnight (e.g. 22:00 to 06:00)
        endMinutes += 24 * 60;
    }

    return (endMinutes - startMinutes) / 60;
}

/**
 * Formats a decimal hour duration into a human-readable format like 'XhYm'.
 * Example: 2.75 -> '2h45m', 8 -> '8h'.
 */
export function formatDurationHours(decimalHours: number): string {
    if (isNaN(decimalHours) || decimalHours < 0) return "0h";
    const hrs = Math.floor(decimalHours);
    const mins = Math.round((decimalHours - hrs) * 60);

    if (mins === 0) return `${hrs}h`;
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h${mins}m`;
}
