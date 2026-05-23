import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser, getBusinessTimezone } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-helpers';
import { getNextAttendanceEvent, validateAttendanceTransition } from '@/lib/attendance-logic';
import { EventType } from '@/types/database';
import { notifyAttendanceEvent } from '@/lib/attendance-notifications';
import { groupAttendanceIntoSessions } from '@/lib/attendance-grouper';
import { getTodayRangeInTimezone, getDateInTimezone } from '@/lib/timezone-utils';
import { getShiftChecklistProgress, validateClockOutChecklist, notifyChecklistStatus } from '@/lib/checklist-engine';

export async function GET(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required.', 401);
        }

        const supabase = await createClient();

        // Get today's date range in the business timezone
        const timezone = await getBusinessTimezone(authUser.business_id);
        const { searchParams } = new URL(request.url);
        const from = searchParams.get('from');
        const to = searchParams.get('to');

        let query = supabase
            .from('AttendanceLog')
            .select('*, Employee:employee_id(first_name, last_name, role_title)')
            .eq('employee_id', authUser.employee_id)
            .eq('business_id', authUser.business_id);

        if (from || to) {
            if (from) query = query.gte('timestamp', `${from}T00:00:00Z`);
            if (to) query = query.lte('timestamp', `${to}T23:59:59Z`);
        } else {
            const { start, end } = getTodayRangeInTimezone(timezone);
            query = query.gte('timestamp', start).lte('timestamp', end);
        }

        const { data: logs, error } = await query.order('timestamp', { ascending: false });

        if (error) return errorResponse(error.message, 400);

        // Group logs into sessions
        const grouped = groupAttendanceIntoSessions(logs || [], timezone);
        
        // Flatten sessions for the employee
        const allSessions = grouped.flatMap(g => g.sessions.map(s => ({
            ...s,
            total_hours: (s.duration_minutes || 0) / 60
        })));

        // Also get the most recent log to determine current status
        const currentStatus = logs && logs.length > 0 ? logs[0].event_type : null;

        return successResponse({
            logs,
            sessions: allSessions,
            current_status: currentStatus,
        });
    } catch (err) {
        console.error('My attendance error:', err);
        return errorResponse('Internal server error', 500);
    }
}

/**
 * POST /api/attendance/me
 * 
 * Employee self-service clock in/out (no kiosk device required)
 * Auto-determines next event type (CLOCK_IN → CLOCK_OUT → BREAK_START, etc.)
 * Access: Employee only
 */
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.employee_id) {
            return errorResponse('Valid employee profile required.', 401);
        }

        if (authUser.role !== 'employee') {
            return errorResponse('Only employees can use self-service clock in/out.', 403);
        }

        const supabase = await createClient();

        // Get the most recent log to determine next event
        const { data: lastLog } = await supabase
            .from('AttendanceLog')
            .select('event_type, timestamp')
            .eq('employee_id', authUser.employee_id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

        // Auto-determine next event type
        const now = new Date().toISOString();
        const nextEventType = getNextAttendanceEvent(
            lastLog as { event_type: EventType; timestamp: string } | null,
            now
        );

        // Validate the transition
        const transitionError = validateAttendanceTransition(
            lastLog as { event_type: EventType; timestamp: string } | null,
            nextEventType,
            now
        );

        if (transitionError) {
            console.error('[CLOCK ME] Transition error:', transitionError);
            return errorResponse(`Cannot clock: ${transitionError}`, 400);
        }

        // Checklist check for CLOCK_OUT
        if (nextEventType === 'CLOCK_OUT') {
            const tz = await getBusinessTimezone(authUser.business_id);
            const today = getDateInTimezone(now, tz);
            const { data: shift } = await supabase
                .from('Shift')
                .select('*')
                .eq('employee_id', authUser.employee_id)
                .eq('shift_date', today)
                .eq('shift_status', 'published')
                .limit(1)
                .maybeSingle();

            if (shift) {
                const { blocked, pendingCount } = await validateClockOutChecklist(shift.shift_id, supabase);
                if (blocked) {
                    // Send blocked notification
                    if (authUser.user_id) {
                        notifyChecklistStatus(
                            authUser.user_id,
                            authUser.business_id,
                            'CLOCK_OUT_BLOCKED',
                            shift.shift_type,
                            pendingCount
                        ).catch(err => console.error('Failed to send checklist blocked notification:', err));
                    }

                    return errorResponse(
                        `Incomplete Checklist: Please complete your shift checklist in the My Shifts page before clocking out. You have ${pendingCount} pending required task(s).`,
                        422,
                        { blocked: true, pending_count: pendingCount }
                    );
                }
            }
        }

        // Create the attendance log
        const { data: log, error: logError } = await supabase
            .from('AttendanceLog')
            .insert({
                business_id: authUser.business_id,
                employee_id: authUser.employee_id,
                event_type: nextEventType,
                device_info: 'Employee App',
                timestamp: now,
            })
            .select()
            .single();

        if (logError) {
            return errorResponse(logError.message, 400);
        }

        // Notify managers/owners of the clock event (async, no await)
        notifyAttendanceEvent(
            authUser.employee_id,
            nextEventType,
            now,
            authUser.business_id,
            'Employee App'
        ).catch(err => console.error('Failed to send attendance notification:', err));

        // --- CLOCK_IN: Checklist Reminder Notification (async, post-response) ---
        // If the employee just clocked in and has a rostered shift with tasks, notify them.
        if (nextEventType === 'CLOCK_IN' && authUser.user_id) {
            (async () => {
                try {
                    const tz = await getBusinessTimezone(authUser.business_id);
                    const today = getDateInTimezone(now, tz);
                    const { data: shift } = await supabase
                        .from('Shift')
                        .select('*')
                        .eq('employee_id', authUser.employee_id)
                        .eq('shift_date', today)
                        .eq('shift_status', 'published')
                        .limit(1)
                        .maybeSingle();

                    if (shift) {
                        const { total } = await getShiftChecklistProgress(shift.shift_id, supabase);
                        if (total > 0) {
                            await notifyChecklistStatus(
                                authUser.user_id!,
                                authUser.business_id,
                                'CLOCK_IN_REMINDER',
                                shift.shift_type,
                                total
                            );
                        }
                    }
                } catch (err) {
                    console.error('[CLOCK ME] Failed to send checklist reminder notification:', err);
                }
            })();
        }

        return successResponse(
            { log, event_type: nextEventType },
            `Successfully ${nextEventType.replace('_', ' ').toLowerCase()}!`
        );
    } catch (err) {
        console.error('Employee clock error:', err);
        return errorResponse('Internal server error', 500);
    }
}
