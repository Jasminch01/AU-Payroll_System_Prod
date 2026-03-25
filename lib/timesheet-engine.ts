import { createClient } from '@/lib/supabase/server';
import {
    AttendanceLog,
    Shift,
    EmployeeRateHistory,
    TimeSheetInsert,
    RateType,
    TimesheetStatus
} from '@/types/database';

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

    // 1. Fetch Data
    const { data: employees } = await supabase
        .from('Employee')
        .select(`
            *,
            EmployeeRateHistory(*)
        `)
        .eq('business_id', businessId)
        .eq('status', 'active')
        .filter('employee_id', targetEmployeeId ? 'eq' : 'neq', targetEmployeeId || 'null');

    const { data: logs } = await supabase
        .from('AttendanceLog')
        .select('*')
        .eq('business_id', businessId)
        .gte('timestamp', `${startDate}T00:00:00Z`)
        .lte('timestamp', `${endDate}T23:59:59Z`)
        .order('timestamp', { ascending: true });

    const { data: rosterShifts } = await supabase
        .from('Shift')
        .select('*')
        .eq('business_id', businessId)
        .gte('shift_date', startDate)
        .lte('shift_date', endDate);

    // 2. Fetch Public Holidays
    // We match by date and state
    const { data: business } = await supabase
        .from('Business')
        .select('state')
        .eq('business_id', businessId)
        .single();

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

        for (const employee of employees) {
            const empId = employee.employee_id;

            // Get data for this day/employee
            const dayLogs = (logs || []).filter(l =>
                l.employee_id === empId &&
                l.timestamp.startsWith(dateStr)
            );

            const dayShift = (rosterShifts || []).find(s =>
                s.employee_id === empId &&
                s.shift_date === dateStr
            );

            // Check if employee is on leave this day
            const onLeave = (approvedLeave || []).some(l =>
                l.employee_id === empId &&
                dateStr >= l.start_date &&
                dateStr <= l.end_date
            );

            // If on leave, we might still generate a timesheet if we want to pay them for leave hours?
            // Usually, leave generates its own timesheet line. 
            // For now, if on leave AND no logs, skip generating a 'work' timesheet.
            if (onLeave && dayLogs.length === 0) continue;

            // Skip if no logs AND no rostered shift
            if (dayLogs.length === 0 && !dayShift && !onLeave) continue;

            const timesheet = processDay(employee, dateStr, dayLogs, dayShift, publicHolidays);
            if (timesheet) results.push(timesheet);
        }
    }

    return results;
}

