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
