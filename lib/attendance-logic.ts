import { EventType } from '@/types/database';

/**
 * Determines the next logical attendance action for a "Toggle" system.
 * 
 * Simple Auto-Toggle Logic:
 * - No previous logs? -> CLOCK_IN
 * - Last log was > 16 hours ago? -> CLOCK_IN (assumes new shift)
 * - Last log was CLOCK_OUT? -> CLOCK_IN
 * - Last log was CLOCK_IN? -> CLOCK_OUT
 * 
 * @param lastLog The last log entry (nullable).
 * @param currentTime Current timestamp (for reset logic).
 * @returns The EventType that should be recorded.
 */
export function getNextAttendanceEvent(
    lastLog: { event_type: EventType; timestamp: string } | null,
    currentTime: string = new Date().toISOString()
): EventType {
    if (!lastLog) return 'CLOCK_IN';

    const lastTime = new Date(lastLog.timestamp).getTime();
    const now = new Date(currentTime).getTime();
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    // If it's been more than 16 hours since the last action, 
    // we assume it's a new day and always start with CLOCK_IN.
    if (hoursSinceLast > 16) return 'CLOCK_IN';

    // Otherwise, just toggle between IN and OUT.
    return lastLog.event_type === 'CLOCK_IN' ? 'CLOCK_OUT' : 'CLOCK_IN';
}

/**
 * Validates if an attendance event transition is allowed (for manual entries).
 */
export function validateAttendanceTransition(
    lastLog: { event_type: EventType; timestamp: string } | null,
    newEventType: EventType,
    currentTime: string = new Date().toISOString()
): string | null {
    // For simplicity, just ensure they don't double-log the SAME action within 16 hrs.
    const lastTime = lastLog?.timestamp ? new Date(lastLog.timestamp).getTime() : 0;
    const now = new Date(currentTime).getTime();
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    if (lastLog?.event_type === newEventType && hoursSinceLast < 16) {
        return `Already ${newEventType.toLowerCase().replace('_', ' ')}ed recently.`;
    }

    return null;
}