function processDay(
    employee: any,
    date: string,
    logs: AttendanceLog[],
    shift: Shift | undefined,
    publicHolidays: string[]
): TimeSheetInsert | null {
    const businessId = employee.business_id;
    const empId = employee.employee_id;

    // --- 1. Identify and Pair All Logs ---
    // Sort logs by timestamp just in case
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
            currentIn = null; // Reset
        } else if (log.event_type === 'BREAK_START') {
            currentBreakStart = new Date(log.timestamp);
        } else if (log.event_type === 'BREAK_END' && currentBreakStart) {
            breaks.push({ start: currentBreakStart, end: new Date(log.timestamp) });
            currentBreakStart = null;
        }
    }

    // Calculate total hours
    let workTimeHours = 0;
    for (const seg of segments) {
        workTimeHours += calculateHours(seg.in, seg.out);
    }

    let breakTimeHours = 0;
    for (const brk of breaks) {
        breakTimeHours += calculateHours(brk.start, brk.end);
    }

    let actualHours = Math.max(0, workTimeHours - breakTimeHours);

    const firstIn = segments.length > 0 ? segments[0].in : null;
    const lastOut = segments.length > 0 ? segments[segments.length - 1].out : null;

    let rosterStart: Date | null = shift ? new Date(shift.start_time) : null;
    let rosterEnd: Date | null = shift ? new Date(shift.end_time) : null;

    let flags: string[] = [];
    let status: TimesheetStatus = 'pending';

    if (segments.length > 1) {
        flags.push(`${segments.length} Segments Detected`);
    }

    // --- 2. Conflict Resolution & Grace Periods (Mapped to first/last logs) ---
    let finalStart: Date | null = firstIn;
    let finalEnd: Date | null = lastOut;

    // Grace Period logic (5m) applied to the boundaries
    if (firstIn && rosterStart) {
        const diffInSeconds = (firstIn.getTime() - rosterStart.getTime()) / 1000;
        const diffInMinutes = diffInSeconds / 60;

        if (Math.abs(diffInMinutes) <= 5) {
            // Adjust only the calculation of the FIRST pair if needed?
            // Actually, for simplicity, we adjust the total actualHours if it's within grace
            const adjustment = diffInMinutes; // in minutes
            actualHours -= (adjustment / 60);
            finalStart = rosterStart; // Snap for visual
        } else if (diffInMinutes < -5) {
            flags.push('Early Clock-in (OT)');
        } else {
            flags.push('Late Clock-in');
        }
    }

    if (lastOut && rosterEnd) {
        const diffInSeconds = (lastOut.getTime() - rosterEnd.getTime()) / 1000;
        const diffInMinutes = diffInSeconds / 60;

        if (Math.abs(diffInMinutes) <= 5) {
            const adjustment = diffInMinutes; // in minutes
            actualHours -= (adjustment / 60);
            finalEnd = rosterEnd; // Snap for visual
        } else if (diffInMinutes > 5) {
            flags.push('Late Clock-out (OT)');
        } else {
            flags.push('Early Clock-out');
        }
    }

    // Handle "No Show" or "Missing Logs"
    if (!firstIn && rosterStart) {
        flags.push('No Show / Missing Clock-in');
    }

    if (!lastOut && rosterEnd && firstIn) {
        flags.push('Missing Clock-out');
        // Fallback to roster end if desired
        const rosterHours = rosterStart && rosterEnd ? calculateHours(rosterStart, rosterEnd) : 0;
        actualHours = rosterHours;
        finalEnd = rosterEnd;
    }

    if (!firstIn && !lastOut && shift) {
        // No Show Case
        return {
            business_id: businessId,
            employee_id: empId,
            date,
            gross_pay: 0,
            hourly_rate: 0,
            actual_hours: 0,
            rostered_hours: shift ? calculateHours(new Date(shift.start_time), new Date(shift.end_time)) : 0,
            status: 'pending',
            flags: 'No Show',
            notes: 'Generated from Roster',
            approved_by: null,
            approved_at: null,
            rate_type: null,
            actual_start: null,
            actual_end: null,
            roster_start: rosterStart ? rosterStart.toISOString().split('T')[0] : null,
            roster_end: rosterEnd ? rosterEnd.toISOString().split('T')[0] : null
        } as TimeSheetInsert;
    }

    if (!finalStart || !finalEnd) return null;

    if (breaks.length > 0) {
        flags.push(`${breaks.length} Breaks recorded (${breakTimeHours.toFixed(2)}h)`);
    } else {
        // Automatic Break Deduction (only if no manual breaks)
        if (actualHours > 10) {
            actualHours -= 1.0; // 60 mins
            flags.push('Auto-deduct 60m break');
        } else if (actualHours > 5) {
            actualHours -= 0.5; // 30 mins
            flags.push('Auto-deduct 30m break');
        }
    }

    // --- 4. Rate Type Determination ---
    const dayOfWeek = finalStart.getUTCDay(); // 0 = Sunday, 1 = Monday...
    let rateType: RateType = 'weekday';

    if (publicHolidays.includes(date)) {
        rateType = 'public_holiday';
    } else if (dayOfWeek === 0) {
        rateType = 'sunday';
    } else if (dayOfWeek === 6) {
        rateType = 'saturday';
    }

    // --- 5. Gross Pay Calculation ---
    // Get effective rate
    const rates = employee.EmployeeRateHistory?.[0]; // Assuming most recent
    let hourlyRate = rates?.weekday_rate || 0;
    let multiplier = 1.0;

    if (rateType === 'saturday') multiplier = rates?.saturday_multiplier || 1.25;
    if (rateType === 'sunday') multiplier = rates?.sunday_multiplier || 1.5;
    if (rateType === 'public_holiday') multiplier = rates?.public_holiday_multiplier || 2.5;

    let baseGrossPay = actualHours * hourlyRate * multiplier;
    let finalGrossPay = baseGrossPay;

    // --- EVENING RATE OVERLAY ---
    if (rates?.evening_rate && rates.evening_start_time !== null && rates.evening_end_time !== null) {
        const eveningStartHour = rates.evening_start_time;
        const eveningEndHour = rates.evening_end_time;

        let totalEveningHours = 0;

        for (const seg of segments) {
            const startHour = seg.in.getHours() + seg.in.getMinutes() / 60;
            const endHour = seg.out.getHours() + seg.out.getMinutes() / 60;

            // Calculate overlap with evening window for THIS segment
            const overlapStart = Math.max(startHour, eveningStartHour);
            const overlapEnd = Math.min(endHour, eveningEndHour);
            const segmentEveningHours = Math.max(0, overlapEnd - overlapStart);

            totalEveningHours += segmentEveningHours;
        }

        if (totalEveningHours > 0) {
            // Subtract base pay for these hours and add evening pay
            const baseForEvening = totalEveningHours * hourlyRate * multiplier;
            const eveningTotal = totalEveningHours * rates.evening_rate;

            finalGrossPay = (baseGrossPay - baseForEvening) + eveningTotal;
            flags.push(`${totalEveningHours.toFixed(2)}h Evening Rate applied`);
        }
    }

    return {
        business_id: businessId,
        employee_id: empId,
        date,
        gross_pay: Number(finalGrossPay.toFixed(2)),
        hourly_rate: hourlyRate,
        rate_type: rateType,
        actual_start: finalStart.toTimeString().split(' ')[0], // HH:mm:ss (TIME type)
        actual_end: finalEnd.toTimeString().split(' ')[0],     // HH:mm:ss (TIME type)
        actual_hours: Number(actualHours.toFixed(2)),
        roster_start: rosterStart ? rosterStart.toTimeString().split(' ')[0] : null, // HH:mm:ss (TIME type)
        roster_end: rosterEnd ? rosterEnd.toTimeString().split(' ')[0] : null,       // HH:mm:ss (TIME type)
        rostered_hours: rosterStart && rosterEnd ? Number(calculateHours(rosterStart, rosterEnd).toFixed(2)) : 0,
        status,
        flags: flags.join(', '),
        notes: 'Generated automatically',
        approved_by: null,
        approved_at: null
    };
}

function calculateHours(start: Date, end: Date): number {
    const diff = end.getTime() - start.getTime();
    return Math.max(0, diff / (1000 * 60 * 60));
}
