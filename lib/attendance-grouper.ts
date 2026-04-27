import { AttendanceLog } from '@/types/database';
import { getDateInTimezone } from '@/lib/timezone-utils';

export type AttendanceLogWithEmployee = AttendanceLog & {
  Employee?: {
    first_name: string;
    last_name: string;
    role_title: string;
  } | null;
};

/**
 * Groups attendance logs into complete work sessions
 * Handles cross-midnight shifts where CLOCK_IN is on one date
 * and CLOCK_OUT is on the next date
 */
export interface WorkSession {
  clock_in_date: string; // Date YYYY-MM-DD when work session started
  clock_in: AttendanceLogWithEmployee | null;
  clock_out: AttendanceLogWithEmployee | null;
  breaks: AttendanceLogWithEmployee[];
  all_logs: AttendanceLogWithEmployee[]; // All logs in this session (in/out/breaks)
  duration_minutes: number | null; // null if no CLOCK_OUT yet
  has_overtime: boolean;
}

export interface GroupedAttendanceSession {
  employee_id: string;
  clock_in_date: string; // The date to display this on (CLOCK_IN date)
  sessions: WorkSession[];
  Employee?: {
    first_name: string;
    last_name: string;
    role_title: string;
  } | null;
}

/**
 * Group raw attendance logs into work sessions
 * A work session starts with CLOCK_IN and ends with CLOCK_OUT
 * CLOCK_OUT can be on the next day (cross-midnight)
 * 
 * @param logs - Raw attendance logs (sorted by timestamp)
 * @param timezone - Business timezone for correct date boundaries
 * @returns Grouped work sessions by employee and clock-in date
 */
