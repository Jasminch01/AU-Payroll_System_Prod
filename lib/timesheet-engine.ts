import { createClient } from '@/lib/supabase/server';
import {
    AttendanceLog,
    Shift,
    TimeSheetInsert,
    RateType,
    TimesheetStatus
} from '@/types/database';
import { getDayOfWeekInTimezone, getDateInTimezone } from '@/lib/timezone-utils';

/**
 * The core logic for translating Attendance Logs and Rosters into valid Timesheets.
 */
export async function generateTimesheets(
    businessId: string,
    startDate: string, // YYYY-MM-DD
    endDate: string,   // YYYY-MM-DD
    targetEmployeeId?: string
) {
    const supabase = await createClient();

    // 1. Fetch Data — select only columns used by processDay()
    const { data: employees } = await supabase
        .from('Employee')
        .select(`
            employee_id,
            business_id,
            Business:business_id(timezone),
            EmployeeRateHistory(weekday_rate, saturday_multiplier, sunday_multiplier, public_holiday_multiplier, evening_rate, evening_start_time, evening_end_time)
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .filter('employee_id', targetEmployeeId ? 'eq' : 'neq', targetEmployeeId || 'null');

    const extendedStart = new Date(startDate);
    extendedStart.setDate(extendedStart.getDate() - 1);
    const extendedStartDate = extendedStart.toISOString().split('T')[0];

    const extendedEnd = new Date(endDate);
    extendedEnd.setDate(extendedEnd.getDate() + 1);
    const extendedEndDate = extendedEnd.toISOString().split('T')[0];

    const { data: logs } = await supabase
        .from('AttendanceLog')
        .select('*')
        .eq('business_id', businessId)
        .gte('timestamp', `${extendedStartDate}T00:00:00Z`)
        .lte('timestamp', `${extendedEndDate}T23:59:59Z`)
        .order('timestamp', { ascending: true });

    const { data: rosterShifts } = await supabase
        .from('Shift')
        .select('*')
        .eq('business_id', businessId)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

    // 2. Fetch Public Holidays
    // We match by date and state
    const { data: holidays } = await supabase
        .from('PublicHoliday')
        .select('date')
        .eq('business_id', businessId)
        .gte('date', startDate)
        .lte('date', endDate);

    const publicHolidays = (holidays || []).map(h => h.date);

    // 3. Fetch Approved Leave
    const { data: approvedLeave } = await supabase
        .from('LeaveRequest')
        .select('*')
        .eq('business_id', businessId)
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);

    const results: TimeSheetInsert[] = [];

    if (!employees) return [];

    // 2. Iterate through each day in range
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const nextDateStr = getNextDate(dateStr);

        for (const employee of employees) {
            const empId = employee.employee_id;

            // --- IMPROVED CROSS-MIDNIGHT & STRAY EVENT FILTERING ---
            const empLogs = (logs || []).filter(l => l.employee_id === empId);
            const dayLogs: AttendanceLog[] = [];

            // Primary logs for today
            const primaryLogs = empLogs.filter(l => l.timestamp.split('T')[0] === dateStr);
            dayLogs.push(...primaryLogs);

            // If the last log today is a CLOCK_IN or BREAK_START, we need to collect 
            // the 'trailing' logs from tomorrow to complete the session.
            const lastLog = dayLogs[dayLogs.length - 1];
            if (lastLog && (lastLog.event_type === 'CLOCK_IN' || lastLog.event_type === 'BREAK_START' || lastLog.event_type === 'BREAK_END')) {
                // Find all logs for this employee tomorrow up until and including the first CLOCK_OUT
                const tomorrowLogs = empLogs.filter(l => l.timestamp.split('T')[0] === nextDateStr);
                for (const tl of tomorrowLogs) {
                    dayLogs.push(tl);
                    if (tl.event_type === 'CLOCK_OUT') break;
                }
            }

            const dayShift = (rosterShifts || []).find(s =>
                s.employee_id === empId &&
                (s.shift_date.split('T')[0]) === dateStr
            );

            // Check if employee is on leave this day
            const onLeave = (approvedLeave || []).some(l =>
                l.employee_id === empId &&
                dateStr >= l.start_date &&
                dateStr <= l.end_date
            );

            // Skip if no logs AND no rostered shift AND not on leave
            if (dayLogs.length === 0 && !dayShift && !onLeave) continue;

            const timesheet = processDay(employee, dateStr, dayLogs, dayShift, publicHolidays);
            if (timesheet) results.push(timesheet);
        }
    }

    return results;
}

function processDay(
    employee: { employee_id: string; business_id: string; Business?: { timezone: string | null }; EmployeeRateHistory?: Array<{ weekday_rate: number; saturday_multiplier?: number; sunday_multiplier?: number; public_holiday_multiplier?: number; evening_rate?: number; evening_start_time?: number | null; evening_end_time?: number | null }> },
    date: string,
    logs: AttendanceLog[],
    shift: Shift | undefined,
    publicHolidays: string[]
): TimeSheetInsert | null {
    const businessId = employee.business_id;
    const empId = employee.employee_id;

    // --- 1. Identify and Pair All Logs ---
    const sortedLogs = [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const segments: { in: Date; out: Date }[] = [];
    const breaks: { start: Date; end: Date }[] = [];

    let currentIn: Date | null = null;
    let currentBreakStart: Date | null = null;

    for (const log of sortedLogs) {
        if (log.event_type === 'CLOCK_IN') {
            currentIn = new Date(log.timestamp);
        } else if (log.event_type === 'CLOCK_OUT' && currentIn) {
            segments.push({ in: currentIn, out: new Date(log.timestamp) });
            currentIn = null;
        } else if (log.event_type === 'BREAK_START') {
            currentBreakStart = new Date(log.timestamp);
        } else if (log.event_type === 'BREAK_END' && currentBreakStart) {
            breaks.push({ start: currentBreakStart, end: new Date(log.timestamp) });
            currentBreakStart = null;
        }
    }

    const firstIn = segments.length > 0 ? segments[0].in : null;
    const lastOut = segments.length > 0 ? segments[segments.length - 1].out : null;

    const parseFullTime = (dateStr: string, timeStr: string | null) => {
        if (!timeStr) return null;
        // If it's a full ISO string already, parse it directly
        if (timeStr.includes('T')) return new Date(timeStr);
        // If it's just HH:mm or HH:mm:ss, combine with the date
        // Use 'T' separator to ensure ISO-like parsing
        return new Date(`${dateStr}T${timeStr.split('+')[0].split('Z')[0]}`);
    };

    const rosterStart: Date | null = shift ? parseFullTime(date, shift.start_time) : null;
    const rosterEnd: Date | null = shift ? parseFullTime(date, shift.end_time) : null;

    // --- 2. GRACE PERIOD (5m Snap to Roster) ---
    let finalStart: Date | null = firstIn;
    let finalEnd: Date | null = lastOut;
    let flags: string[] = [];
    let status: TimesheetStatus = 'pending';

    if (firstIn && rosterStart) {
        const diffMins = (firstIn.getTime() - rosterStart.getTime()) / (1000 * 60);
        // Snap to roster if within 5 mins early or late
        if (Math.abs(diffMins) <= 5) {
            finalStart = rosterStart;
            // No flag for successful snap (Positive case)
        } else if (diffMins < -5) {
            flags.push('Early Clock-in');
        } else {
            flags.push('Late Clock-in');
        }
    }

    if (lastOut && rosterEnd) {
        const diffMins = (lastOut.getTime() - rosterEnd.getTime()) / (1000 * 60);
        // Snap to roster if within 5 mins early or late
        if (Math.abs(diffMins) <= 5) {
            finalEnd = rosterEnd;
            // No flag for successful snap (Positive case)
        } else if (diffMins > 5) {
            flags.push('Late Clock-out');
        } else {
            flags.push('Early Clock-out');
        }
    }

    if (!finalEnd && rosterEnd && finalStart) {
        finalEnd = rosterEnd;
        flags.push('Auto-filled Clock-out');
    }

    if (!shift && finalStart) {
        flags.push('Unscheduled Work');
    }

    if (finalStart && !finalEnd) {
        flags.push('Forgot Clock-out');
        finalEnd = finalStart; // Prevents crash, but zero hours
    }

    /* 
    const snapped = flags.some(f => f.includes('Snapped'));
    if (finalStart && shift && !snapped) {
        flags.push('Not Exact Timing');
    }
    */

    // Calculate total hours
    let workTimeHours = (finalStart && finalEnd) ? calculateHours(finalStart, finalEnd) : 0;

    // Deduct manual breaks
    let breakTimeHours = 0;
    for (const brk of breaks) {
        breakTimeHours += calculateHours(brk.start, brk.end);
    }

    let actualHours = Math.max(0, workTimeHours - breakTimeHours);

    // --- 4. AUTO-BREAK DEDUCTION (REMOVED) ---
    // User requested to rely only on manual BREAK_START/END logs.
    /*
    if (actualHours > 5.5 && breaks.length === 0) {
        actualHours -= 0.5;
        flags.push('30m Auto-break deducted');
    }
    */

    // --- 5. OVERTIME & VARIANCE ---
    const rosteredHours = rosterStart && rosterEnd ? calculateHours(rosterStart, rosterEnd) : 0;
    const overtimeHours = Math.max(0, actualHours - rosteredHours);

    if (overtimeHours > 0) {
        flags.push('Did Overtime');
        if (shift) flags.push(`${overtimeHours.toFixed(2)}h Overtime`);
    }

    if (overtimeHours > 0 && !shift) {
        flags.push('Unscheduled Work (Pay All)');
    }

    // --- 6. RATE TYPE & MIDNIGHT SPLITTING ---
    // For now, we calculate based on the START date for the segment
    const timezone = employee.Business?.timezone || 'Australia/Sydney';

    const getRateType = (dt: Date) => {
        const dateStr = getDateInTimezone(dt.toISOString(), timezone);
        const dayOfWeek = getDayOfWeekInTimezone(dt, timezone); // 0 = Sunday
        if (publicHolidays.includes(dateStr)) return 'public_holiday';
        if (dayOfWeek === 0) return 'sunday';
        if (dayOfWeek === 6) return 'saturday';
        return 'weekday' as RateType;
    };

    const rateType = getRateType(finalStart || new Date(date));

    // --- 7. GROSS PAY CALCULATION ---
    const rates = employee.EmployeeRateHistory?.[0];
    const hourlyRate = rates?.weekday_rate || 0;
    let multiplier = 1.0;

    if (rateType === 'saturday') multiplier = rates?.saturday_multiplier || 1.25;
    if (rateType === 'sunday') multiplier = rates?.sunday_multiplier || 1.5;
    if (rateType === 'public_holiday') multiplier = rates?.public_holiday_multiplier || 2.5;

    const baseGrossPay = actualHours * hourlyRate * multiplier;
    let finalGrossPay = baseGrossPay;

    // Evening rate overlay (if applicable)
    if (rates?.evening_rate && rates.evening_start_time !== null && rates.evening_end_time !== null) {
        // Simple evening overlap logic (hours between evening_start and evening_end)
        const evStart = rates.evening_start_time;
        const evEnd = rates.evening_end_time;

        if (finalStart && finalEnd) {
            const startHour = finalStart.getHours() + finalStart.getMinutes() / 60;
            const endHour = finalEnd.getHours() + finalEnd.getMinutes() / 60;

            const overlapStart = Math.max(startHour, evStart as number);
            const overlapEnd = Math.min(endHour, evEnd as number);
            const evHours = Math.max(0, overlapEnd - overlapStart);

            if (evHours > 0) {
                const baseForEv = evHours * hourlyRate * multiplier;
                const evTotal = evHours * rates.evening_rate;
                finalGrossPay = (finalGrossPay - baseForEv) + evTotal;
                flags.push(`${evHours.toFixed(2)}h Evening Rate`);
            }
        }
    }

    // If it's a "No Show" (Shift exists but no logs)
    if (!firstIn && shift) {
        return {
            business_id: businessId,
            employee_id: empId,
            date,
            gross_pay: 0,
            hourly_rate: hourlyRate,
            actual_hours: 0,
            rostered_hours: Number(rosteredHours.toFixed(2)),
            status: 'pending',
            flags: 'Absent',
            notes: 'System: Scheduled shift but no attendance logs found.',
            actual_start: null,
            actual_end: null,
            rostered_start: rosterStart ? rosterStart.toTimeString().split(' ')[0] : null,
            rostered_end: rosterEnd ? rosterEnd.toTimeString().split(' ')[0] : null,
            rate_type: rateType,
            overtime_hours: 0,
            break_hours: 0
        } as TimeSheetInsert;
    }

    if (!finalStart || !finalEnd) return null;

    return {
        business_id: businessId,
        employee_id: empId,
        date,
        gross_pay: Number(finalGrossPay.toFixed(2)),
        hourly_rate: hourlyRate,
        rate_type: rateType,
        actual_start: finalStart.toTimeString().split(' ')[0],
        actual_end: finalEnd.toTimeString().split(' ')[0],
        actual_hours: Number(actualHours.toFixed(2)),
        rostered_start: rosterStart ? rosterStart.toTimeString().split(' ')[0] : null,
        rostered_end: rosterEnd ? rosterEnd.toTimeString().split(' ')[0] : null,
        rostered_hours: Number(rosteredHours.toFixed(2)),
        overtime_hours: Number(overtimeHours.toFixed(2)),
        break_hours: Number(breakTimeHours.toFixed(2)),
        status,
        flags: [...new Set(flags)].join(', '), // Dedupe flags
        notes: shift ? 'System: Auto-generated from Roster' : 'System: Unscheduled work session detected',
        approved_by: null,
        approved_at: null
    };
}

function calculateHours(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    return Math.max(0, diff / (1000 * 60 * 60));
}

/**
 * Helper: Get next date string (YYYY-MM-DD)
 * Used for cross-midnight work session logic
 */
function getNextDate(dateStr: string): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

/**
 * Helper: Calculate regular vs overtime hours
 * Compares actual work hours against rostered hours
 */
function calculateOvertimeHours(actualHours: number, rosteredHours: number): { regular: number; overtime: number } {
    const regular = Math.min(actualHours, rosteredHours);
    const overtime = Math.max(0, actualHours - rosteredHours);
    return { regular, overtime };
}
