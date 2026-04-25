/**
 * Automatically detects the shift type based on the start time.
 * Logic:
 * - Morning: 00:00 - 11:59
 * - Afternoon: 12:00 - 16:59
 * - Evening: 17:00 - 23:59
 */
export function getShiftTypeFromTime(timeStr: string): 'morning' | 'afternoon' | 'evening' {
    if (!timeStr) return 'morning';
    
    // Parse HH:mm
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + (isNaN(minutes) ? 0 : minutes);
    
    if (totalMinutes < 12 * 60) {
        return 'morning';
    } else if (totalMinutes < 17 * 60) {
        return 'afternoon';
    } else {
        return 'evening';
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