export function groupAttendanceIntoSessions(
  logs: AttendanceLogWithEmployee[],
  timezone?: string
): GroupedAttendanceSession[] {
  // 1. Group logs by employee first to avoid interference
  const logsByEmployee: Record<string, AttendanceLogWithEmployee[]> = {};
  for (const log of logs) {
    const empId = log.employee_id || 'unknown';
    if (!logsByEmployee[empId]) {
      logsByEmployee[empId] = [];
    }
    logsByEmployee[empId].push(log);
  }

  const result: GroupedAttendanceSession[] = [];

  for (const [employeeId, empLogs] of Object.entries(logsByEmployee)) {
    // Sort logs for this employee by timestamp
    const sorted = [...empLogs].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    console.log(`[GROUPER] Processing employee ${employeeId}:`, {
      total_logs: sorted.length,
      log_types: sorted.map(l => `${l.event_type}@${getDateInTimezone(l.timestamp, timezone)}`),
      timestamps: sorted.map(l => l.timestamp)
    });

    const sessions: WorkSession[] = [];
    const activeSessions: Partial<WorkSession>[] = [];
    const usedClockInIds = new Set<string>();

    const getSource = (l: AttendanceLog) => l.override_by || l.device_info || 'default';

    for (const log of sorted) {
      const source = getSource(log);

      if (log.event_type === 'CLOCK_IN') {
        // Check if there is already an active session for this specific source
        const sameSourceIndex = activeSessions.findIndex(s => s.clock_in && getSource(s.clock_in) === source);
        
        if (sameSourceIndex !== -1) {
          // Close the previous session for this source as incomplete
          const prev = activeSessions[sameSourceIndex];
          if (prev.clock_in) usedClockInIds.add(prev.clock_in.log_id);
          sessions.push(prev as WorkSession);
          activeSessions.splice(sameSourceIndex, 1);
        }

        activeSessions.push({
          clock_in_date: getDateInTimezone(log.timestamp, timezone),
          clock_in: log,
          clock_out: null,
          breaks: [],
          all_logs: [log],
          duration_minutes: null,
          has_overtime: false,
        });
      } else if (log.event_type === 'CLOCK_OUT') {
        // 1. Try to find an active session with the SAME source
        let matchIndex = activeSessions.findIndex(s => s.clock_in && getSource(s.clock_in) === source);
        
        // 2. If no same source, take the most recent active session (any source)
        if (matchIndex === -1 && activeSessions.length > 0) {
          matchIndex = activeSessions.length - 1;
        }

        if (matchIndex !== -1) {
          const matchedSession = activeSessions[matchIndex];
          matchedSession.clock_out = log;
          matchedSession.all_logs!.push(log);

          if (matchedSession.clock_in) {
            usedClockInIds.add(matchedSession.clock_in.log_id);
            const inMs = new Date(matchedSession.clock_in.timestamp).getTime();
            const outMs = new Date(log.timestamp).getTime();
            matchedSession.duration_minutes = (outMs - inMs) / 60000;
          }

          sessions.push(matchedSession as WorkSession);
          activeSessions.splice(matchIndex, 1);
        } else {
          // Case 2: Orphan CLOCK_OUT (manual entry after CLOCK_IN ended or no matching active session)
          const clockOutDate = getDateInTimezone(log.timestamp, timezone);
          let matchedClockIn: AttendanceLogWithEmployee | null = null;

          // Find ANY unpaired CLOCK_IN on the same date
          for (const possibleClockIn of sorted) {
            if (possibleClockIn.event_type === 'CLOCK_IN') {
              const clockInDate = getDateInTimezone(possibleClockIn.timestamp, timezone);
              if (clockInDate === clockOutDate && !usedClockInIds.has(possibleClockIn.log_id)) {
                matchedClockIn = possibleClockIn;
                usedClockInIds.add(possibleClockIn.log_id);
                console.log(`[GROUPER] Paired orphan CLOCK_OUT with CLOCK_IN:`, {
                  employee_id: employeeId,
                  clock_in: matchedClockIn.timestamp,
                  clock_out: log.timestamp,
                  clock_out_override_by: log.override_by
                });
                break;
              }
            }
          }

          const orphanSession: WorkSession = {
            clock_in_date: clockOutDate,
            clock_in: matchedClockIn,
            clock_out: log,
            breaks: [],
            all_logs: matchedClockIn ? [matchedClockIn, log] : [log],
            duration_minutes: null,
            has_overtime: false,
          };

          if (matchedClockIn && log) {
            const inMs = new Date(matchedClockIn.timestamp).getTime();
            const outMs = new Date(log.timestamp).getTime();
            orphanSession.duration_minutes = (outMs - inMs) / 60000;
          }

          sessions.push(orphanSession);
        }
      } else if (log.event_type === 'BREAK_START' || log.event_type === 'BREAK_END') {
        // Pair breaks with the most appropriate active session
        let matchIndex = activeSessions.findIndex(s => s.clock_in && getSource(s.clock_in) === source);
        if (matchIndex === -1 && activeSessions.length > 0) {
          matchIndex = activeSessions.length - 1;
        }
        
        if (matchIndex !== -1) {
          activeSessions[matchIndex].breaks!.push(log);
          activeSessions[matchIndex].all_logs!.push(log);
        }
      }
    }

    // Add any remaining active sessions as incomplete sessions
    for (const remainingSession of activeSessions) {
      sessions.push(remainingSession as WorkSession);
    }

    // Now group these results by date for this specific employee
    const sessionsByDate: Record<string, WorkSession[]> = {};
    for (const s of sessions) {
      if (!sessionsByDate[s.clock_in_date]) {
        sessionsByDate[s.clock_in_date] = [];
      }
      sessionsByDate[s.clock_in_date].push(s);
    }

    for (const [date, daySessions] of Object.entries(sessionsByDate)) {
      result.push({
        employee_id: employeeId,
        clock_in_date: date,
        sessions: daySessions,
        Employee: daySessions[0].clock_in?.Employee || daySessions[0].clock_out?.Employee,
      });
    }
  }

  return result;
}



/**
 * Calculate total hours from work sessions
 */
export function calculateTotalHours(sessions: WorkSession[]): number {
  let totalMinutes = 0;
  for (const session of sessions) {
    if (session.duration_minutes !== null) {
      totalMinutes += session.duration_minutes;
    }
  }
  return totalMinutes / 60;
}
