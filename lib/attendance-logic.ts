import { EventType } from '@/types/database';

/**
 * Determines the next logical attendance action for a "Toggle" system.
 * 
 * Logic with Breaks:
 * - No previous logs? -> CLOCK_IN
 * - Last log was > 16 hours ago? -> CLOCK_IN (assumes new shift)
 * - Last log was CLOCK_OUT? -> CLOCK_IN
 * - Last log was CLOCK_IN? -> CLOCK_OUT (default toggle)
 * - Last log was BREAK_START? -> BREAK_END
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

    // State machine logic
    if (lastLog.event_type === 'CLOCK_IN') return 'CLOCK_OUT';
    if (lastLog.event_type === 'BREAK_START') return 'BREAK_END';
    if (lastLog.event_type === 'BREAK_END') return 'CLOCK_OUT';
    
    // Default to CLOCK_IN if they are out
    return 'CLOCK_IN';
}

/**
 * Returns the list of actions available for a kiosk UI based on current state.
 */
export function getAvailableActions(
    lastLog: { event_type: EventType; timestamp: string } | null
): { type: EventType; label: string; variant: 'default' | 'outline' | 'destructive' }[] {
    if (!lastLog) return [{ type: 'CLOCK_IN', label: 'Clock In', variant: 'default' }];

    const lastTime = new Date(lastLog.timestamp).getTime();
    const now = Date.now();
    const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

    // Reset to Clock In if it's been a long time
    if (hoursSinceLast > 16 || lastLog.event_type === 'CLOCK_OUT') {
        return [{ type: 'CLOCK_IN', label: 'Clock In', variant: 'default' }];
    }

    if (lastLog.event_type === 'CLOCK_IN' || lastLog.event_type === 'BREAK_END') {
        return [
            { type: 'CLOCK_OUT', label: 'Clock Out', variant: 'destructive' },
            { type: 'BREAK_START', label: 'Take Break', variant: 'outline' }
        ];
    }

    if (lastLog.event_type === 'BREAK_START') {
        return [
            { type: 'CLOCK_OUT', label: 'Clock Out', variant: 'destructive' },
            { type: 'BREAK_END', label: 'Resume Work', variant: 'default' }
        ];
    }

    return [{ type: 'CLOCK_IN', label: 'Clock In', variant: 'default' }];
}

/**
 * Validates if an attendance event transition is allowed (for manual entries).
 */
export function validateAttendanceTransition(
    lastLog: { event_type: EventType; timestamp: string } | null,
    newEventType: EventType,
    currentTime: string = new Date().toISOString()
): string | null {
    const lastTime = lastLog?.timestamp ? new Date(lastLog.timestamp).getTime() : 0;
    const now = new Date(currentTime).getTime();
    const secondsSinceLast = (now - lastTime) / 1000;

    // Throttle duplicate actions within 1 minute
    if (lastLog?.event_type === newEventType && secondsSinceLast < 60) {
        return `Already ${newEventType.toLowerCase().replace('_', ' ')}ed recently.`;
    }

    return null;
}
